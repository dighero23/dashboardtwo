import { createAdminClient } from "@/lib/supabase/server";
import { getNextRace } from "@/lib/jolpica";
import { sendPush } from "@/lib/webpush";
import type { JolpicaResponse, JolpicaRace } from "@/lib/f1/types";
import type { StoredSubscription } from "@/lib/webpush";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toUtc(date: string, time?: string): Date | null {
  if (!date) return null;
  const iso = time ? `${date}T${time}` : `${date}T00:00:00Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function inRange(nowMs: number, startMs: number, endMs: number): boolean {
  return nowMs >= startMs && nowMs <= endMs;
}

function isWeekAheadWindow(now: Date, raceUtc: Date): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
  }).format(now);

  const hour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      hour12: false,
    }).format(now),
    10
  );

  const minute = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      minute: "numeric",
    }).format(now),
    10
  );

  if (weekday !== "Monday" || hour !== 12 || minute > 1) return false;

  const daysUntilRace = (raceUtc.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return daysUntilRace >= 6 && daysUntilRace <= 8;
}

function buildNotif(type: string, race: JolpicaRace): { title: string; body: string } {
  const gp = race.raceName.replace(" Grand Prix", " GP");
  switch (type) {
    case "weekAhead":
      return { title: `🏁 ${gp} this week`, body: "Race weekend starts soon. Check the schedule." };
    case "preQuali":
      return { title: `⏱ Qualifying in 1 hour`, body: `${gp} qualifying is about to start.` };
    case "qualiResult":
      return { title: `📋 Qualifying complete`, body: `Check the ${gp} qualifying results.` };
    case "preRace":
      return { title: `🚦 Race in 1 hour`, body: `${gp} race day! Lights out soon.` };
    case "raceResult":
      return { title: `🏁 Race complete`, body: `Check the ${gp} race results.` };
    default:
      return { title: "F1 Update", body: race.raceName };
  }
}

// Maps camelCase fire key → DB column (pref) and DB notification_type (snake_case)
const NOTIF_MAP: Record<string, { prefCol: string; dbType: string }> = {
  weekAhead:   { prefCol: "week_ahead",   dbType: "week_ahead" },
  preQuali:    { prefCol: "pre_quali",    dbType: "pre_quali" },
  qualiResult: { prefCol: "quali_result", dbType: "quali_result" },
  preRace:     { prefCol: "pre_race",     dbType: "pre_race" },
  raceResult:  { prefCol: "race_result",  dbType: "race_result" },
};

// ─── Main export ──────────────────────────────────────────────────────────────

export async function checkF1Notifications(): Promise<void> {
  const raw = await getNextRace();
  if (!raw) return;

  const resp = raw as JolpicaResponse;
  const races = resp.MRData?.RaceTable?.Races;
  if (!races || races.length === 0) return;

  const race = races[0];
  const season = parseInt(race.season, 10);
  const round = parseInt(race.round, 10);

  const raceUtc = toUtc(race.date, race.time);
  const qualiUtc = race.Qualifying ? toUtc(race.Qualifying.date, race.Qualifying.time) : null;

  const now = new Date();
  const nowMs = now.getTime();
  const MIN = 60_000;

  // Determine which notification types fire right now
  const toFire: string[] = [];

  if (raceUtc) {
    // 1 hour before race
    if (inRange(nowMs, raceUtc.getTime() - 61 * MIN, raceUtc.getTime() - 59 * MIN)) {
      toFire.push("preRace");
    }
    // ~100 min after race start (approx race duration)
    if (inRange(nowMs, raceUtc.getTime() + 100 * MIN, raceUtc.getTime() + 102 * MIN)) {
      toFire.push("raceResult");
    }
    // Monday noon CST, race 6–8 days away
    if (isWeekAheadWindow(now, raceUtc)) {
      toFire.push("weekAhead");
    }
  }

  if (qualiUtc) {
    // 1 hour before qualifying
    if (inRange(nowMs, qualiUtc.getTime() - 61 * MIN, qualiUtc.getTime() - 59 * MIN)) {
      toFire.push("preQuali");
    }
    // ~75 min after qualifying start
    if (inRange(nowMs, qualiUtc.getTime() + 75 * MIN, qualiUtc.getTime() + 77 * MIN)) {
      toFire.push("qualiResult");
    }
  }

  if (toFire.length === 0) return;

  const db = createAdminClient();

  // Get all users with F1 notification preferences
  const { data: allPrefs } = await db
    .from("f1_notification_preferences")
    .select("user_id, week_ahead, pre_quali, quali_result, pre_race, race_result");

  if (!allPrefs || allPrefs.length === 0) return;

  for (const prefs of allPrefs) {
    for (const notifType of toFire) {
      const map = NOTIF_MAP[notifType];
      if (!map || !prefs[map.prefCol as keyof typeof prefs]) continue;

      // Insert dedup record using snake_case type — unique constraint prevents double-send
      const { error: insertErr } = await db.from("f1_sent_notifications").insert({
        user_id: prefs.user_id,
        race_season: season,
        race_round: round,
        notification_type: map.dbType,
      });

      // Constraint violation = already sent → skip
      if (insertErr) continue;

      const { title, body } = buildNotif(notifType, race);

      const { data: subs } = await db
        .from("push_subscriptions")
        .select("id, endpoint, keys_p256dh, keys_auth")
        .eq("user_id", prefs.user_id);

      for (const sub of subs ?? []) {
        const ok = await sendPush(sub as StoredSubscription, {
          title,
          body,
          tag: `f1-${map.dbType}-${season}-${round}`,
          url: "/f1",
        });

        if (!ok) {
          await db.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }
  }
}
