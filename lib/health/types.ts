export type EventType   = "vaccine" | "appointment" | "study" | "other";
export type EventStatus = "scheduled" | "pending" | "completed" | "cancelled";
export type ForType     = "self" | "dependent";

export interface Dependent {
  id:        string;
  name:      string;
  createdBy: string;
  createdAt: string;
}

export interface HealthEvent {
  id:            string;
  userId:        string;
  forType:       ForType;
  dependentId:   string | null;
  dependentName: string | null;
  title:         string;
  eventType:     EventType;
  eventDate:     string;
  eventTime:     string | null;
  notes:         string | null;
  status:        EventStatus;
  completedDate: string | null;
  alert1Week:    boolean;
  alert1Day:     boolean;
  createdAt:     string;
  updatedAt:     string;
}

export interface HealthEventsResponse {
  events: HealthEvent[];
}

export interface DependentsResponse {
  dependents: Dependent[];
}
