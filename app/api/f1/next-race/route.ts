import { NextResponse } from "next/server";
import { getNextRace, getCircuitLastWinner } from "@/lib/jolpica";
import { getCircuitWeather } from "@/lib/weather";
import type {
  JolpicaResponse,
  JolpicaRace,
  JolpicaResult,
  NextRaceResponse,
  F1Session,
  F1LapRecord,
  F1Winner,
} from "@/lib/f1/types";

function extractSessions(race: JolpicaRace): F1Session[] {
  const s = (name: string, date: string, time: string, highlight: boolean): F1Session => ({
    name,
    dateUtc: `${date}T${time}`,
    highlight,
  });

  const sessions: F1Session[] = [];
  if (race.FirstPractice)    sessions.push(s("Practice 1",        race.FirstPractice.date,    race.FirstPractice.time,    false));
  if (race.SecondPractice)   sessions.push(s("Practice 2",        race.SecondPractice.date,   race.SecondPractice.time,   false));
  if (race.SprintQualifying) sessions.push(s("Sprint Qualifying", race.SprintQualifying.date, race.SprintQualifying.time, false));
  if (race.Sprint)           sessions.push(s("Sprint",            race.Sprint.date,           race.Sprint.time,           false));
  if (race.ThirdPractice)    sessions.push(s("Practice 3",        race.ThirdPractice.date,    race.ThirdPractice.time,    false));
  if (race.Qualifying)       sessions.push(s("Qualifying",        race.Qualifying.date,       race.Qualifying.time,       true));
  sessions.push(s("Race", race.date, race.time ?? "00:00:00Z", true));

  return sessions;
}

function extractLapRecord(results: JolpicaResult[], year: number): F1LapRecord | null {
  const holder = results.find((r) => r.FastestLap?.rank === "1");
  if (!holder?.FastestLap) return null;
  return {
    time: holder.FastestLap.Time.time,
    driver: holder.Driver.familyName,
    year,
  };
}

function extractWinner(results: JolpicaResult[]): F1Winner | null {
  const winner = results.find((r) => r.position === "1");
  if (!winner) return null;
  return {
    driver: winner.Driver.familyName,
    constructorId: winner.Constructor.constructorId,
    team: winner.Constructor.name,
  };
}

export async function GET() {
  try {
    const raw = await getNextRace();
    if (!raw) return NextResponse.json({ error: "No upcoming race found" }, { status: 404 });

    const data = raw as JolpicaResponse;
    const race = data?.MRData?.RaceTable?.Races?.[0];
    if (!race) return NextResponse.json({ error: "No upcoming race found" }, { status: 404 });

    const circuitId = race.Circuit.circuitId;
    const prevYear = parseInt(race.season) - 1;

    // Fetch last winner + weather in parallel
    const [prevRaceRaw, weather] = await Promise.all([
      getCircuitLastWinner(circuitId, prevYear),
      getCircuitWeather(circuitId, race.date),
    ]);

    let lapRecord: F1LapRecord | null = null;
    let lastWinner: F1Winner | null = null;

    if (prevRaceRaw) {
      const prevData = prevRaceRaw as JolpicaResponse;
      const prevResults = prevData?.MRData?.RaceTable?.Races?.[0]?.Results ?? [];
      lapRecord = extractLapRecord(prevResults, prevYear);
      lastWinner = extractWinner(prevResults);
    }

    const response: NextRaceResponse = {
      round: parseInt(race.round),
      raceName: race.raceName,
      circuitId,
      circuitName: race.Circuit.circuitName,
      location: `${race.Circuit.Location.locality}, ${race.Circuit.Location.country}`,
      raceDateUtc: `${race.date}T${race.time ?? "00:00:00Z"}`,
      sessions: extractSessions(race),
      lapRecord,
      lastWinner,
      weather,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[GET /api/f1/next-race]", err);
    return NextResponse.json({ error: "Failed to fetch next race" }, { status: 500 });
  }
}
