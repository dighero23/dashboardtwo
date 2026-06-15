import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/permissions";

// GET /api/baby/log?date=today  (defaults to today CST)
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await checkPermission(user.id, "can_edit_baby");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Determine date range in CST (UTC-6)
  const dateParam = req.nextUrl.searchParams.get("date");
  let startUTC: Date;
  let endUTC: Date;

  if (dateParam && dateParam !== "today") {
    // dateParam expected as YYYY-MM-DD local
    const [y, m, d] = dateParam.split("-").map(Number);
    startUTC = new Date(Date.UTC(y, m - 1, d, 6, 0, 0));   // midnight CST = 06:00 UTC
    endUTC   = new Date(Date.UTC(y, m - 1, d + 1, 6, 0, 0));
  } else {
    // Today in CST
    const nowCST = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }));
    const y = nowCST.getFullYear(), m = nowCST.getMonth(), d = nowCST.getDate();
    startUTC = new Date(Date.UTC(y, m, d, 6, 0, 0));
    endUTC   = new Date(Date.UTC(y, m, d + 1, 6, 0, 0));
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("baby_log")
    .select("*")
    .gte("logged_at", startUTC.toISOString())
    .lt("logged_at", endUTC.toISOString())
    .order("logged_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data ?? [] });
}
