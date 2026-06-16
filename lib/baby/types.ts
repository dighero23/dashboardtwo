export interface BabyTimer {
  id: string;
  type: "bottle" | "poop" | "medication";
  name: string | null;
  interval_minutes: number;
  last_reset_at: string;
  last_reset_by: string | null;
  alert_sent: boolean;
  created_at: string;
}

export interface BabyLogEntry {
  id: string;
  timer_id: string;
  type: "bottle" | "poop" | "medication";
  name: string | null;
  logged_at: string;
  logged_by: string | null;
}
