const FINNHUB_BASE = "https://finnhub.io/api/v1";

function daysUntil(isoDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(isoDate);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Fetch the next earnings date for a single symbol.
 * Looks 6 months ahead. Returns null if no key configured or on failure.
 */
export async function fetchNextEarnings(
  symbol: string
): Promise<{ date: string; days: number } | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;

  const from = new Date().toISOString().split("T")[0];
  const toDate = new Date();
  toDate.setMonth(toDate.getMonth() + 6);
  const to = toDate.toISOString().split("T")[0];

  try {
    const res = await fetch(
      `${FINNHUB_BASE}/calendar/earnings?from=${from}&to=${to}&symbol=${symbol}&token=${key}`,
      { next: { revalidate: 86400 } } // cache for 24h
    );
    if (!res.ok) return null;

    const data = await res.json();
    const calendar: { date: string }[] = data?.earningsCalendar ?? [];

    if (calendar.length === 0) return null;

    // First entry is the soonest upcoming earnings
    const earningsDate = calendar[0].date;
    const days = daysUntil(earningsDate);

    // Skip if it's in the past
    if (days < 0) return null;

    return { date: earningsDate, days };
  } catch {
    return null;
  }
}

/**
 * Fetch next earnings for all symbols sequentially to respect rate limits.
 * Finnhub free tier: 60 calls/min. With 10 tickers cached daily, no risk.
 */
export async function fetchAllEarnings(
  symbols: string[]
): Promise<Record<string, { date: string; days: number } | null>> {
  const result: Record<string, { date: string; days: number } | null> = {};

  for (const symbol of symbols) {
    result[symbol] = await fetchNextEarnings(symbol);
  }

  return result;
}
