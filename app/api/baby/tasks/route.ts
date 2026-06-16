import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/permissions";

function todayCSTDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkPermission(user.id, "can_edit_baby")))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db    = createAdminClient();
  const today = todayCSTDate();

  const [tasksRes, completionsRes] = await Promise.all([
    db.from("baby_tasks").select("id, name, sort_order").order("sort_order").order("created_at"),
    db.from("baby_task_completions").select("task_id").eq("date_cst", today),
  ]);

  const completedIds = new Set((completionsRes.data ?? []).map((c) => c.task_id));
  const tasks = (tasksRes.data ?? []).map((t) => ({ ...t, completed: completedIds.has(t.id) }));

  return NextResponse.json({ tasks });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkPermission(user.id, "can_edit_baby")))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const db = createAdminClient();

  const { data: maxRow } = await db
    .from("baby_tasks")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sort_order = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await db
    .from("baby_tasks")
    .insert({ name, sort_order })
    .select("id, name, sort_order")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: { ...data, completed: false } });
}
