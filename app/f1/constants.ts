export const TEAM_COLORS: Record<string, string> = {
  mclaren:       "#ff8000",
  ferrari:       "#dc0000",
  red_bull:      "#4169e1",
  mercedes:      "#00d2be",
  aston_martin:  "#229971",
  alpine:        "#0093cc",
  williams:      "#64c4ff",
  haas:          "#b6babd",
  sauber:        "#52e252",
  kick_sauber:   "#52e252",
  rb:            "#6692ff",
  alphatauri:    "#6692ff",
  racing_bulls:  "#6692ff",
};

export const F1_ACCENT = "#fbbf24";

export type Timezone = "CST" | "EST" | "LOCAL";

const TZ_IANA: Record<Timezone, string | undefined> = {
  CST:   "America/Chicago",
  EST:   "America/New_York",
  LOCAL: undefined,
};

export function getTeamColor(constructorId: string): string {
  return TEAM_COLORS[constructorId?.toLowerCase()] ?? "#94a3b8";
}

export function formatSessionTime(
  utcDateStr: string,
  timezone: Timezone
): { day: string; time: string } {
  const date = new Date(utcDateStr);
  const tz = TZ_IANA[timezone];
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  }).format(date);
  return { day, time };
}

export function formatSessionDate(utcDateStr: string, timezone: Timezone): string {
  const date = new Date(utcDateStr);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: TZ_IANA[timezone],
  }).format(date);
}

// dateStr = "YYYY-MM-DD"
export function formatRaceDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00Z");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
