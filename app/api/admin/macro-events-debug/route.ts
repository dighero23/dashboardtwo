import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkAdmin(user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const key = process.env.FINNHUB_API_KEY;
  if (!key) return NextResponse.json({ error: "No Finnhub API key" }, { status: 500 });

  const from = new Date().toISOString().split("T")[0];
  const toDate = new Date();
  toDate.setDate(toDate.getDate() + 60);
  const to = toDate.toISOString().split("T")[0];

  const res = await fetch(
    `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${key}`,
    { cache: "no-store" }
  );
  if (!res.ok) return NextResponse.json({ error: `Finnhub ${res.status}` }, { status: 502 });

  const json = await res.json();
  const usEvents: { event: string; time: string; impact: string }[] = (json?.economicCalendar ?? [])
    .filter((e: { country?: string }) => e.country === "US")
    .map((e: { event?: string; time?: string; impact?: string }) => ({
      event:  e.event  ?? "",
      time:   e.time   ?? "",
      impact: e.impact ?? "low",
    }))
    .sort((a: { time: string }, b: { time: string }) => a.time.localeCompare(b.time));

  const KEY_PATTERNS = [
    { label: "CPI",  keywords: ["cpi", "consumer price index"] },
    { label: "FOMC", keywords: ["fomc", "federal funds rate", "interest rate decision"] },
    { label: "GDP",  keywords: ["gdp", "gross domestic product"] },
    { label: "NFP",  keywords: ["nonfarm payroll", "nfp", "employment situation"] },
    { label: "PCE",  keywords: ["pce", "personal consumption expenditures", "personal spending"] },
  ];

  const matched: Record<string, { event: string; time: string; impact: string } | null> = {};
  for (const { label, keywords } of KEY_PATTERNS) {
    const now = Date.now();
    const found = usEvents.find(
      (e) => keywords.some((kw) => e.event.toLowerCase().includes(kw)) &&
             new Date(e.time).getTime() > now - 3_600_000
    );
    matched[label] = found ?? null;
  }

  return NextResponse.json({ from, to, totalUsEvents: usEvents.length, matched, allEvents: usEvents });
}
