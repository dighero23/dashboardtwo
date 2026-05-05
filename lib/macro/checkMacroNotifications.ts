import { createAdminClient } from "@/lib/supabase/server";
import { getEconomicCalendar } from "@/lib/finnhubMacro";
import { sendPush } from "@/lib/webpush";
import type { StoredSubscription } from "@/lib/webpush";
import type { MacroEvent } from "./types";

// ─── Event → notification type mapping ───────────────────────────────────────

interface NotifEntry {
  prefCol: string;
  dbType:  string;
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

function buildNotif(notifKey: string, event: MacroEvent): { title: string; body: string } {
  const hasEst = event.estimate != null;
  const est = hasEst ? ` · Est ${event.estimate?.toFixed(1)}${event.unit ?? ""}` : "";

  switch (notifKey) {
    case "cpiRelease":
      return { title: "📊 CPI report in 1 hour", body: `${event.event}${est}` };
    case "fedDecision":
      return { title: "🏦 FOMC decision in 1 hour", body: "Fed rate decision coming up." };
    case "gdpRelease":
      return { title: "📈 GDP report in 1 hour", body: `${event.event}${est}` };
    case "jobsReport":
      return { title: "💼 Jobs report in 1 hour", body: `${event.event}${est}` };
    case "pceRelease":
      return { title: "📊 PCE report in 1 hour", body: `${event.event}${est}` };
    default:
      return { title: "📊 Economic report in 1 hour", body: event.event };
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function checkMacroNotifications(): Promise<void> {
  const events = await getEconomicCalendar();
  if (events.length === 0) return;

  const now = new Date();
  const nowMs = now.getTime();
  const MIN = 60_000;

  // Events firing in the 54–66-minute pre-event window.
  // Wide enough for a 5-minute cron (guarantees at least one hit); dedup prevents double-send.
  const toNotify = events.filter((e) => {
    if (!e.time) return false;
    const eventMs = new Date(e.time).getTime();
    const minsUntil = (eventMs - nowMs) / MIN;
    return minsUntil >= 54 && minsUntil <= 66;
  });

  if (toNotify.length === 0) return;

  const db = createAdminClient();

  const { data: allPrefs } = await db
    .from("macro_notification_preferences")
    .select("user_id, cpi_release, fed_decision, gdp_release, jobs_report, pce_release");

  if (!allPrefs || allPrefs.length === 0) return;

  for (const event of toNotify) {
    const notifKey = classifyEvent(event);
    if (!notifKey) continue;

    const entry = NOTIF_MAP[notifKey];
    const eventDate = event.time.slice(0, 10);

    for (const prefs of allPrefs) {
      if (!prefs[entry.prefCol as keyof typeof prefs]) continue;

      // Insert dedup record — constraint prevents double-send
      const { error: insertErr } = await db.from("macro_sent_notifications").insert({
        user_id:           prefs.user_id,
        event_date:        eventDate,
        notification_type: entry.dbType,
      });

      if (insertErr) continue; // already sent

      const { title, body } = buildNotif(notifKey, event);

      const { data: subs } = await db
        .from("push_subscriptions")
        .select("id, endpoint, keys_p256dh, keys_auth")
        .eq("user_id", prefs.user_id);

      for (const sub of subs ?? []) {
        const ok = await sendPush(sub as StoredSubscription, {
          title,
          body,
          tag:  `macro-${entry.dbType}-${eventDate}`,
          url:  "/macro",
        });

        if (!ok) {
          await db.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }
  }
}
