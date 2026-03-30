import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { buildTickerData } from "@/lib/buildTickerData";

// POST /api/refresh
// Invalidates the prices cache and returns fresh data.
// The 60s throttle is enforced on the client side.
export async function POST() {
  try {
    // Bust the cache so the next GET /api/tickers fetches fresh data
    revalidateTag("prices", "max");

    // Fetch fresh data immediately and return it
    const data = await buildTickerData();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/refresh] Failed:", err);
    return NextResponse.json(
      { error: "Failed to refresh prices" },
      { status: 500 }
    );
  }
}
