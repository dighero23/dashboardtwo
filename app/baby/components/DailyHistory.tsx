"use client";

import { useEffect, useState } from "react";
import { Clock, Milk, Pill, ChevronLeft, ChevronRight } from "lucide-react";
import type { BabyLogEntry } from "@/lib/baby/types";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

function localDateStr(offsetDays = 0): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }));
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDateLabel(dateStr: string): string {
  const today     = localDateStr(0);
  const yesterday = localDateStr(-1);
  if (dateStr === today)     return "Today";
  if (dateStr === yesterday) return "Yesterday";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function DailyHistory({ refreshTick }: { refreshTick: number }) {
  const [log,     setLog]     = useState<BabyLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateStr, setDateStr] = useState(localDateStr(0));

  useEffect(() => {
    setLoading(true);
    fetch(`/api/baby/log?date=${dateStr}`)
      .then((r) => r.ok ? r.json() : { log: [] })
      .then((d) => setLog(d.log ?? []))
      .finally(() => setLoading(false));
  }, [dateStr, refreshTick]);

  // Group by type
  const bottleEntries = log.filter((e) => e.type === "bottle");
  const medGroups = log.reduce<Record<string, BabyLogEntry[]>>((acc, e) => {
    if (e.type !== "medication") return acc;
    const key = e.name ?? "Medicine";
    acc[key] = [...(acc[key] ?? []), e];
    return acc;
  }, {});

  const today = localDateStr(0);
  const isToday = dateStr === today;

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4">
      {/* Header with date nav */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-white">{fmtDateLabel(dateStr)}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const [y, m, d] = dateStr.split("-").map(Number);
              const prev = new Date(y, m - 1, d - 1);
              setDateStr(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`);
            }}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/60 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            disabled={isToday}
            onClick={() => {
              const [y, m, d] = dateStr.split("-").map(Number);
              const next = new Date(y, m - 1, d + 1);
              setDateStr(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`);
            }}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-10 rounded-xl bg-slate-700/40 animate-pulse" />)}
        </div>
      )}

      {!loading && log.length === 0 && (
        <p className="text-slate-600 text-xs text-center py-4">No events logged {isToday ? "today" : "this day"}</p>
      )}

      {!loading && log.length > 0 && (
        <div className="space-y-3">
          {/* Bottle */}
          {bottleEntries.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Milk className="w-3 h-3 text-emerald-400" />
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                  Milk · {bottleEntries.length} today
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {bottleEntries.map((e) => (
                  <span key={e.id} className="text-[11px] text-slate-300 bg-slate-700/60 px-2 py-0.5 rounded-full">
                    {fmtTime(e.logged_at)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Medications */}
          {Object.entries(medGroups).map(([name, entries]) => (
            <div key={name}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Pill className="w-3 h-3 text-violet-400" />
                <span className="text-[11px] font-semibold text-violet-400 uppercase tracking-wider">
                  {name} · {entries.length} today
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {entries.map((e) => (
                  <span key={e.id} className="text-[11px] text-slate-300 bg-slate-700/60 px-2 py-0.5 rounded-full">
                    {fmtTime(e.logged_at)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
