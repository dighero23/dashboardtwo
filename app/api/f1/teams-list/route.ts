import { NextResponse } from "next/server";
import { getConstructorStandings } from "@/lib/jolpica";
import type { JolpicaResponse, JolpicaConstructorStanding, F1Team } from "@/lib/f1/types";

export async function GET() {
  try {
    const raw = await getConstructorStandings("current");
    const data = raw as JolpicaResponse | null;
    const list =
      (data?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? []) as JolpicaConstructorStanding[];

    const teams: F1Team[] = list.map((c) => ({
      constructorId: c.Constructor.constructorId,
      name: c.Constructor.name,
    }));

    return NextResponse.json({ teams });
  } catch (err) {
    console.error("[GET /api/f1/teams-list]", err);
    return NextResponse.json({ error: "Failed to fetch teams list" }, { status: 500 });
  }
}
