"use client";

import { useState, useEffect } from "react";
import { Cloud, Medal, Timer } from "lucide-react";
import type { NextRaceResponse } from "@/lib/f1/types";
import { formatSessionTime, formatSessionDate, getTeamColor, type Timezone } from "../constants";

interface Props {
  nextRace: NextRaceResponse | null;
  timezone: Timezone;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function NextRaceCard({ nextRace, timezone }: Props) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!nextRace) {
    return (
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-medium">
          Next race
        </p>
        <div
          className="rounded-xl bg-slate-800/40 border p-6"
          style={{ borderColor: "#fbbf2444" }}
        >
          <div className="space-y-2">
            <div className="h-4 w-48 bg-slate-700/60 rounded animate-pulse" />
            <div className="h-3 w-32 bg-slate-700/60 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const raceDate = new Date(nextRace.raceDateUtc);
  const msUntil = Math.max(0, raceDate.getTime() - now.getTime());
  const days  = Math.floor(msUntil / 86400000);
  const hours = Math.floor((msUntil % 86400000) / 3600000);
  const mins  = Math.floor((msUntil % 3600000) / 60000);
  const progress = Math.max(0.04, 1 - Math.min(1, msUntil / (7 * 86400000)));

  const { time: raceTime } = formatSessionTime(nextRace.raceDateUtc, timezone);
  const raceDisplayDate = formatSessionDate(nextRace.raceDateUtc, timezone);

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-medium">
        Next race · Round {nextRace.round}
      </p>

      <div className="rounded-xl bg-slate-800/40 border" style={{ borderColor: "#fbbf2444" }}>
        {/* Compact header */}
        <div className="flex items-center px-4 py-3 gap-3 border-b border-slate-800/80">
          <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: "#fbbf24" }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{nextRace.raceName}</p>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">{nextRace.circuitName}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs font-semibold text-slate-200 tabular-nums">{raceDisplayDate}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 tabular-nums">{raceTime}</p>
          </div>
        </div>

        {/* Countdown */}
        <div className="px-4 py-3">
          <div className="flex items-baseline justify-between mb-2">
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl font-bold text-white tabular-nums leading-none">{days}</span>
              <span className="text-xs text-slate-500">d</span>
              <span className="text-lg font-semibold text-slate-300 tabular-nums leading-none ml-1">{pad(hours)}</span>
              <span className="text-xs text-slate-500">h</span>
              <span className="text-lg font-semibold text-slate-300 tabular-nums leading-none">{pad(mins)}</span>
              <span className="text-xs text-slate-500">m</span>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">until lights out</span>
          </div>
          <div className="relative h-1 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="absolute left-0 top-0 bottom-0 rounded-full transition-all duration-1000"
              style={{
                width: `${progress * 100}%`,
                background: "linear-gradient(90deg, #fbbf2466, #fbbf24)",
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[9px] uppercase tracking-wider text-slate-600">
            <span>Week -1</span>
            <span>Race day</span>
          </div>
        </div>

        {/* Sessions */}
        <div className="px-4 pb-2 border-t border-slate-800/80 pt-2">
          {nextRace.sessions.map((session) => {
            const { day, time } = formatSessionTime(session.dateUtc, timezone);
            const isPast = new Date(session.dateUtc) < now;
            return (
              <div
                key={session.name}
                className={`flex items-center justify-between py-1.5 transition-opacity ${isPast ? "opacity-40" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-1 h-4 rounded-full flex-shrink-0"
                    style={{ background: session.highlight ? "#fbbf24" : "#334155" }}
                  />
                  <span
                    className={`text-sm ${session.highlight ? "text-white font-medium" : "text-slate-300"}`}
                  >
                    {session.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 tabular-nums">{day}</span>
                  <span
                    className={`text-xs font-mono tabular-nums ${session.highlight ? "font-semibold" : "text-slate-400"}`}
                    style={session.highlight ? { color: "#fbbf24" } : undefined}
                  >
                    {time}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Circuit stats */}
        <div className="px-4 pb-4 pt-1">
          <div className="grid grid-cols-3 gap-2 mt-3">
            {/* Weather */}
            <div className="rounded-lg bg-slate-900/50 border border-slate-800 px-2.5 py-2">
              <div className="flex items-center gap-1 text-slate-500 mb-1">
                <Cloud className="w-3 h-3" />
                <span className="text-[9px] uppercase tracking-wider">Weather</span>
              </div>
              <p className="text-sm font-semibold text-white tabular-nums leading-none">
                {nextRace.weather ? `${nextRace.weather.tempC}°C` : "—"}
              </p>
              <p className="text-[10px] text-slate-500 mt-1 leading-none">
                {nextRace.weather ? `${nextRace.weather.rainPct}% rain` : "unavailable"}
              </p>
            </div>

            {/* Last winner */}
            <div className="rounded-lg bg-slate-900/50 border border-slate-800 px-2.5 py-2">
              <div className="flex items-center gap-1 text-slate-500 mb-1">
                <Medal className="w-3 h-3" />
                <span className="text-[9px] uppercase tracking-wider">Last winner</span>
              </div>
              <p className="text-sm font-semibold text-white leading-none truncate">
                {nextRace.lastWinner?.driver ?? "—"}
              </p>
              <p
                className="text-[10px] mt-1 leading-none truncate"
                style={
                  nextRace.lastWinner
                    ? { color: getTeamColor(nextRace.lastWinner.constructorId) }
                    : { color: "#64748b" }
                }
              >
                {nextRace.lastWinner?.team ?? "—"}
              </p>
            </div>

            {/* Lap record */}
            <div className="rounded-lg bg-slate-900/50 border border-slate-800 px-2.5 py-2">
              <div className="flex items-center gap-1 text-slate-500 mb-1">
                <Timer className="w-3 h-3" />
                <span className="text-[9px] uppercase tracking-wider">Lap rec.</span>
              </div>
              <p className="text-sm font-semibold text-white font-mono tabular-nums leading-none">
                {nextRace.lapRecord?.time ?? "—"}
              </p>
              <p className="text-[10px] text-slate-500 mt-1 leading-none">
                {nextRace.lapRecord
                  ? `${nextRace.lapRecord.driver} '${String(nextRace.lapRecord.year).slice(2)}`
                  : ""}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
