import { createAdminClient } from "@/lib/supabase/server";

const BASE = "https://api.jolpi.ca/ergast/f1";

const TTL = {
  SCHEDULE: 86400,
  RACE_DETAIL: 3600,
  STANDINGS_CURRENT: 3600,
  STANDINGS_PAST: 365 * 86400,
  CIRCUIT_INFO: 365 * 86400,
} as const;

async function getCached(key: string): Promise<unknown | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("f1_cache")
    .select("data, expires_at")
    .eq("cache_key", key)
    .single();

  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  return data.data;
}

async function setCache(key: string, data: unknown, ttl: number): Promise<void> {
  const db = createAdminClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttl * 1000);
  await db.from("f1_cache").upsert(
    {
      cache_key: key,
      data,
      fetched_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    },
    { onConflict: "cache_key" }
  );
}

async function jolpicaGet(path: string, cacheKey: string, ttl: number): Promise<unknown | null> {
  const cached = await getCached(cacheKey);
  if (cached !== null) return cached;

  try {
    const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    await setCache(cacheKey, json, ttl);
    return json;
  } catch {
    return null;
  }
}

export async function getLastRace(): Promise<unknown | null> {
  return jolpicaGet("/current/last/results.json", "last-race:current", TTL.RACE_DETAIL);
}

export async function getNextRace(): Promise<unknown | null> {
  return jolpicaGet("/current/next.json", "next-race:current", TTL.RACE_DETAIL);
}

export async function getSeasonSchedule(year: number | "current" = "current"): Promise<unknown | null> {
  return jolpicaGet(`/${year}.json`, `schedule:${year}`, TTL.SCHEDULE);
}

export async function getDriverStandings(year: number | "current" = "current"): Promise<unknown | null> {
  const ttl = year === "current" ? TTL.STANDINGS_CURRENT : TTL.STANDINGS_PAST;
  return jolpicaGet(`/${year}/driverStandings.json`, `standings:drivers:${year}`, ttl);
}

export async function getConstructorStandings(year: number | "current" = "current"): Promise<unknown | null> {
  const ttl = year === "current" ? TTL.STANDINGS_CURRENT : TTL.STANDINGS_PAST;
  return jolpicaGet(`/${year}/constructorStandings.json`, `standings:constructors:${year}`, ttl);
}

export async function getDriverSeasonResults(
  driverId: string,
  year: number | "current" = "current"
): Promise<unknown | null> {
  return jolpicaGet(
    `/${year}/drivers/${driverId}/results.json`,
    `driver-stats:${driverId}:${year}`,
    TTL.RACE_DETAIL
  );
}

export async function getConstructorSeasonResults(
  constructorId: string,
  year: number | "current" = "current"
): Promise<unknown | null> {
  return jolpicaGet(
    `/${year}/constructors/${constructorId}/results.json`,
    `constructor-stats:${constructorId}:${year}`,
    TTL.RACE_DETAIL
  );
}

export async function getCircuitLastWinner(
  circuitId: string,
  year: number
): Promise<unknown | null> {
  return jolpicaGet(
    `/${year}/circuits/${circuitId}/results/1.json`,
    `circuit-winner:${circuitId}:${year}`,
    TTL.CIRCUIT_INFO
  );
}

export async function invalidateCacheByPrefix(keyPrefix: string): Promise<void> {
  const db = createAdminClient();
  await db
    .from("f1_cache")
    .update({ expires_at: new Date().toISOString() })
    .like("cache_key", `${keyPrefix}%`);
}
