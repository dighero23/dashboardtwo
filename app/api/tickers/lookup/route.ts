import { NextRequest, NextResponse } from "next/server";
import YahooFinanceClass from "yahoo-finance2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yahooFinance = new (YahooFinanceClass as any)({
  suppressNotices: ["yahooSurvey"],
});

// GET /api/tickers/lookup?symbol=AAPL
// Returns { symbol, name } or 404 if not found.
// Public endpoint — used by AddTickerModal to resolve company name.
export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase().trim();
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quote = await yahooFinance.quote(symbol.replace(".", "-")) as any;
    const name: string | null = quote?.shortName ?? quote?.longName ?? null;
    const price: number | null = quote?.regularMarketPrice ?? null;

    if (!price) {
      return NextResponse.json({ error: "Ticker not found" }, { status: 404 });
    }

    return NextResponse.json({ symbol, name });
  } catch {
    return NextResponse.json({ error: "Ticker not found" }, { status: 404 });
  }
}
