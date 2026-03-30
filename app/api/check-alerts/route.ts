import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { buildTickerData } from "@/lib/buildTickerData";

// GET /api/check-alerts
// Called by cron-job.org every minute.
// Phase 1b: fetches prices and updates cache. Alert comparison + push notifications added in Phase 1d.
// Secured with CRON_SECRET env var (optional but recommended).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const start = Date.now();

  try {
    // Bust cache so fresh data flows through to the UI on next request
    revalidateTag("prices", "max");

    const data = await buildTickerData();

    const elapsed = Date.now() - start;

    // Phase 1b: log what would trigger — alerts comparison added in Phase 1d
    const triggered = data.tickers.filter(
      (t) =>
        t.targetPrice !== null &&
        t.targetPct !== null &&
        Math.abs(t.targetPct) < 2
    );

    console.log(
      `[check-alerts] Fetched ${data.tickers.length} tickers in ${elapsed}ms. ` +
        `${triggered.length} ticker(s) within 2% of target: ` +
        triggered.map((t) => `${t.symbol} (${t.targetPct?.toFixed(2)}%)`).join(", ")
    );

    return NextResponse.json({
      ok: true,
      updatedAt: data.updatedAt,
      tickersChecked: data.tickers.length,
      nearTarget: triggered.map((t) => ({
        symbol: t.symbol,
        price: t.price,
        target: t.targetPrice,
        targetPct: t.targetPct,
      })),
      elapsedMs: elapsed,
    });
  } catch (err) {
    console.error("[check-alerts] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
