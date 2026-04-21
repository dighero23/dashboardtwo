import { NextRequest, NextResponse } from "next/server";
import { getConstructorSeasonResults, getConstructorStandings } from "@/lib/jolpica";
import type { JolpicaResponse, JolpicaConstructorStanding, TeamStats } from "@/lib/f1/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: constructorId } = await params;

  try {
    const [resultsRaw, standingsRaw] = await Promise.all([
      getConstructorSeasonResults(constructorId, "current"),
      getConstructorStandings("current"),
    ]);

    const resultsData = resultsRaw as JolpicaResponse | null;
    const allRaces = resultsData?.MRData?.RaceTable?.Races ?? [];

    let wins = 0, podiums = 0, poles = 0, oneTwo = 0;

    // Group results by round to detect 1-2 finishes
    const roundResults = new Map<string, { positions: number[]; grids: number[] }>();

    for (const race of allRaces) {
      const entry = roundResults.get(race.round) ?? { positions: [], grids: [] };
      for (const r of race.Results ?? []) {
        const pos = parseInt(r.position);
        entry.positions.push(pos);
        entry.grids.push(parseInt(r.grid));
      }
      roundResults.set(race.round, entry);
    }

    for (const { positions, grids } of roundResults.values()) {
      if (positions.includes(1)) wins++;
      if (positions.some((p) => p <= 3)) podiums++;
      if (grids.includes(1)) poles++;
      if (positions.includes(1) && positions.includes(2)) oneTwo++;
    }

    // Find position + points from standings
    const standingsData = standingsRaw as JolpicaResponse | null;
    const standingsList =
      standingsData?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? [];
    const standing = (standingsList as JolpicaConstructorStanding[]).find(
      (s) => s.Constructor.constructorId === constructorId
    );

    const response: TeamStats = {
      wins,
      podiums,
      poles,
      oneTwo,
      position: parseInt(standing?.position ?? "0"),
      points: parseFloat(standing?.points ?? "0"),
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error(`[GET /api/f1/team/${constructorId}/stats]`, err);
    return NextResponse.json({ error: "Failed to fetch team stats" }, { status: 500 });
  }
}
