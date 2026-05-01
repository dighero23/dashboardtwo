import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/quotes?symbols=AAPL,MSFT,... — public price lookup by symbol
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const symbols = (url.searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length === 0) return NextResponse.json({ quotes: [] });

  const db = createAdminClient();
  const { data } = await db
    .from("tickers")
    .select("symbol, name, price_cache(current_price, change_pct, ath_3y, earnings_date, updated_at)")
    .in("symbol", symbols);

  // One price row per symbol (first match wins — price is global)
  const seen = new Set<string>();
  const quotes: {
    symbol: string; name: string | null;
    price: number; changePct: number; ath3y: number | null;
    earningsDate: string | null; updatedAt: string | null;
  }[] = [];

  for (const row of data ?? []) {
    if (seen.has(row.symbol)) continue;
    const cache = Array.isArray(row.price_cache) ? row.price_cache[0] : row.price_cache;
    if (!cache) continue;
    seen.add(row.symbol);
    quotes.push({
      symbol: row.symbol,
      name: row.name,
      price: cache.current_price ?? 0,
      changePct: cache.change_pct ?? 0,
      ath3y: cache.ath_3y ?? null,
      earningsDate: cache.earnings_date ?? null,
      updatedAt: cache.updated_at ?? null,
    });
  }

  return NextResponse.json({ quotes });
}
