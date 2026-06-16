import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/permissions";

async function getAuthedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkPermission(user.id, "can_edit_baby")))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { data } = await db
    .from("baby_growth")
    .select("*")
    .order("measured_on", { ascending: false })
    .order("created_at", { ascending: false });

  return NextResponse.json({ measurements: data ?? [] });
}

export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkPermission(user.id, "can_edit_baby")))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { measured_on, weight_oz, height_cm, notes } = await req.json();

  if (!measured_on)
    return NextResponse.json({ error: "measured_on is required" }, { status: 400 });
  if (weight_oz == null && height_cm == null)
    return NextResponse.json({ error: "weight or height required" }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("baby_growth")
    .insert({
      measured_on,
      weight_oz:  weight_oz  ?? null,
      height_cm:  height_cm  ?? null,
      notes:      notes?.trim() || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ measurement: data }, { status: 201 });
}
