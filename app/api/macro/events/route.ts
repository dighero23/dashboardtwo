import { NextResponse } from "next/server";
import { getEconomicCalendar, isHighImpactEvent } from "@/lib/finnhubMacro";
import type { EventsResponse } from "@/lib/macro/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter"); // "high" | null (all)

    const all = await getEconomicCalendar();
    const events = filter === "high" ? all.filter(isHighImpactEvent) : all;

    const response: EventsResponse = {
      events,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[GET /api/macro/events]", err);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}
