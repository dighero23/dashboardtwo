import { NextRequest, NextResponse } from "next/server";
import { buildFromCache } from "@/lib/buildTickerData";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// GET /api/tickers — public, reads from Supabase price_cache
export async function GET() {
  try {
    const data = await buildFromCache();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[GET /api/tickers]", err);
    return NextResponse.json({ error: "Failed to fetch tickers" }, { status: 500 });
  }
}

// POST /api/tickers — authenticated, adds a new ticker
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const symbol: string = (body.symbol ?? "").toUpperCase().trim();
  const name: string = (body.name ?? "").trim();

  if (!symbol) return NextResponse.json({ error: "symbol is required" }, { status: 400 });

  const db = createAdminClient();

  // Get current max sort_order
  const { data: maxRow } = await db
    .from("tickers")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const sortOrder = (maxRow?.sort_order ?? 0) + 1;

  const { data, error } = await db
    .from("tickers")
    .insert({ symbol, name: name || null, sort_order: sortOrder })
    .select()
    .single();

  if (error) {
    const msg = error.code === "23505"
      ? `Ticker ${symbol} already exists`
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
