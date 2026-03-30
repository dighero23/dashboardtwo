import { NextResponse } from "next/server";
import { fetchAndCachePrices } from "@/lib/buildTickerData";

// POST /api/refresh — public, throttled client-side (60s)
// Fetches fresh prices from Yahoo Finance, writes to price_cache, returns data
export async function POST() {
  try {
    const data = await fetchAndCachePrices();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[POST /api/refresh]", err);
    return NextResponse.json({ error: "Failed to refresh prices" }, { status: 500 });
  }
}
