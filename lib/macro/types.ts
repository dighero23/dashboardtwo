// ─── FRED indicator shapes ────────────────────────────────────────────────────

export interface RatePoint {
  date: string;
  value: number;
}

export interface InflationSeries {
  yoy: number | null;       // latest YoY % change
  date: string;             // date of latest observation
  history: RatePoint[];     // 12-month YoY % history, chronological
}

export interface IndicatorsResponse {
  fedFunds:    { current: number; prev: number | null; date: string } | null;
  cpi:         InflationSeries | null;
  pce:         InflationSeries | null;
  unemployment: { rate: number; date: string } | null;
  treasury10y: { rate: number; date: string } | null;
  treasury2y:  { rate: number; date: string } | null;
  yieldSpread: { spread: number; date: string; history: RatePoint[] } | null;
  vix:         { value: number; date: string } | null;
  updatedAt:   string;
}

// ─── Notification preferences ────────────────────────────────────────────────

export interface MacroNotificationPrefs {
  cpiRelease:  boolean;
  fedDecision: boolean;
  gdpRelease:  boolean;
  jobsReport:  boolean;
  pceRelease:  boolean;
}

// ─── Finnhub economic calendar shapes ────────────────────────────────────────

export interface MacroEvent {
  event:    string;
  country:  string;
  impact:   "high" | "medium" | "low" | string;
  time:     string;           // ISO datetime
  actual:   number | null;
  prev:     number | null;
  estimate: number | null;
  unit:     string | null;
}

export interface EventsResponse {
  events:    MacroEvent[];
  updatedAt: string;
}
