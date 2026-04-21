import { NextRequest, NextResponse } from "next/server";
import { getDriverStandings, getConstructorStandings } from "@/lib/jolpica";
import type {
  JolpicaResponse,
  JolpicaDriverStanding,
  JolpicaConstructorStanding,
  StandingsResponse,
  DriverStanding,
  ConstructorStanding,
} from "@/lib/f1/types";

export async function GET(req: NextRequest) {
  const season = req.nextUrl.searchParams.get("season");
  const year = season ? parseInt(season) : ("current" as const);

  if (season && isNaN(Number(season))) {
    return NextResponse.json({ error: "Invalid season" }, { status: 400 });
  }

  try {
    const [driversRaw, constructorsRaw] = await Promise.all([
      getDriverStandings(year),
      getConstructorStandings(year),
    ]);

    const driversData = driversRaw as JolpicaResponse | null;
    const constructorsData = constructorsRaw as JolpicaResponse | null;

    const driversList: JolpicaDriverStanding[] =
      driversData?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];
    const constructorsList: JolpicaConstructorStanding[] =
      constructorsData?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? [];

    const resolvedSeason =
      parseInt(driversData?.MRData?.StandingsTable?.season ?? String(new Date().getFullYear()));

    const drivers: DriverStanding[] = driversList.map((d) => ({
      position: parseInt(d.position),
      driverId: d.Driver.driverId,
      code: d.Driver.code,
      name: `${d.Driver.givenName} ${d.Driver.familyName}`,
      constructorId: d.Constructors[0]?.constructorId ?? "",
      team: d.Constructors[0]?.name ?? "",
      points: parseFloat(d.points),
      wins: parseInt(d.wins),
    }));

    const constructors: ConstructorStanding[] = constructorsList.map((c) => ({
      position: parseInt(c.position),
      constructorId: c.Constructor.constructorId,
      name: c.Constructor.name,
      points: parseFloat(c.points),
      wins: parseInt(c.wins),
    }));

    const response: StandingsResponse = { season: resolvedSeason, drivers, constructors };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[GET /api/f1/standings]", err);
    return NextResponse.json({ error: "Failed to fetch standings" }, { status: 500 });
  }
}
