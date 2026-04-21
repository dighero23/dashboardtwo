import { NextResponse } from "next/server";
import { getLastRace } from "@/lib/jolpica";
import type { JolpicaResponse, JolpicaResult } from "@/lib/f1/types";

interface ResultRow {
  position: number;
  driver: string;
  driverId: string;
  code: string;
  constructorId: string;
  team: string;
  grid: number;
  laps: number;
  status: string;
  fastestLap: string | null;
  isFastestLap: boolean;
}

interface LastRaceDetailResponse {
  raceId: string;
  raceName: string;
  circuitName: string;
  location: string;
  date: string;
  season: number;
  round: number;
  results: ResultRow[];
  poleDriver: string | null;
}

export async function GET() {
  try {
    const raw = await getLastRace();
    if (!raw) return NextResponse.json({ error: "No last race found" }, { status: 404 });

    const data = raw as JolpicaResponse;
    const race = data?.MRData?.RaceTable?.Races?.[0];
    if (!race) return NextResponse.json({ error: "No last race found" }, { status: 404 });

    const jolpicaResults: JolpicaResult[] = race.Results ?? [];

    const results: ResultRow[] = jolpicaResults.map((r) => ({
      position: parseInt(r.position),
      driver: `${r.Driver.givenName} ${r.Driver.familyName}`,
      driverId: r.Driver.driverId,
      code: r.Driver.code,
      constructorId: r.Constructor.constructorId,
      team: r.Constructor.name,
      grid: parseInt(r.grid),
      laps: parseInt(r.laps),
      status: r.status,
      fastestLap: r.FastestLap?.Time.time ?? null,
      isFastestLap: r.FastestLap?.rank === "1",
    }));

    const poleDriver = results.find((r) => r.grid === 1)?.driver ?? null;

    const response: LastRaceDetailResponse = {
      raceId: `${race.season}-${race.round}`,
      raceName: race.raceName,
      circuitName: race.Circuit.circuitName,
      location: `${race.Circuit.Location.locality}, ${race.Circuit.Location.country}`,
      date: race.date,
      season: parseInt(race.season),
      round: parseInt(race.round),
      results,
      poleDriver,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[GET /api/f1/last-race/detail]", err);
    return NextResponse.json({ error: "Failed to fetch race detail" }, { status: 500 });
  }
}
