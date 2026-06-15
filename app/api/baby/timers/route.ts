import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/permissions";

async function getAuthedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// GET /api/baby/timers — all timers ordered: bottle first, then medications
export async function GET() {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(user.id, "can_edit_baby");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("baby_timers")
    .select("*")
    .order("type", { ascending: true }) // 'bottle' < 'medication'
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ timers: data ?? [] });
}

// POST /api/baby/timers — create a medication timer
export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(user.id, "can_edit_baby");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, interval_minutes } = body as { name: string; interval_minutes: number };

  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!interval_minutes || interval_minutes < 1) return NextResponse.json({ error: "interval_minutes required" }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("baby_timers")
    .insert({ type: "medication", name: name.trim(), interval_minutes, last_reset_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
