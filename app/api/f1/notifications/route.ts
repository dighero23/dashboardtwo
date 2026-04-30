import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/permissions";
import type { F1NotificationPrefs } from "@/lib/f1/types";

const DEFAULTS: F1NotificationPrefs = {
  weekAhead: true,
  preQuali: true,
  qualiResult: true,
  preRace: true,
  raceResult: false,
};

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { data } = await db
    .from("f1_notification_preferences")
    .select("week_ahead, pre_quali, quali_result, pre_race, race_result")
    .eq("user_id", user.id)
    .single();

  if (!data) return NextResponse.json(DEFAULTS);

  const prefs: F1NotificationPrefs = {
    weekAhead: data.week_ahead,
    preQuali: data.pre_quali,
    qualiResult: data.quali_result,
    preRace: data.pre_race,
    raceResult: data.race_result,
  };

  return NextResponse.json(prefs);
}

export async function PATCH(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canEdit = await checkPermission(user.id, "can_edit_f1");
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as Partial<F1NotificationPrefs>;

  const db = createAdminClient();
  const { error } = await db.from("f1_notification_preferences").upsert(
    {
      user_id: user.id,
      week_ahead:   body.weekAhead   ?? DEFAULTS.weekAhead,
      pre_quali:    body.preQuali    ?? DEFAULTS.preQuali,
      quali_result: body.qualiResult ?? DEFAULTS.qualiResult,
      pre_race:     body.preRace     ?? DEFAULTS.preRace,
      race_result:  body.raceResult  ?? DEFAULTS.raceResult,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
