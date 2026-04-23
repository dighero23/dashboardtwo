import { createAdminClient } from "./supabase/server";

const FRED_BASE = "https://api.stlouisfed.org/fred";

export interface FredObservation {
  date: string;   // "YYYY-MM-DD"
  value: number | null;  // null when FRED returns "."
}

export interface FredSeriesData {
  seriesId: string;
  observations: FredObservation[];
  fetchedAt: string;
}

// ── TTLs ──────────────────────────────────────────────────────────────────────

const TTL_DAILY_MS   = 12 * 60 * 60 * 1000;   // daily series: DGS10, DGS2, VIX
const TTL_MONTHLY_MS = 24 * 60 * 60 * 1000;   // monthly series: CPI, PCE, UNRATE, FEDFUNDS
const TTL_QUARTERLY_MS = 48 * 60 * 60 * 1000; // quarterly: GDP

// ── Series catalogue ─────────────────────────────────────────────────────────

export type FredSeriesId =
  | "FEDFUNDS"   // Fed funds effective rate (monthly)
  | "CPIAUCSL"   // CPI all items (monthly)
  | "PCEPI"      // PCE price index (monthly)
  | "UNRATE"     // Unemployment rate (monthly)
  | "GDP"        // Nominal GDP (quarterly)
  | "GDPC1"      // Real GDP (quarterly)
  | "DGS10"      // 10-Year Treasury (daily)
  | "DGS2"       // 2-Year Treasury (daily)
  | "T10Y2Y"     // 10Y-2Y spread (daily)
  | "VIXCLS"     // VIX close (daily)
  | "DEXUSEU";   // USD/EUR exchange rate (daily)

const SERIES_TTL: Record<FredSeriesId, number> = {
  FEDFUNDS:  TTL_MONTHLY_MS,
  CPIAUCSL:  TTL_MONTHLY_MS,
  PCEPI:     TTL_MONTHLY_MS,
  UNRATE:    TTL_MONTHLY_MS,
  GDP:       TTL_QUARTERLY_MS,
  GDPC1:     TTL_QUARTERLY_MS,
  DGS10:     TTL_DAILY_MS,
  DGS2:      TTL_DAILY_MS,
  T10Y2Y:    TTL_DAILY_MS,
  VIXCLS:    TTL_DAILY_MS,
  DEXUSEU:   TTL_DAILY_MS,
};

// ── Core fetch + cache ────────────────────────────────────────────────────────

async function fetchFredSeries(
  seriesId: FredSeriesId,
  limit = 13
): Promise<FredSeriesData | null> {
  const key = process.env.FRED_API_KEY;
  if (!key) return null;

  const url = new URL(`${FRED_BASE}/series/observations`);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", key);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sort_order", "desc");

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;

    const json = await res.json();
    const raw: { date: string; value: string }[] = json?.observations ?? [];

    const observations: FredObservation[] = raw
      .filter((o) => o.value !== "." && o.value !== "")
      .map((o) => ({ date: o.date, value: parseFloat(o.value) }));

    return { seriesId, observations, fetchedAt: new Date().toISOString() };
  } catch {
    return null;
  }
}

/**
 * Get a FRED series — cache-first, fetch on miss or expiry.
 * Uses macro_cache table with a TTL-based expiry strategy.
 */
export async function getFredSeries(
  seriesId: FredSeriesId,
  limit = 13
): Promise<FredSeriesData | null> {
  const db = createAdminClient();
  const cacheKey = `fred:${seriesId}:${limit}`;
  const now = new Date();

  // 1. Check cache
  const { data: cached } = await db
    .from("macro_cache")
    .select("data, expires_at")
    .eq("cache_key", cacheKey)
    .single();

  if (cached && new Date(cached.expires_at) > now) {
    return cached.data as FredSeriesData;
  }

  // 2. Fetch from FRED
  const fresh = await fetchFredSeries(seriesId, limit);
  if (!fresh) return cached?.data as FredSeriesData ?? null;

  // 3. Write to cache
  const ttl = SERIES_TTL[seriesId] ?? TTL_DAILY_MS;
  const expiresAt = new Date(now.getTime() + ttl).toISOString();

  await db.from("macro_cache").upsert(
    { cache_key: cacheKey, data: fresh, fetched_at: now.toISOString(), expires_at: expiresAt },
    { onConflict: "cache_key" }
  );

  return fresh;
}

// ── Convenience fetchers ──────────────────────────────────────────────────────

export async function getFedFundsRate() { return getFredSeries("FEDFUNDS", 2); }
export async function getCPI()          { return getFredSeries("CPIAUCSL", 13); }
export async function getPCE()          { return getFredSeries("PCEPI",    13); }
export async function getUnemployment() { return getFredSeries("UNRATE",   6); }
export async function getRealGDP()      { return getFredSeries("GDPC1",    6); }
export async function get10YTreasury()  { return getFredSeries("DGS10",    6); }
export async function get2YTreasury()   { return getFredSeries("DGS2",     6); }
export async function getYieldSpread()  { return getFredSeries("T10Y2Y",   6); }
export async function getVIX()          { return getFredSeries("VIXCLS",   6); }
