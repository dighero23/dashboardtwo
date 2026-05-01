import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { seedMag7ForUser, buildFromCache } from "@/lib/buildTickerData";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/tickers/seed — seeds Mag7 for first-time users with an empty watchlist
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { count } = await db
    .from("tickers")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  // Only seed if truly empty — if user deliberately deleted all, skip
  if ((count ?? 0) > 0) {
    const data = await buildFromCache(user.id);
    return NextResponse.json(data);
  }

  await seedMag7ForUser(user.id);
  const data = await buildFromCache(user.id);
  return NextResponse.json(data);
}
