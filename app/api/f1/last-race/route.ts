import { NextResponse } from "next/server";
import { getLastRace } from "@/lib/jolpica";
import type { JolpicaResponse, LastRaceResponse } from "@/lib/f1/types";

export async function GET() {
  try {
    const raw = await getLastRace();
    if (!raw) return NextResponse.json({ error: "No last race found" }, { status: 404 });

    const data = raw as JolpicaResponse;
    const race = data?.MRData?.RaceTable?.Races?.[0];
    if (!race) return NextResponse.json({ error: "No last race found" }, { status: 404 });

    const response: LastRaceResponse = {
      raceId: `${race.season}-${race.round}`,
      raceName: race.raceName,
      circuitName: race.Circuit.circuitName,
      date: race.date,
      season: parseInt(race.season),
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[GET /api/f1/last-race]", err);
    return NextResponse.json({ error: "Failed to fetch last race" }, { status: 500 });
  }
}
