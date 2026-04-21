import { NextRequest, NextResponse } from "next/server";
import { getDriverSeasonResults, getDriverStandings } from "@/lib/jolpica";
import type { JolpicaResponse, JolpicaResult, JolpicaDriverStanding, DriverStats } from "@/lib/f1/types";

function isDnf(status: string): boolean {
  if (status === "Finished") return false;
  if (/^\+\d+ Lap/.test(status)) return false;
  return true;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: driverId } = await params;

  try {
    const [resultsRaw, standingsRaw] = await Promise.all([
      getDriverSeasonResults(driverId, "current"),
      getDriverStandings("current"),
    ]);

    const resultsData = resultsRaw as JolpicaResponse | null;
    const allRaces = resultsData?.MRData?.RaceTable?.Races ?? [];

    let wins = 0, podiums = 0, poles = 0, dnfs = 0;

    for (const race of allRaces) {
      const r: JolpicaResult | undefined = race.Results?.[0];
      if (!r) continue;
      const pos = parseInt(r.position);
      if (pos === 1) wins++;
      if (pos <= 3) podiums++;
      if (r.grid === "1") poles++;
      if (isDnf(r.status)) dnfs++;
    }

    // Find position + points from standings
    const standingsData = standingsRaw as JolpicaResponse | null;
    const standingsList = standingsData?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];
    const standing = (standingsList as JolpicaDriverStanding[]).find(
      (s) => s.Driver.driverId === driverId
    );

    const response: DriverStats = {
      wins,
      podiums,
      poles,
      dnfs,
      position: parseInt(standing?.position ?? "0"),
      points: parseFloat(standing?.points ?? "0"),
      team: standing?.Constructors?.[0]?.name ?? "",
      constructorId: standing?.Constructors?.[0]?.constructorId ?? "",
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error(`[GET /api/f1/driver/${driverId}/stats]`, err);
    return NextResponse.json({ error: "Failed to fetch driver stats" }, { status: 500 });
  }
}
