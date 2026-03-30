import { createAdminClient } from "./supabase/server";
import { fetchQuotes, fetchAllAth } from "./yahoo";
import { fetchAllEarnings } from "./finnhub";

export interface AlertData {
  id: string;
  tickerId: string;
  targetPrice: number;
  comment: string | null;
  isDisplayTarget: boolean;
  status: "active" | "triggered";
  triggeredAt: string | null;
  cooldownUntil: string | null;
}

export interface TickerData {
  id: string;
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  ath3y: number | null;
  athPct: number | null;
  targetPrice: number | null;  // from display-target alert
  targetPct: number | null;
  earningsDate: string | null;
  earningsDays: number | null;
  hasAlert: boolean;
  alerts: AlertData[];
}

export interface TickersResponse {
  tickers: TickerData[];
  updatedAt: string;
  source: "live" | "cache";
}

function calcPct(price: number, ref: number | null): number | null {
  if (ref === null || ref === 0) return null;
  return ((price - ref) / ref) * 100;
}

function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(isoDate);
  d.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return days >= 0 ? days : null;
}

/**
 * Build ticker data reading from price_cache (fast path, no Yahoo call).
 * Used by GET /api/tickers — returns cached prices immediately.
 */
export async function buildFromCache(): Promise<TickersResponse> {
  const db = createAdminClient();

  const { data: rows, error } = await db
    .from("tickers")
    .select(`
      id, symbol, name, sort_order,
      price_cache ( current_price, change_pct, ath_3y, ath_pct, earnings_date, updated_at ),
      alerts ( id, ticker_id, user_id, target_price, comment, is_display_target, status, triggered_at, cooldown_until )
    `)
    .order("sort_order");

  if (error) throw new Error(`Supabase tickers query failed: ${error.message}`);

  // Find the most recent updated_at across all price_cache rows
  let latestUpdate = new Date(0);

  const tickers: TickerData[] = (rows ?? []).map((row) => {
    // Supabase returns joined tables as objects (one-to-one) or arrays (one-to-many)
    const cache = Array.isArray(row.price_cache) ? row.price_cache[0] : row.price_cache;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawAlerts: AlertData[] = ((row.alerts as any[] | null) ?? []).map((a: any) => ({
      id: a.id as string,
      tickerId: a.ticker_id as string,
      targetPrice: a.target_price as number,
      comment: a.comment as string | null,
      isDisplayTarget: a.is_display_target as boolean,
      status: a.status as "active" | "triggered",
      triggeredAt: a.triggered_at as string | null,
      cooldownUntil: a.cooldown_until as string | null,
    }));

    if (cache?.updated_at) {
      const t = new Date(cache.updated_at);
      if (t > latestUpdate) latestUpdate = t;
    }

    const price: number = cache?.current_price ?? 0;
    const displayAlert = rawAlerts.find((a) => a.isDisplayTarget) ?? null;
    const targetPrice = displayAlert?.targetPrice ?? null;
    const earningsDate = cache?.earnings_date ?? null;

    return {
      id: row.id,
      symbol: row.symbol,
      name: row.name ?? row.symbol,
      price,
      changePct: cache?.change_pct ?? 0,
      ath3y: cache?.ath_3y ?? null,
      athPct: calcPct(price, cache?.ath_3y ?? null),
      targetPrice,
      targetPct: calcPct(price, targetPrice),
      earningsDate,
      earningsDays: daysUntil(earningsDate),
      hasAlert: rawAlerts.length > 0,
      alerts: rawAlerts,
    };
  });

  return {
    tickers,
    updatedAt: latestUpdate.getTime() > 0 ? latestUpdate.toISOString() : new Date().toISOString(),
    source: "cache",
  };
}

/**
 * Fetch live prices from Yahoo Finance, write to price_cache, return fresh data.
 * Used by POST /api/refresh and GET /api/check-alerts.
 */
export async function fetchAndCachePrices(): Promise<TickersResponse> {
  const db = createAdminClient();

  // 1. Load tickers list from Supabase
  const { data: tickerRows, error: tickerError } = await db
    .from("tickers")
    .select("id, symbol, name, sort_order")
    .order("sort_order");

  if (tickerError) throw new Error(`Supabase tickers query failed: ${tickerError.message}`);
  if (!tickerRows || tickerRows.length === 0) {
    return { tickers: [], updatedAt: new Date().toISOString(), source: "live" };
  }

  // 2. Map display symbol → Yahoo symbol (BRK.B → BRK-B)
  const toYahoo = (sym: string) => sym.replace(".", "-");
  const yahooSymbols = tickerRows.map((t) => toYahoo(t.symbol));
  const displaySymbols = tickerRows.map((t) => t.symbol);

  // 3. Fetch prices + ATH + earnings in parallel
  const [quotes, athMap, earningsMap] = await Promise.all([
    fetchQuotes(yahooSymbols),
    fetchAllAth(yahooSymbols),
    fetchAllEarnings(displaySymbols),
  ]);

  const quoteByYahoo = new Map(quotes.map((q) => [q.symbol, q]));
  const now = new Date().toISOString();

  // 4. Build price_cache upsert rows
  const cacheRows = tickerRows.map((t) => {
    const yahoo = toYahoo(t.symbol);
    const quote = quoteByYahoo.get(yahoo);
    const ath = athMap[yahoo] ?? null;
    const earnings = earningsMap[t.symbol] ?? null;
    const price = quote?.price ?? 0;
    return {
      ticker_id: t.id,
      current_price: price,
      change_pct: quote?.changePct ?? 0,
      ath_3y: ath,
      ath_pct: ath ? calcPct(price, ath) : null,
      earnings_date: earnings?.date ?? null,
      updated_at: now,
    };
  });

  // 5. Upsert into price_cache
  const { error: upsertError } = await db
    .from("price_cache")
    .upsert(cacheRows, { onConflict: "ticker_id" });

  if (upsertError) {
    console.error("[buildTickerData] price_cache upsert failed:", upsertError.message);
  }

  // 6. Load alerts to get display targets
  const { data: alertRows } = await db
    .from("alerts")
    .select("id, ticker_id, user_id, target_price, comment, is_display_target, status, triggered_at, cooldown_until");

  const alertsByTicker = new Map<string, AlertData[]>();
  for (const a of alertRows ?? []) {
    const list = alertsByTicker.get(a.ticker_id) ?? [];
    list.push({
      id: a.id,
      tickerId: a.ticker_id,
      targetPrice: a.target_price,
      comment: a.comment,
      isDisplayTarget: a.is_display_target,
      status: a.status,
      triggeredAt: a.triggered_at,
      cooldownUntil: a.cooldown_until,
    });
    alertsByTicker.set(a.ticker_id, list);
  }

  // 7. Build response
  const tickers: TickerData[] = tickerRows.map((t) => {
    const yahoo = toYahoo(t.symbol);
    const quote = quoteByYahoo.get(yahoo);
    const ath = athMap[yahoo] ?? null;
    const earnings = earningsMap[t.symbol] ?? null;
    const price = quote?.price ?? 0;
    const alerts = alertsByTicker.get(t.id) ?? [];
    const displayAlert = alerts.find((a) => a.isDisplayTarget) ?? null;
    const targetPrice = displayAlert?.targetPrice ?? null;

    return {
      id: t.id,
      symbol: t.symbol,
      name: t.name ?? t.symbol,
      price,
      changePct: quote?.changePct ?? 0,
      ath3y: ath,
      athPct: calcPct(price, ath),
      targetPrice,
      targetPct: calcPct(price, targetPrice),
      earningsDate: earnings?.date ?? null,
      earningsDays: earnings?.days ?? null,
      hasAlert: alerts.length > 0,
      alerts,
    };
  });

  return { tickers, updatedAt: now, source: "live" };
}
