import { NextRequest, NextResponse } from "next/server";
import { checkBabyTimers } from "@/lib/baby/checkBabyTimers";

// GET /api/baby/check-timers — cron target (every 1-2 min via cron-job.org)
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await checkBabyTimers();
  return NextResponse.json({ ok: true, ...result });
}
