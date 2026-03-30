import YahooFinanceClass from "yahoo-finance2";

// yahoo-finance2 v3+ is class-based
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yahooFinance = new (YahooFinanceClass as any)({
  suppressNotices: ["yahooSurvey"],
});

export interface QuoteResult {
  symbol: string;
  price: number;
  changePct: number;
}

/**
 * Fetch current quotes for a list of Yahoo Finance symbols.
 * Failures for individual symbols are silently skipped.
 */
export async function fetchQuotes(yahooSymbols: string[]): Promise<QuoteResult[]> {
  const results = await Promise.allSettled(
    yahooSymbols.map((sym) => yahooFinance.quote(sym))
  );

  const quotes: QuoteResult[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = result.value as any;
      const price: number | undefined = q?.regularMarketPrice;
      const changePct: number = q?.regularMarketChangePercent ?? 0;
      if (price !== undefined && price !== null) {
        quotes.push({ symbol: yahooSymbols[i], price, changePct });
      }
    }
  });
  return quotes;
}

/**
 * Fetch the 3-year all-time high for a single symbol using monthly historical data.
 * Returns null on failure.
 */
export async function fetchAth3y(yahooSymbol: string): Promise<number | null> {
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const historical: any[] = await yahooFinance.historical(yahooSymbol, {
      period1: threeYearsAgo,
      interval: "1mo",
    });

    if (!historical || historical.length === 0) return null;

    const ath = Math.max(...historical.map((d) => d.high ?? d.close ?? 0));
    return ath > 0 ? ath : null;
  } catch {
    return null;
  }
}

/**
 * Fetch 3yr ATH for all symbols in parallel.
 * Individual failures return null for that symbol.
 */
export async function fetchAllAth(yahooSymbols: string[]): Promise<Record<string, number | null>> {
  const results = await Promise.allSettled(
    yahooSymbols.map((sym) => fetchAth3y(sym))
  );

  const athMap: Record<string, number | null> = {};
  results.forEach((result, i) => {
    athMap[yahooSymbols[i]] = result.status === "fulfilled" ? result.value : null;
  });
  return athMap;
}
