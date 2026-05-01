import { createAdminClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/webpush";
import type { StoredSubscription } from "@/lib/webpush";

// ─── Chicago timezone helpers (DST-safe via Intl) ────────────────────────────

function chicagoHour(now: Date): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hour12: false }).format(now),
    10
  );
}

function chicagoMinute(now: Date): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", minute: "numeric" }).format(now),
    10
  );
}

function chicagoWeekday(now: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "long" }).format(now);
}

function chicagoDateStr(now: Date): string {
  // Returns YYYY-MM-DD in Chicago timezone
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(now);
}

function isAt12pmCST(now: Date): boolean {
  return chicagoHour(now) === 12 && chicagoMinute(now) <= 1;
}

function daysUntil(eventDate: string, todayStr: string): number {
  const [ey, em, ed] = eventDate.split("-").map(Number);
  const [ty, tm, td] = todayStr.split("-").map(Number);
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
}

function fmtDate(isoDate: string): string {
  return new Date(isoDate + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function checkHealthNotifications(): Promise<void> {
  const now = new Date();

  // Health notifications only fire at 12pm CST (same window as other modules)
  if (!isAt12pmCST(now)) return;

  const today      = chicagoDateStr(now);
  const isMonday   = chicagoWeekday(now) === "Monday";
  const db         = createAdminClient();

  // Load all pending events that have at least one alert enabled
  const { data: events } = await db
    .from("health_events")
    .select(`
      id, user_id, for_type, dependent_id,
      title, event_date,
      alert_1_week, alert_1_day,
      family_dependents ( name )
    `)
    .neq("status", "completed");

  if (!events || events.length === 0) return;

  // All users with health permission — needed for dependent fan-out
  const { data: healthUsers } = await db
    .from("user_permissions")
    .select("user_id")
    .or("can_edit_health.eq.true,is_admin.eq.true");

  const allHealthUserIds = (healthUsers ?? []).map((u) => u.user_id);

  for (const event of events) {
    const eventDate = event.event_date;
    if (!eventDate) continue;

    const days = daysUntil(eventDate, today);

    // Skip overdue events and events too far away to matter
    if (days < 0) continue;

    const alert1Week = event.alert_1_week !== false; // default true if NULL (pre-migration rows)
    const alert1Day  = event.alert_1_day  !== false;

    // Determine which notification types fire right now for this event
    type NotifType = "week_before" | "day_before";
    const toFire: NotifType[] = [];

    // 1-week-before: Monday 12pm CST, event is 1–7 days away
    if (isMonday && alert1Week && days >= 1 && days <= 7) {
      toFire.push("week_before");
    }

    // 1-day-before: 12pm CST any day, event is tomorrow
    if (alert1Day && days === 1) {
      toFire.push("day_before");
    }

    if (toFire.length === 0) continue;

    // Determine recipient list
    const forType = event.for_type ?? "self";
    const recipientIds: string[] =
      forType === "dependent" ? allHealthUserIds : [event.user_id];

    const depEntry = Array.isArray(event.family_dependents)
      ? event.family_dependents[0]
      : (event.family_dependents as { name: string } | null);
    const personName = depEntry?.name ?? null;
    const eventTitle = event.title ?? "Health event";
    const formattedDate = fmtDate(eventDate);

    for (const notifType of toFire) {
      const isWeek = notifType === "week_before";
      const title  = isWeek
        ? `Reminder: ${eventTitle}`
        : `Tomorrow: ${eventTitle}`;
      const body   = personName
        ? `For ${personName} — ${formattedDate}`
        : formattedDate;

      for (const userId of recipientIds) {
        // Dedup: insert first — unique constraint on (user_id, event_id, notification_type)
        const { error: dedupErr } = await db
          .from("health_sent_notifications")
          .insert({ user_id: userId, event_id: event.id, notification_type: notifType });

        if (dedupErr) continue; // already sent

        const { data: subs } = await db
          .from("push_subscriptions")
          .select("id, endpoint, keys_p256dh, keys_auth")
          .eq("user_id", userId);

        for (const sub of subs ?? []) {
          const ok = await sendPush(sub as StoredSubscription, {
            title,
            body,
            tag: `health-${event.id}-${notifType}`,
            url: "/health",
          });
          if (!ok) {
            await db.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      }
    }
  }
}
