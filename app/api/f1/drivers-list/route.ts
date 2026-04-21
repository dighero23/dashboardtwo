import { NextResponse } from "next/server";
import { getDriverStandings } from "@/lib/jolpica";
import type { JolpicaResponse, JolpicaDriverStanding, F1Driver } from "@/lib/f1/types";

export async function GET() {
  try {
    const raw = await getDriverStandings("current");
    const data = raw as JolpicaResponse | null;
    const list =
      (data?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? []) as JolpicaDriverStanding[];

    const drivers: F1Driver[] = list.map((d) => ({
      driverId: d.Driver.driverId,
      code: d.Driver.code,
      name: `${d.Driver.givenName} ${d.Driver.familyName}`,
    }));

    return NextResponse.json({ drivers });
  } catch (err) {
    console.error("[GET /api/f1/drivers-list]", err);
    return NextResponse.json({ error: "Failed to fetch drivers list" }, { status: 500 });
  }
}
