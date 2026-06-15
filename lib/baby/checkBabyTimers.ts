import { createAdminClient } from "@/lib/supabase/server";
import { sendPush, type StoredSubscription } from "@/lib/webpush";

const ALERT_LEAD_MINUTES = 20;

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

export async function checkBabyTimers(): Promise<{ checked: number; notified: number }> {
  const db = createAdminClient();
  const now = new Date();

  // 1. Fetch all timers
  const { data: timers } = await db
    .from("baby_timers")
    .select("id, type, name, interval_minutes, last_reset_at, alert_sent");

  if (!timers?.length) return { checked: 0, notified: 0 };

  // 2. Fetch all users with can_edit_baby permission
  const { data: permitted } = await db
    .from("user_permissions")
    .select("user_id")
    .eq("can_edit_baby", true);

  const userIds = (permitted ?? []).map((r) => r.user_id as string);
  if (!userIds.length) return { checked: timers.length, notified: 0 };

  // 3. Fetch push subscriptions for all permitted users
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("id, user_id, endpoint, keys_p256dh, keys_auth")
    .in("user_id", userIds);

  const subsByUser = new Map<string, (StoredSubscription & { user_id: string })[]>();
  for (const sub of subs ?? []) {
    const list = subsByUser.get(sub.user_id) ?? [];
    list.push(sub);
    subsByUser.set(sub.user_id, list);
  }

  let notified = 0;

  for (const timer of timers) {
    const dueAt = new Date(new Date(timer.last_reset_at).getTime() + timer.interval_minutes * 60_000);
    const minutesUntilDue = (dueAt.getTime() - now.getTime()) / 60_000;

    // Fire if within ALERT_LEAD_MINUTES of due time, alert not already sent
    if (minutesUntilDue > ALERT_LEAD_MINUTES || minutesUntilDue < 0) continue;
    if (timer.alert_sent) continue;

    const label = timer.type === "bottle" ? "Milk" : (timer.name ?? "Medicine");
    const lastAtStr = fmtTime(timer.last_reset_at);
    const title = `${label} due in ~${Math.round(minutesUntilDue)} min`;
    const body  = `Last at ${lastAtStr}`;

    for (const userId of userIds) {
      // Check dedup — has this alert already been sent for this cycle?
      const { data: existing } = await db
        .from("baby_sent_notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("timer_id", timer.id)
        .eq("cycle_reset_at", timer.last_reset_at)
        .maybeSingle();

      if (existing) continue;

      const userSubs = subsByUser.get(userId) ?? [];
      for (const sub of userSubs) {
        const ok = await sendPush(sub, {
          title,
          body,
          tag: `baby-${timer.id}`,
          url: "/baby",
        });
        if (!ok) {
          // Subscription expired — remove it
          await db.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }

      // Record sent (even if no subs, so we don't retry this cycle)
      await db.from("baby_sent_notifications").insert({
        user_id:        userId,
        timer_id:       timer.id,
        cycle_reset_at: timer.last_reset_at,
      });

      notified++;
    }

    // Mark alert_sent on the timer
    await db.from("baby_timers").update({ alert_sent: true }).eq("id", timer.id);
  }

  return { checked: timers.length, notified };
}
