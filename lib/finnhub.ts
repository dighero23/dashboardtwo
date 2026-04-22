const FINNHUB_BASE = "https://finnhub.io/api/v1";

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
      { cache: 'no-store' }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const calendar: { date: string }[] = data?.earningsCalendar ?? [];

    if (calendar.length === 0) return null;

    // Sort ascending — Finnhub usually returns chronological order but be explicit
    calendar.sort((a, b) => a.date.localeCompare(b.date));
    const earningsDate = calendar[0].date;

    // Use UTC-based comparison to avoid DST / server-timezone surprises
    const [ey, em, ed] = earningsDate.slice(0, 10).split("-").map(Number);
    const earningsMs = Date.UTC(ey, em - 1, ed);
    const todayMs = Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate()
    );

    // Date already passed → we don't know the next earnings yet
    if (earningsMs < todayMs) return null;

    const days = Math.round((earningsMs - todayMs) / 86_400_000);
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
