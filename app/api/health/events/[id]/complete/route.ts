import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// PATCH /api/health/events/:id/complete — mark event completed with actual date
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
  const body = await req.json().catch(() => ({}));
  const completedDate = body.completedDate ?? null;
  const notes         = body.notes ?? null;
  const now           = new Date().toISOString();

  const db = createAdminClient();

  // Verify: own event OR dependent event (shared)
  const { data: existing } = await db
    .from("health_events")
    .select("id, user_id, for_type")
    .eq("id", id)
    .single();

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.user_id !== user.id && existing.for_type !== "dependent") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const update: Record<string, unknown> = {
    status:     "completed",
    updated_at: now,
    completed_date: completedDate ?? existing, // fallback handled below
  };

  // If no completedDate provided, use the event's scheduled date
  if (!completedDate) {
    const { data: ev } = await db
      .from("health_events")
      .select("event_date")
      .eq("id", id)
      .single();
    update.completed_date = ev?.event_date ?? now.slice(0, 10);
  } else {
    update.completed_date = completedDate;
  }

  if (notes) update.notes = notes;

  const { data, error } = await db
    .from("health_events")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
