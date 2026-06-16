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
  const { data } = await db.from("baby_profile").select("*").limit(1).maybeSingle();
  return NextResponse.json({ profile: data ?? null });
}

export async function PATCH(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkPermission(user.id, "can_edit_baby")))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const db   = createAdminClient();

  const { data: existing } = await db.from("baby_profile").select("id").limit(1).maybeSingle();

  let data;
  if (existing) {
    const res = await db.from("baby_profile").update(body).eq("id", existing.id).select().single();
    data = res.data;
  } else {
    const res = await db.from("baby_profile").insert(body).select().single();
    data = res.data;
  }
  return NextResponse.json({ profile: data });
}
