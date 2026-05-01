import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// PATCH /api/health/dependents/:id — rename (creator only)
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
  const body = await req.json();

  const update: Record<string, unknown> = {};
  if (typeof body.name === "string") update.name = body.name.trim();

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("family_dependents")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

// DELETE /api/health/dependents/:id — creator or admin; cascades events
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

  const { data: dep } = await db
    .from("family_dependents")
    .select("id, created_by")
    .eq("id", id)
    .single();

  if (!dep) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = await checkPermission(user.id, "is_admin");
  if (dep.created_by !== user.id && !isAdmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Cascade: delete all events for this dependent first
  await db.from("health_events").delete().eq("dependent_id", id);

  const { error } = await db.from("family_dependents").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
