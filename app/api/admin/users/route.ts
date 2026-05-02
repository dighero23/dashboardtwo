import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkAdmin } from "@/lib/permissions";

const DEFAULT_PERMS = {
  is_admin: false,
  can_edit_stocks: false,
  can_edit_f1: false,
  can_edit_macro: false,
  can_edit_health: false,
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await checkAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = createAdminClient();

  const { data: { users }, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) return NextResponse.json({ error: "Failed to list users" }, { status: 500 });

  const { data: permsRows } = await db
    .from("user_permissions")
    .select("user_id, is_admin, can_edit_stocks, can_edit_f1, can_edit_macro, can_edit_health");

  const permsMap = new Map((permsRows ?? []).map((p) => [p.user_id, p]));

  const result = users.map((u) => {
    const p = permsMap.get(u.id);
    return {
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      permissions: p
        ? {
            is_admin:        p.is_admin,
            can_edit_stocks: p.can_edit_stocks,
            can_edit_f1:     p.can_edit_f1,
            can_edit_macro:  p.can_edit_macro,
            can_edit_health: p.can_edit_health,
          }
        : DEFAULT_PERMS,
    };
  });

  return NextResponse.json({ users: result });
}
