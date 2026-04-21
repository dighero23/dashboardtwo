// ─── Raw Jolpica/Ergast API shapes ────────────────────────────────────────────

export interface JolpicaSession {
  date: string;
  time: string;
}

export interface JolpicaCircuit {
  circuitId: string;
  circuitName: string;
  Location: { lat: string; long: string; locality: string; country: string };
}

export interface JolpicaDriver {
  driverId: string;
  code: string;
  givenName: string;
  familyName: string;
}

export interface JolpicaConstructor {
  constructorId: string;
  name: string;
}

export interface JolpicaFastestLap {
  rank: string;
  lap: string;
  Time: { time: string };
}

export interface JolpicaResult {
  position: string;
  grid: string;
  laps: string;
  status: string;
  Driver: JolpicaDriver;
  Constructor: JolpicaConstructor;
  FastestLap?: JolpicaFastestLap;
}

export interface JolpicaRace {
  season: string;
  round: string;
  raceName: string;
  Circuit: JolpicaCircuit;
  date: string;
  time?: string;
  FirstPractice?: JolpicaSession;
  SecondPractice?: JolpicaSession;
  ThirdPractice?: JolpicaSession;
  Qualifying?: JolpicaSession;
  Sprint?: JolpicaSession;
  SprintQualifying?: JolpicaSession;
  Results?: JolpicaResult[];
}

export interface JolpicaDriverStanding {
  position: string;
  points: string;
  wins: string;
  Driver: JolpicaDriver;
  Constructors: JolpicaConstructor[];
}

export interface JolpicaConstructorStanding {
  position: string;
  points: string;
  wins: string;
  Constructor: JolpicaConstructor;
}

export interface JolpicaMRData {
  RaceTable?: { season: string; Races: JolpicaRace[] };
  StandingsTable?: {
    season: string;
    StandingsLists: {
      season: string;
      round: string;
      DriverStandings?: JolpicaDriverStanding[];
      ConstructorStandings?: JolpicaConstructorStanding[];
    }[];
  };
  DriverTable?: { Drivers: JolpicaDriver[] };
  ConstructorTable?: { Constructors: JolpicaConstructor[] };
}

export interface JolpicaResponse {
  MRData: JolpicaMRData;
}

// ─── Our transformed API response types ───────────────────────────────────────

export interface F1Session {
  name: string;
  dateUtc: string;     // ISO UTC date-time string
  highlight: boolean;
}

export interface F1LapRecord {
  time: string;
  driver: string;
  year: number;
}

export interface F1Winner {
  driver: string;
  constructorId: string;
  team: string;
}

export interface F1Weather {
  tempC: number;
  rainPct: number;
  condition: string;
}

export interface NextRaceResponse {
  round: number;
  raceName: string;
  circuitId: string;
  circuitName: string;
  location: string;
  raceDateUtc: string;
  sessions: F1Session[];
  lapRecord: F1LapRecord | null;
  lastWinner: F1Winner | null;
  weather: F1Weather | null;
}

export interface LastRaceResponse {
  raceId: string;      // "{season}-{round}"
  raceName: string;
  circuitName: string;
  date: string;
  season: number;
}

export interface UpcomingRace {
  round: number;
  raceName: string;
  circuitName: string;
  location: string;
  date: string;
}

export interface UpcomingResponse {
  races: UpcomingRace[];
}

export interface DriverStanding {
  position: number;
  driverId: string;
  code: string;
  name: string;
  constructorId: string;
  team: string;
  points: number;
  wins: number;
}

export interface ConstructorStanding {
  position: number;
  constructorId: string;
  name: string;
  points: number;
  wins: number;
}

export interface StandingsResponse {
  season: number;
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
}

export interface DriverStats {
  wins: number;
  podiums: number;
  poles: number;
  dnfs: number;
  position: number;
  points: number;
  team: string;
  constructorId: string;
}

export interface TeamStats {
  wins: number;
  podiums: number;
  poles: number;
  oneTwo: number;
  position: number;
  points: number;
}

export interface F1Driver {
  driverId: string;
  code: string;
  name: string;
}

export interface F1Team {
  constructorId: string;
  name: string;
}

export interface F1NotificationPrefs {
  weekAhead: boolean;
  preQuali: boolean;
  qualiResult: boolean;
  preRace: boolean;
  raceResult: boolean;
}
