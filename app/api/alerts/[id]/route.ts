import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// PATCH /api/alerts/:id — authenticated
// Accepts: { target_price?, comment?, is_display_target? }
// If setting is_display_target=true → clears it on all other alerts for the same ticker
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const db = createAdminClient();

  // Verify ownership
  const { data: existing } = await db
    .from("alerts")
    .select("id, ticker_id, user_id")
    .eq("id", id)
    .single();

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Build update payload
  const update: Record<string, unknown> = {};
  if (body.target_price !== undefined) update.target_price = Number(body.target_price);
  if (body.comment !== undefined) update.comment = body.comment?.trim() || null;
  if (body.is_display_target === true) {
    // Demote all other alerts for this ticker first
    await db
      .from("alerts")
      .update({ is_display_target: false })
      .eq("ticker_id", existing.ticker_id)
      .eq("user_id", user.id)
      .neq("id", id);
    update.is_display_target = true;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await db
    .from("alerts")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

// DELETE /api/alerts/:id — authenticated
// If the deleted alert was the display target → auto-promote the next alert
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = createAdminClient();

  // Verify ownership and get alert details
  const { data: existing } = await db
    .from("alerts")
    .select("id, ticker_id, user_id, is_display_target")
    .eq("id", id)
    .single();

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await db.from("alerts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // If we just deleted the display target, auto-promote the next oldest alert
  if (existing.is_display_target) {
    const { data: remaining } = await db
      .from("alerts")
      .select("id")
      .eq("ticker_id", existing.ticker_id)
      .eq("user_id", user.id)
      .order("created_at")
      .limit(1);

    if (remaining && remaining.length > 0) {
      await db
        .from("alerts")
        .update({ is_display_target: true })
        .eq("id", remaining[0].id);
    }
  }

  return NextResponse.json({ ok: true });
}
