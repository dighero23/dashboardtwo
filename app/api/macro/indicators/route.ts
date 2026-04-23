import { NextResponse } from "next/server";
import { getFredSeries } from "@/lib/fred";
import type { FredObservation } from "@/lib/fred";
import type { IndicatorsResponse, InflationSeries, RatePoint } from "@/lib/macro/types";

/** Type predicate — narrows FredObservation to one whose value is definitely a number. */
function hasValue(o: FredObservation): o is { date: string; value: number } {
  return o.value !== null;
}

/**
 * Compute 12-month history of YoY% changes from a DESC-sorted observations array.
 * Requires at least 25 observations (to produce 13 YoY points).
 */
function buildInflationSeries(
  obs: { date: string; value: number | null }[]
): InflationSeries | null {
  const valid = obs.filter((o): o is { date: string; value: number } => o.value !== null);
  if (valid.length < 13) return null;

  // obs is sorted DESC (newest first), compute YoY for each of the 12 most recent months
  const history: RatePoint[] = [];
  for (let i = Math.min(valid.length - 13, 11); i >= 0; i--) {
    const current = valid[i];
    const yearAgo = valid[i + 12];
    if (!yearAgo || yearAgo.value === 0) continue;
    history.push({
      date: current.date,
      value: ((current.value - yearAgo.value) / yearAgo.value) * 100,
    });
  }

  const latest = valid[0];
  const yearAgo = valid[12];
  const yoy =
    latest && yearAgo && yearAgo.value !== 0
      ? ((latest.value - yearAgo.value) / yearAgo.value) * 100
      : null;

  return { yoy, date: latest.date, history };
}

export async function GET() {
  try {
    // Fetch in parallel — cache handles deduplication
    const [fedFundsData, cpiData, pceData, unemploymentData, t10yData, t2yData, spreadData, vixData] =
      await Promise.all([
        getFredSeries("FEDFUNDS", 2),
        getFredSeries("CPIAUCSL", 25),
        getFredSeries("PCEPI", 25),
        getFredSeries("UNRATE", 2),
        getFredSeries("DGS10", 6),
        getFredSeries("DGS2", 6),
        getFredSeries("T10Y2Y", 6),
        getFredSeries("VIXCLS", 2),
      ]);

    const response: IndicatorsResponse = {
      fedFunds: (() => {
        const valid = (fedFundsData?.observations ?? []).filter(hasValue);
        if (!valid[0]) return null;
        return { current: valid[0].value, prev: valid[1]?.value ?? null, date: valid[0].date };
      })(),

      cpi: buildInflationSeries(cpiData?.observations ?? []),
      pce: buildInflationSeries(pceData?.observations ?? []),

      unemployment: (() => {
        const valid = (unemploymentData?.observations ?? []).filter(hasValue);
        return valid[0] ? { rate: valid[0].value, date: valid[0].date } : null;
      })(),

      treasury10y: (() => {
        const valid = (t10yData?.observations ?? []).filter(hasValue);
        return valid[0] ? { rate: valid[0].value, date: valid[0].date } : null;
      })(),

      treasury2y: (() => {
        const valid = (t2yData?.observations ?? []).filter(hasValue);
        return valid[0] ? { rate: valid[0].value, date: valid[0].date } : null;
      })(),

      yieldSpread: (() => {
        const valid = (spreadData?.observations ?? []).filter(hasValue);
        if (!valid[0]) return null;
        return {
          spread: valid[0].value,
          date:   valid[0].date,
          history: valid.slice().reverse().map((o) => ({ date: o.date, value: o.value })),
        };
      })(),

      vix: (() => {
        const valid = (vixData?.observations ?? []).filter(hasValue);
        return valid[0] ? { value: valid[0].value, date: valid[0].date } : null;
      })(),

      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[GET /api/macro/indicators]", err);
    return NextResponse.json({ error: "Failed to fetch indicators" }, { status: 500 });
  }
}
