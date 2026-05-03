import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkAdmin } from "@/lib/permissions";
import { sendPush } from "@/lib/webpush";
import type { StoredSubscription } from "@/lib/webpush";

export const dynamic = "force-dynamic";

const MODULE_FILTER: Record<string, string | null> = {
  f1:     "can_edit_f1",
  health: "can_edit_health",
  stocks: "can_edit_stocks",
  macro:  "can_edit_macro",
  all:    null,
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkAdmin(user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { title, message, module: mod = "all" } = body;

  if (!title?.trim() || !message?.trim())
    return NextResponse.json({ error: "title and message are required" }, { status: 400 });
  if (!(mod in MODULE_FILTER))
    return NextResponse.json({ error: "invalid module" }, { status: 400 });

  const db = createAdminClient();
  const permCol = MODULE_FILTER[mod];

  // Get target user IDs
  let q = db.from("user_permissions").select("user_id");
  if (permCol) {
    q = q.or(`${permCol}.eq.true,is_admin.eq.true`) as typeof q;
  }
  const { data: permRows } = await q;
  const userIds = (permRows ?? []).map((r) => r.user_id);

  if (userIds.length === 0)
    return NextResponse.json({ sent: 0, failed: 0 });

  // Get all subscriptions for those users
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("id, user_id, endpoint, keys_p256dh, keys_auth")
    .in("user_id", userIds);

  let sent = 0;
  let failed = 0;

  for (const sub of subs ?? []) {
    const ok = await sendPush(sub as StoredSubscription, {
      title:  title.trim(),
      body:   message.trim(),
      tag:    `broadcast-${Date.now()}`,
      url:    mod !== "all" ? `/${mod}` : "/",
    });
    if (ok) {
      sent++;
    } else {
      failed++;
      await db.from("push_subscriptions").delete().eq("id", sub.id);
    }
  }

  return NextResponse.json({ sent, failed, users: userIds.length });
}
