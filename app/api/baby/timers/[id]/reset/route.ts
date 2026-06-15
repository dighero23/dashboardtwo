import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/permissions";

// POST /api/baby/timers/:id/reset
// Updates last_reset_at = now, alert_sent = false, inserts baby_log row
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(user.id, "can_edit_baby");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const now = new Date().toISOString();
  const db = createAdminClient();

  // Fetch timer to get type/name for the log entry
  const { data: timer, error: fetchErr } = await db
    .from("baby_timers")
    .select("id, type, name")
    .eq("id", id)
    .single();

  if (fetchErr || !timer) return NextResponse.json({ error: "Timer not found" }, { status: 404 });

  // Update timer
  const { data: updated, error: updateErr } = await db
    .from("baby_timers")
    .update({ last_reset_at: now, last_reset_by: user.id, alert_sent: false })
    .eq("id", id)
    .select()
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Log the reset event
  await db.from("baby_log").insert({
    timer_id:  id,
    type:      timer.type,
    name:      timer.name,
    logged_at: now,
    logged_by: user.id,
  });

  return NextResponse.json(updated);
}
