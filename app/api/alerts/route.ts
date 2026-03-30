import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// GET /api/alerts — authenticated, returns all alerts for the current user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("alerts")
    .select("*, tickers(symbol, name)")
    .eq("user_id", user.id)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/alerts — authenticated, creates a new alert
// Body: { ticker_id, target_price, comment? }
// Implements unified alert/target model:
//   - If this is the first alert for the ticker → is_display_target = true
//   - Otherwise → is_display_target = false (user can promote via PATCH)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { ticker_id, target_price, comment } = body;

  if (!ticker_id || target_price === undefined) {
    return NextResponse.json({ error: "ticker_id and target_price are required" }, { status: 400 });
  }
  if (isNaN(Number(target_price)) || Number(target_price) <= 0) {
    return NextResponse.json({ error: "target_price must be a positive number" }, { status: 400 });
  }

  const db = createAdminClient();

  // Check if this ticker already has any alerts for this user
  const { count } = await db
    .from("alerts")
    .select("*", { count: "exact", head: true })
    .eq("ticker_id", ticker_id)
    .eq("user_id", user.id);

  const isDisplayTarget = (count ?? 0) === 0; // first alert → auto display target

  const { data, error } = await db
    .from("alerts")
    .insert({
      ticker_id,
      user_id: user.id,
      target_price: Number(target_price),
      comment: comment?.trim() || null,
      is_display_target: isDisplayTarget,
      status: "active",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
