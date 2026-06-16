import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/permissions";

function todayCSTDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkPermission(user.id, "can_edit_baby")))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: taskId } = await params;
  const db    = createAdminClient();
  const today = todayCSTDate();

  const { data: existing } = await db
    .from("baby_task_completions")
    .select("id")
    .eq("task_id", taskId)
    .eq("date_cst", today)
    .maybeSingle();

  if (existing) {
    await db.from("baby_task_completions").delete().eq("id", existing.id);
    return NextResponse.json({ completed: false });
  }

  await db.from("baby_task_completions").insert({ task_id: taskId, date_cst: today });
  return NextResponse.json({ completed: true });
}
