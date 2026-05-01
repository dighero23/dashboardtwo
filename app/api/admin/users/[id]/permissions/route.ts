import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkAdmin } from "@/lib/permissions";

const ALLOWED_KEYS = ["is_admin", "can_edit_stocks", "can_edit_f1", "can_edit_macro", "can_edit_health"] as const;
type AllowedKey = (typeof ALLOWED_KEYS)[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await checkAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: targetUserId } = await params;
  const body = await req.json();

  const update: Partial<Record<AllowedKey, boolean>> = {};
  for (const key of ALLOWED_KEYS) {
    if (typeof body[key] === "boolean") update[key] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("user_permissions")
    .upsert(
      { user_id: targetUserId, ...update, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    .select("user_id, is_admin, can_edit_stocks, can_edit_f1, can_edit_macro, can_edit_health")
    .single();

  if (error) return NextResponse.json({ error: "Failed to update permissions" }, { status: 500 });
  return NextResponse.json(data);
}
