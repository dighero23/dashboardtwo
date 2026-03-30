import { NextResponse } from "next/server";
import { buildTickerData } from "@/lib/buildTickerData";
import { unstable_cache } from "next/cache";

// Cache the full ticker response for 60 seconds.
// Invalidated by POST /api/refresh via revalidateTag('prices').
const getCachedTickers = unstable_cache(buildTickerData, ["tickers-data"], {
  revalidate: 60,
  tags: ["prices"],
});

export async function GET() {
  try {
    const data = await getCachedTickers();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/tickers] Failed to fetch ticker data:", err);
    return NextResponse.json(
      { error: "Failed to fetch ticker data" },
      { status: 500 }
    );
  }
}
