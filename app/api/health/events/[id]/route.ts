import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// PATCH /api/health/events/:id — edit own events OR shared dependent events
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkPermission(user.id, "can_edit_health")))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const db = createAdminClient();

  const { data: existing } = await db
    .from("health_events")
    .select("id, user_id, for_type")
    .eq("id", id)
    .single();

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.user_id !== user.id && existing.for_type !== "dependent")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const fieldMap: Record<string, string> = {
    eventType:   "event_type",
    eventDate:   "event_date",
    eventTime:   "event_time",
    dependentId: "dependent_id",
    alert1Week:  "alert_1_week",
    alert1Day:   "alert_1_day",
  };
  for (const [camel, snake] of Object.entries(fieldMap)) {
    if (camel in body) update[snake] = body[camel];
  }
  for (const key of ["title", "notes", "status"]) {
    if (key in body) update[key] = body[key];
  }

  if (Object.keys(update).length === 1)
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });

  const { data, error } = await db
    .from("health_events")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/health/events/:id — delete own events OR shared dependent events
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkPermission(user.id, "can_edit_health")))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const db = createAdminClient();

  const { data: existing } = await db
    .from("health_events")
    .select("id, user_id, for_type")
    .eq("id", id)
    .single();

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.user_id !== user.id && existing.for_type !== "dependent")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await db.from("health_events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
