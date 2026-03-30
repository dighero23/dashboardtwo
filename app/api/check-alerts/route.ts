import { NextRequest, NextResponse } from "next/server";
import { fetchAndCachePrices } from "@/lib/buildTickerData";
import { createAdminClient } from "@/lib/supabase/server";

// GET /api/check-alerts — cron target (cron-job.org, every 1 min)
// 1. Fetch fresh prices → write to price_cache
// 2. Reset alerts whose cooldown_until has passed
// 3. Compare prices vs alert targets → trigger + push (push added in Phase 1d)
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && secret !== "your_random_secret_here") {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const start = Date.now();

  try {
    // 1. Fetch prices + write to price_cache
    const data = await fetchAndCachePrices();

    const db = createAdminClient();
    const nowISO = new Date().toISOString();

    // 2. Reset cooldowns that have expired
    await db
      .from("alerts")
      .update({ status: "active", cooldown_until: null, triggered_at: null })
      .eq("status", "triggered")
      .lt("cooldown_until", nowISO);

    // 3. Fetch all active alerts not in cooldown
    const { data: activeAlerts } = await db
      .from("alerts")
      .select("id, ticker_id, target_price, comment, user_id")
      .eq("status", "active");

    // 4. Build price map by ticker_id
    const priceById = new Map(data.tickers.map((t) => [t.id, t.price]));

    const triggered: string[] = [];

    for (const alert of activeAlerts ?? []) {
      const price = priceById.get(alert.ticker_id);
      if (price === undefined || price === 0) continue;

      const diff = Math.abs(((price - alert.target_price) / alert.target_price) * 100);

      // Trigger if within 2% of target (Phase 1d will send push notifications here)
      if (diff <= 2) {
        // Midnight EST for cooldown
        const midnight = new Date();
        midnight.setUTCHours(5, 0, 0, 0); // 00:00 EST = 05:00 UTC
        if (midnight <= new Date()) midnight.setUTCDate(midnight.getUTCDate() + 1);

        await db
          .from("alerts")
          .update({
            status: "triggered",
            triggered_at: nowISO,
            cooldown_until: midnight.toISOString(),
          })
          .eq("id", alert.id);

        triggered.push(alert.id);

        // TODO Phase 1d: send push notification here
        console.log(
          `[check-alerts] TRIGGERED alert ${alert.id} — price $${price} vs target $${alert.target_price}`
        );
      }
    }

    return NextResponse.json({
      ok: true,
      updatedAt: data.updatedAt,
      tickersChecked: data.tickers.length,
      alertsChecked: activeAlerts?.length ?? 0,
      triggered: triggered.length,
      elapsedMs: Date.now() - start,
    });
  } catch (err) {
    console.error("[check-alerts] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
