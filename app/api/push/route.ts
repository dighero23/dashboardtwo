import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// GET /api/push — returns { subscribed: boolean } for the authenticated user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ subscribed: false });

  const db = createAdminClient();
  const { count } = await db
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return NextResponse.json({ subscribed: (count ?? 0) > 0 });
}

// POST /api/push — save a push subscription for the authenticated user
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { endpoint, keys } = body as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const db = createAdminClient();

  // Delete existing row for this endpoint (upsert by endpoint)
  await db
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  const { error } = await db.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint,
    keys_p256dh: keys.p256dh,
    keys_auth: keys.auth,
  });

  if (error) {
    console.error("[push POST] insert error:", error.message);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/push — remove push subscription(s) for the authenticated user
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const endpoint = body?.endpoint as string | undefined;

  const db = createAdminClient();
  if (endpoint) {
    await db.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
  } else {
    await db.from("push_subscriptions").delete().eq("user_id", user.id);
  }

  return NextResponse.json({ ok: true });
}
