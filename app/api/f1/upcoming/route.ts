import { NextResponse } from "next/server";
import { getSeasonSchedule } from "@/lib/jolpica";
import type { JolpicaResponse, JolpicaRace, UpcomingResponse } from "@/lib/f1/types";

export async function GET() {
  try {
    const raw = await getSeasonSchedule("current");
    if (!raw) return NextResponse.json({ races: [] } satisfies UpcomingResponse);

    const data = raw as JolpicaResponse;
    const allRaces: JolpicaRace[] = data?.MRData?.RaceTable?.Races ?? [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the index of the "next" race (first race with date >= today)
    const nextIdx = allRaces.findIndex((r) => new Date(r.date) >= today);
    if (nextIdx === -1) return NextResponse.json({ races: [] } satisfies UpcomingResponse);

    // Return 3 races after the next one
    const upcoming = allRaces.slice(nextIdx + 1, nextIdx + 4);

    const response: UpcomingResponse = {
      races: upcoming.map((r) => ({
        round: parseInt(r.round),
        raceName: r.raceName,
        circuitName: r.Circuit.circuitName,
        location: `${r.Circuit.Location.locality}, ${r.Circuit.Location.country}`,
        date: r.date,
      })),
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[GET /api/f1/upcoming]", err);
    return NextResponse.json({ error: "Failed to fetch upcoming races" }, { status: 500 });
  }
}
