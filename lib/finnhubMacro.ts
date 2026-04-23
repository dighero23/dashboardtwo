import { createAdminClient } from "./supabase/server";

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const CALENDAR_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface MacroEvent {
  event: string;
  country: string;
  impact: "high" | "medium" | "low" | string;
  time: string;        // ISO datetime string
  actual: number | null;
  prev: number | null;
  estimate: number | null;
  unit: string | null;
}

/**
 * Fetch upcoming economic calendar events from Finnhub.
 * Filters for US events only; looks 4 weeks ahead.
 */
async function fetchEconomicCalendar(): Promise<MacroEvent[] | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;

  const from = new Date().toISOString().split("T")[0];
  const toDate = new Date();
  toDate.setDate(toDate.getDate() + 28);
  const to = toDate.toISOString().split("T")[0];

  try {
    const res = await fetch(
      `${FINNHUB_BASE}/calendar/economic?from=${from}&to=${to}&token=${key}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;

    const json = await res.json();
    const events: MacroEvent[] = (json?.economicCalendar ?? [])
      .filter((e: { country?: string }) => e.country === "US")
      .map((e: {
        event?: string;
        country?: string;
        impact?: string;
        time?: string;
        actual?: number | null;
        prev?: number | null;
        estimate?: number | null;
        unit?: string | null;
      }) => ({
        event:    e.event    ?? "",
        country:  e.country  ?? "US",
        impact:   e.impact   ?? "low",
        time:     e.time     ?? "",
        actual:   e.actual   ?? null,
        prev:     e.prev     ?? null,
        estimate: e.estimate ?? null,
        unit:     e.unit     ?? null,
      }));

    return events;
  } catch {
    return null;
  }
}

/**
 * Get economic calendar — cache-first with 6-hour TTL.
 */
export async function getEconomicCalendar(): Promise<MacroEvent[]> {
  const db = createAdminClient();
  const cacheKey = "finnhub:economic-calendar";
  const now = new Date();

  const { data: cached } = await db
    .from("macro_cache")
    .select("data, expires_at")
    .eq("cache_key", cacheKey)
    .single();

  if (cached && new Date(cached.expires_at) > now) {
    return cached.data as MacroEvent[];
  }

  const fresh = await fetchEconomicCalendar();
  if (!fresh) return (cached?.data as MacroEvent[]) ?? [];

  const expiresAt = new Date(now.getTime() + CALENDAR_TTL_MS).toISOString();
  await db.from("macro_cache").upsert(
    { cache_key: cacheKey, data: fresh, fetched_at: now.toISOString(), expires_at: expiresAt },
    { onConflict: "cache_key" }
  );

  return fresh;
}

// ── High-impact event filter helpers ─────────────────────────────────────────

const HIGH_IMPACT_KEYWORDS = [
  "nonfarm payroll",
  "cpi",
  "consumer price",
  "pce",
  "personal consumption",
  "gdp",
  "fomc",
  "federal funds",
  "unemployment",
  "retail sales",
  "ism manufacturing",
  "ism services",
];

export function isHighImpactEvent(event: MacroEvent): boolean {
  if (event.impact === "high") return true;
  const lower = event.event.toLowerCase();
  return HIGH_IMPACT_KEYWORDS.some((kw) => lower.includes(kw));
}
