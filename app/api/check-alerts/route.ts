import { NextRequest, NextResponse } from "next/server";
import { fetchAndCachePrices } from "@/lib/buildTickerData";
import { createAdminClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/webpush";

// GET /api/check-alerts — cron target (cron-job.org, every 1 min)
// 1. Fetch fresh prices → write to price_cache
// 2. Reset alerts whose cooldown_until has passed
// 3. Compare prices vs alert targets → trigger + send push notification
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

    // 4. Build price + symbol maps by ticker_id
    const priceById = new Map(data.tickers.map((t) => [t.id, t.price]));
    const symbolById = new Map(data.tickers.map((t) => [t.id, t.symbol]));

    const triggered: string[] = [];

    for (const alert of activeAlerts ?? []) {
      const price = priceById.get(alert.ticker_id);
      if (price === undefined || price === 0) continue;

      const pctDiff = ((price - alert.target_price) / alert.target_price) * 100;
      const absDiff = Math.abs(pctDiff);

      // Trigger if within 2% of target
      if (absDiff <= 2) {
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

        const symbol = symbolById.get(alert.ticker_id) ?? "Unknown";
        const direction = pctDiff >= 0 ? "above" : "below";
        const sign = pctDiff >= 0 ? "+" : "";

        console.log(
          `[check-alerts] TRIGGERED alert ${alert.id} — ${symbol} $${price} vs target $${alert.target_price}`
        );

        // Send push notification to all subscriptions for this user
        const { data: subs } = await db
          .from("push_subscriptions")
          .select("id, endpoint, keys_p256dh, keys_auth")
          .eq("user_id", alert.user_id);

        for (const sub of subs ?? []) {
          const ok = await sendPush(sub, {
            title: `🔔 ${symbol} near target`,
            body: `$${price.toFixed(2)} — ${sign}${pctDiff.toFixed(1)}% ${direction} target $${alert.target_price.toFixed(2)}${alert.comment ? ` · ${alert.comment}` : ""}`,
            tag: `alert-${alert.id}`,
            url: "/stocks",
          });

          // Subscription expired — remove it
          if (!ok) {
            await db.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
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
