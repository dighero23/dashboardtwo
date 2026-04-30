import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkAdmin } from "@/lib/permissions";

// DELETE /api/tickers/:id — requires ownership (or admin)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = createAdminClient();

  // Verify ownership (admins may delete any ticker)
  const { data: ticker } = await db
    .from("tickers")
    .select("user_id")
    .eq("id", id)
    .single();

  if (!ticker) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = ticker.user_id === user.id;
  if (!isOwner && !(await checkAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await db.from("tickers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
