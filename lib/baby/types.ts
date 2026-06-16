export interface BabyProfile {
  id: string;
  name: string | null;
  date_of_birth: string | null;
  sex: "male" | "female" | null;
  created_at: string;
}

export interface GrowthMeasurement {
  id: string;
  measured_on: string;
  weight_oz: number | null;
  height_cm: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

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
