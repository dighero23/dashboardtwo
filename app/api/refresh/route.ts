import { NextResponse } from "next/server";
import { fetchAndCachePrices, buildFromCache } from "@/lib/buildTickerData";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/refresh — throttled client-side (60s)
// Fetches fresh prices for all tickers, then returns the caller's subset.
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await fetchAndCachePrices();
    const data = await buildFromCache(user?.id ?? null);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[POST /api/refresh]", err);
    return NextResponse.json({ error: "Failed to refresh prices" }, { status: 500 });
  }
}
