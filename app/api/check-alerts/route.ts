import { NextRequest, NextResponse } from "next/server";
import { fetchAndCachePrices } from "@/lib/buildTickerData";
import { createAdminClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/webpush";
import { checkF1Notifications } from "@/lib/f1/checkF1Notifications";
import { checkMacroNotifications } from "@/lib/macro/checkMacroNotifications";
import { checkHealthNotifications } from "@/lib/health/checkHealthNotifications";

// GET /api/check-alerts — cron target (cron-job.org, every 1 min)
// 1. Fetch fresh prices → write to price_cache
// 2. Reset alerts whose cooldown_until has passed
// 3. Compare prices vs alert targets → trigger + send push notification
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
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
        // Midnight America/New_York for cooldown — handles EST/EDT automatically
        const now = new Date();
        // NY wall-clock time as a plain Date (wrong absolute value, right local digits)
        const nyNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
        // ms to add to NY local time to get UTC (positive in winter, positive in summer, different values)
        const nyOffsetMs = now.getTime() - nyNow.getTime();
        // Roll to tomorrow midnight in NY local time
        const tomorrowNYLocal = new Date(nyNow);
        tomorrowNYLocal.setDate(tomorrowNYLocal.getDate() + 1);
        tomorrowNYLocal.setHours(0, 0, 0, 0);
        const midnight = new Date(tomorrowNYLocal.getTime() + nyOffsetMs);

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

    // 5. Check F1 push notifications (non-blocking — errors don't fail the cron)
    await checkF1Notifications().catch((err) =>
      console.error("[check-alerts] F1 notifications error:", err)
    );

    // 6. Check macro push notifications (non-blocking)
    await checkMacroNotifications().catch((err) =>
      console.error("[check-alerts] Macro notifications error:", err)
    );

    // 7. Check health push notifications (non-blocking)
    await checkHealthNotifications().catch((err) =>
      console.error("[check-alerts] Health notifications error:", err)
    );

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
