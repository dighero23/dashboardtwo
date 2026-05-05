import { createAdminClient } from "@/lib/supabase/server";
import { getEconomicCalendar } from "@/lib/finnhubMacro";
import { sendPush } from "@/lib/webpush";
import type { StoredSubscription } from "@/lib/webpush";
import type { MacroEvent } from "./types";

// ─── Event → notification type mapping ───────────────────────────────────────

interface NotifEntry {
  prefCol:  string;
  dbType:   string;
  keywords: string[];
}

const NOTIF_MAP: Record<string, NotifEntry> = {
  cpiRelease:  { prefCol: "cpi_release",  dbType: "cpi_release",  keywords: ["cpi", "consumer price index"] },
  fedDecision: { prefCol: "fed_decision", dbType: "fed_decision", keywords: ["fomc", "federal funds rate", "fed interest rate", "interest rate decision", "fed rate decision", "monetary policy statement", "federal reserve"] },
  gdpRelease:  { prefCol: "gdp_release",  dbType: "gdp_release",  keywords: ["gdp", "gross domestic product"] },
  jobsReport:  { prefCol: "jobs_report",  dbType: "jobs_report",  keywords: ["nonfarm payroll", "nfp", "employment situation", "employment change"] },
  pceRelease:  { prefCol: "pce_release",  dbType: "pce_release",  keywords: ["pce", "personal consumption expenditures", "personal spending"] },
};

function classifyEvent(event: MacroEvent): string | null {
  const lower = event.event.toLowerCase();
  for (const [key, entry] of Object.entries(NOTIF_MAP)) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return key;
  }
  return null;
}

function fmtEventDate(isoTime: string): string {
  return new Date(isoTime).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month:   "short",
    day:     "numeric",
  });
}

type Timing = "hour" | "week";

function buildNotif(notifKey: string, event: MacroEvent, timing: Timing): { title: string; body: string } {
  const hasEst  = event.estimate != null;
  const est     = hasEst ? ` · Est ${event.estimate?.toFixed(1)}${event.unit ?? ""}` : "";
  const dateStr = fmtEventDate(event.time);

  if (timing === "week") {
    switch (notifKey) {
      case "cpiRelease":
        return { title: "📊 CPI report in 1 week",  body: `Scheduled for ${dateStr} · ~8:30am ET${est}` };
      case "fedDecision":
        return { title: "🏦 FOMC decision in 1 week", body: `Fed rate decision on ${dateStr} · ~2pm ET` };
      case "gdpRelease":
        return { title: "📈 GDP report in 1 week",  body: `Scheduled for ${dateStr} · ~8:30am ET${est}` };
      case "jobsReport":
        return { title: "💼 Jobs report in 1 week",  body: `Scheduled for ${dateStr} · ~8:30am ET${est}` };
      case "pceRelease":
        return { title: "📊 PCE report in 1 week",  body: `Scheduled for ${dateStr} · ~8:30am ET${est}` };
      default:
        return { title: "📊 Economic report in 1 week", body: `Scheduled for ${dateStr}` };
    }
  }

  // 1-hour-before notifications
  switch (notifKey) {
    case "cpiRelease":
      return { title: "📊 CPI report in 1 hour",  body: `${event.event}${est}` };
    case "fedDecision":
      return { title: "🏦 FOMC decision in 1 hour", body: "Fed rate decision coming up." };
    case "gdpRelease":
      return { title: "📈 GDP report in 1 hour",  body: `${event.event}${est}` };
    case "jobsReport":
      return { title: "💼 Jobs report in 1 hour",  body: `${event.event}${est}` };
    case "pceRelease":
      return { title: "📊 PCE report in 1 hour",  body: `${event.event}${est}` };
    default:
      return { title: "📊 Economic report in 1 hour", body: event.event };
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

const MIN      = 60_000;
const WEEK_MIN = 7 * 24 * 60; // 10 080 minutes

export async function checkMacroNotifications(): Promise<void> {
  const events = await getEconomicCalendar();
  if (events.length === 0) return;

  const now   = new Date();
  const nowMs = now.getTime();

  // Collect events that fall within either notification window.
  // 12-minute windows guarantee a hit with a 5-minute cron; dedup prevents double-send.
  type TimedEvent = { event: MacroEvent; timing: Timing };
  const toNotify: TimedEvent[] = [];

  for (const e of events) {
    if (!e.time) continue;
    const minsUntil = (new Date(e.time).getTime() - nowMs) / MIN;
    if (minsUntil >= 54 && minsUntil <= 66) {
      toNotify.push({ event: e, timing: "hour" });
    } else if (minsUntil >= WEEK_MIN - 6 && minsUntil <= WEEK_MIN + 6) {
      toNotify.push({ event: e, timing: "week" });
    }
  }

  if (toNotify.length === 0) return;

  const db = createAdminClient();

  const { data: allPrefs } = await db
    .from("macro_notification_preferences")
    .select("user_id, cpi_release, fed_decision, gdp_release, jobs_report, pce_release");

  if (!allPrefs || allPrefs.length === 0) return;

  for (const { event, timing } of toNotify) {
    const notifKey = classifyEvent(event);
    if (!notifKey) continue;

    const entry     = NOTIF_MAP[notifKey];
    const eventDate = event.time.slice(0, 10);
    // Use distinct dbType per timing so dedup allows both sends for the same event
    const dbType    = timing === "week" ? `${entry.dbType}_week` : entry.dbType;

    for (const prefs of allPrefs) {
      if (!prefs[entry.prefCol as keyof typeof prefs]) continue;

      // Insert dedup record — unique constraint (user_id, event_date, notification_type) prevents double-send
      const { error: insertErr } = await db.from("macro_sent_notifications").insert({
        user_id:           prefs.user_id,
        event_date:        eventDate,
        notification_type: dbType,
      });

      if (insertErr) continue; // already sent

      const { title, body } = buildNotif(notifKey, event, timing);

      const { data: subs } = await db
        .from("push_subscriptions")
        .select("id, endpoint, keys_p256dh, keys_auth")
        .eq("user_id", prefs.user_id);

      for (const sub of subs ?? []) {
        const ok = await sendPush(sub as StoredSubscription, {
          title,
          body,
          tag: `macro-${dbType}-${eventDate}`,
          url: "/macro",
        });

        if (!ok) {
          await db.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }
  }
}
