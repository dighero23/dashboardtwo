import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPermissions } from "@/lib/permissions";

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

  const perms = await getPermissions(user.id);
  return NextResponse.json(
    perms ?? { user_id: user.id, ...DEFAULT_PERMS }
  );
}
