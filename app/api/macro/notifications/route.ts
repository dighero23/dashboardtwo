import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/permissions";
import type { MacroNotificationPrefs } from "@/lib/macro/types";

const DEFAULTS: MacroNotificationPrefs = {
  cpiRelease:  true,
  fedDecision: true,
  gdpRelease:  false,
  jobsReport:  true,
  pceRelease:  false,
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
    .from("macro_notification_preferences")
    .select("cpi_release, fed_decision, gdp_release, jobs_report, pce_release")
    .eq("user_id", user.id)
    .single();

  if (!data) return NextResponse.json(DEFAULTS);

  const prefs: MacroNotificationPrefs = {
    cpiRelease:  data.cpi_release,
    fedDecision: data.fed_decision,
    gdpRelease:  data.gdp_release,
    jobsReport:  data.jobs_report,
    pceRelease:  data.pce_release,
  };

  return NextResponse.json(prefs);
}

export async function PATCH(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canEdit = await checkPermission(user.id, "can_edit_macro");
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as Partial<MacroNotificationPrefs>;

  const db = createAdminClient();
  const { error } = await db.from("macro_notification_preferences").upsert(
    {
      user_id:      user.id,
      cpi_release:  body.cpiRelease  ?? DEFAULTS.cpiRelease,
      fed_decision: body.fedDecision ?? DEFAULTS.fedDecision,
      gdp_release:  body.gdpRelease  ?? DEFAULTS.gdpRelease,
      jobs_report:  body.jobsReport  ?? DEFAULTS.jobsReport,
      pce_release:  body.pceRelease  ?? DEFAULTS.pceRelease,
      updated_at:   new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
