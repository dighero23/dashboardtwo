import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// GET /api/health/dependents — ALL dependents shared with health users
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkPermission(user.id, "can_edit_health")))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("family_dependents")
    .select("id, name, created_by, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const dependents = (data ?? []).map((r) => ({
    id:        r.id,
    name:      r.name,
    createdBy: r.created_by,
    createdAt: r.created_at,
  }));

  return NextResponse.json({ dependents });
}

// POST /api/health/dependents — create shared dependent
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkPermission(user.id, "can_edit_health")))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name } = body;
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("family_dependents")
    .insert({
      name:       name.trim(),
      user_id:    user.id,   // legacy column
      created_by: user.id,   // PRD column
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    id:        data.id,
    name:      data.name,
    createdBy: data.created_by,
    createdAt: data.created_at,
  }, { status: 201 });
}
