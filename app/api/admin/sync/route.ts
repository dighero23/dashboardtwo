import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkAdmin } from "@/lib/permissions";
import { fetchAndCachePrices } from "@/lib/buildTickerData";

export const dynamic = "force-dynamic";

const MODULES = ["f1", "stocks", "macro", "health", "all"] as const;
type SyncMod = typeof MODULES[number];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkAdmin(user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const mod: SyncMod = body.module ?? "all";
  if (!(MODULES as readonly string[]).includes(mod))
    return NextResponse.json({ error: "invalid module" }, { status: 400 });

  const db = createAdminClient();
  const now = new Date().toISOString();
  const result: Record<string, number | string> = {};

  if (mod === "f1" || mod === "all") {
    const { data } = await db
      .from("f1_cache")
      .update({ expires_at: now })
      .gte("cache_key", "")
      .select("cache_key");
    result.f1 = data?.length ?? 0;
  }

  if (mod === "stocks" || mod === "all") {
    try {
      await fetchAndCachePrices();
      result.stocks = "refreshed";
    } catch {
      result.stocks = "error";
    }
  }

  if (mod === "macro" || mod === "all") {
    const { data } = await db
      .from("macro_cache")
      .update({ expires_at: now })
      .gte("cache_key", "")
      .select("cache_key");
    result.macro = data?.length ?? 0;
  }

  if (mod === "health" || mod === "all") {
    result.health = 0;
  }

  return NextResponse.json({ ok: true, result });
}
