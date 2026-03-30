import { TICKER_LIST } from "./tickers";
import { fetchQuotes, fetchAllAth } from "./yahoo";
import { fetchAllEarnings } from "./finnhub";

export interface TickerData {
  id: string;
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  ath3y: number | null;
  athPct: number | null;
  targetPrice: number | null;
  targetPct: number | null;
  earningsDate: string | null;
  earningsDays: number | null;
  hasAlert: boolean;
}

export interface TickersResponse {
  tickers: TickerData[];
  updatedAt: string;
  source: "live" | "error";
}

function calcPct(price: number, ref: number | null): number | null {
  if (ref === null || ref === 0) return null;
  return ((price - ref) / ref) * 100;
}

/**
 * Fetches live prices, 3yr ATH, and earnings for all configured tickers.
 * ATH and earnings are cached at the fetch layer (24h via next revalidate).
 */
export async function buildTickerData(): Promise<TickersResponse> {
  const yahooSymbols = TICKER_LIST.map((t) => t.yahooSymbol);
  const displaySymbols = TICKER_LIST.map((t) => t.symbol);

  // Fetch prices (fast, every call) and ATH + earnings in parallel
  const [quotes, athMap, earningsMap] = await Promise.all([
    fetchQuotes(yahooSymbols),
    fetchAllAth(yahooSymbols),
    fetchAllEarnings(displaySymbols),
  ]);

  // Index quotes by Yahoo symbol
  const quoteByYahoo = new Map(quotes.map((q) => [q.symbol, q]));

  const tickers: TickerData[] = TICKER_LIST.map((cfg) => {
    const quote = quoteByYahoo.get(cfg.yahooSymbol);
    const earnings = earningsMap[cfg.symbol] ?? null;
    const ath3y = athMap[cfg.yahooSymbol] ?? null;

    if (!quote) {
      // Fallback row if Yahoo Finance failed for this ticker
      return {
        id: cfg.id,
        symbol: cfg.symbol,
        name: cfg.name,
        price: 0,
        changePct: 0,
        ath3y: null,
        athPct: null,
        targetPrice: cfg.targetPrice,
        targetPct: null,
        earningsDate: earnings?.date ?? null,
        earningsDays: earnings?.days ?? null,
        hasAlert: cfg.targetPrice !== null,
      };
    }

    const athPct = calcPct(quote.price, ath3y);
    const targetPct = calcPct(quote.price, cfg.targetPrice);

    return {
      id: cfg.id,
      symbol: cfg.symbol,
      name: cfg.name,
      price: quote.price,
      changePct: quote.changePct,
      ath3y,
      athPct,
      targetPrice: cfg.targetPrice,
      targetPct,
      earningsDate: earnings?.date ?? null,
      earningsDays: earnings?.days ?? null,
      hasAlert: cfg.targetPrice !== null,
    };
  });

  return {
    tickers,
    updatedAt: new Date().toISOString(),
    source: "live",
  };
}
