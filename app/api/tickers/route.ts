import { NextRequest, NextResponse } from "next/server";
import { buildFromCache } from "@/lib/buildTickerData";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/tickers — public; returns the authed user's tickers, or admin's public set
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const data = await buildFromCache(user?.id ?? null);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[GET /api/tickers]", err);
    return NextResponse.json({ error: "Failed to fetch tickers" }, { status: 500 });
  }
}

// POST /api/tickers — requires auth (any logged-in user manages their own watchlist)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const symbol: string = (body.symbol ?? "").toUpperCase().trim();
  const name: string = (body.name ?? "").trim();

  if (!symbol) return NextResponse.json({ error: "symbol is required" }, { status: 400 });

  const db = createAdminClient();

  // Enforce 50-ticker limit per user
  const { count } = await db
    .from("tickers")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) >= 50) {
    return NextResponse.json({ error: "Ticker limit reached (max 50)" }, { status: 400 });
  }

  // Max sort_order for this user
  const { data: maxRow } = await db
    .from("tickers")
    .select("sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const sortOrder = (maxRow?.sort_order ?? 0) + 1;

  const { data, error } = await db
    .from("tickers")
    .insert({ symbol, name: name || null, sort_order: sortOrder, user_id: user.id })
    .select()
    .single();

  if (error) {
    const msg = error.code === "23505"
      ? `${symbol} is already in your watchlist`
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
