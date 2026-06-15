import { NextRequest, NextResponse } from "next/server";
import { checkF1Notifications } from "@/lib/f1/checkF1Notifications";
import { checkMacroNotifications } from "@/lib/macro/checkMacroNotifications";
import { checkHealthNotifications } from "@/lib/health/checkHealthNotifications";

// GET /api/check-alerts — cron target (cron-job.org, every 1 min)
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
    await checkF1Notifications().catch((err) =>
      console.error("[check-alerts] F1 notifications error:", err)
    );
    await checkMacroNotifications().catch((err) =>
      console.error("[check-alerts] Macro notifications error:", err)
    );
    await checkHealthNotifications().catch((err) =>
      console.error("[check-alerts] Health notifications error:", err)
    );

    return NextResponse.json({ ok: true, elapsedMs: Date.now() - start });
  } catch (err) {
    console.error("[check-alerts] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
