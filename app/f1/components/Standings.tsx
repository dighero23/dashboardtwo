"use client";

import { ChevronDown, Trophy } from "lucide-react";
import type { StandingsResponse, DriverStanding, ConstructorStanding } from "@/lib/f1/types";
import { getTeamColor } from "../constants";

interface Props {
  standings: StandingsResponse | null;
  selectedSeason: number;
  seasons: number[];
  onSeasonChange: (year: number) => void;
  myDriver: string | null;   // driverId
  myTeam: string | null;     // constructorId
}

function PosBadge({ pos }: { pos: number }) {
  const style =
    pos === 1 ? { background: "#fbbf24", color: "#78350f" } :
    pos === 2 ? { background: "#cbd5e1", color: "#1e293b" } :
    pos === 3 ? { background: "#c2855b", color: "#422006" } :
               { background: "#1e293b", color: "#cbd5e1" };
  return (
    <div
      className="w-7 h-7 rounded-md flex items-center justify-center font-bold tabular-nums text-[11px] flex-shrink-0"
      style={style}
    >
      P{pos}
    </div>
  );
}

function DriverRow({
  d,
  highlight,
}: {
  d: DriverStanding;
  highlight: boolean;
}) {
  const row = (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <PosBadge pos={d.position} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate leading-tight">{d.name}</p>
        <p
          className="text-[11px] truncate leading-tight mt-0.5"
          style={{ color: getTeamColor(d.constructorId) }}
        >
          {d.team}
        </p>
      </div>
      <p className="text-sm font-mono text-white tabular-nums flex-shrink-0">{d.points}</p>
    </div>
  );

  if (highlight) {
    return (
      <div className="pt-1 px-1">
        <div
          className="rounded-lg"
          style={{ background: "#fbbf241a", border: "1px solid #fbbf2455" }}
        >
          {row}
        </div>
      </div>
    );
  }

  return row;
}

function ConstructorRow({
  c,
  highlight,
}: {
  c: ConstructorStanding;
  highlight: boolean;
}) {
  const row = (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <PosBadge pos={c.position} />
      <p className="flex-1 text-sm text-white font-medium truncate leading-tight">{c.name}</p>
      <div
        className="w-1 h-7 rounded-full flex-shrink-0"
        style={{ background: getTeamColor(c.constructorId) }}
      />
      <p className="text-sm font-mono text-white tabular-nums w-10 text-right flex-shrink-0">
        {c.points}
      </p>
    </div>
  );

  if (highlight) {
    return (
      <div className="pt-1 px-1">
        <div
          className="rounded-lg"
          style={{ background: "#fbbf241a", border: "1px solid #fbbf2455" }}
        >
          {row}
        </div>
      </div>
    );
  }

  return row;
}

export default function Standings({
  standings,
  selectedSeason,
  seasons,
  onSeasonChange,
  myDriver,
  myTeam,
}: Props) {
  const drivers = standings?.drivers ?? [];
  const constructors = standings?.constructors ?? [];

  const top3Drivers = drivers.slice(0, 3);
  const myDriverData = myDriver
    ? drivers.find((d) => d.driverId === myDriver)
    : null;
  const showMyDriver = myDriverData && myDriverData.position > 3;

  const top3Constructors = constructors.slice(0, 3);
  const myTeamData = myTeam
    ? constructors.find((c) => c.constructorId === myTeam)
    : null;
  const showMyTeam = myTeamData && myTeamData.position > 3;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5" style={{ color: "#fbbf24" }} />
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
            Standings
          </span>
        </div>

        {/* Season selector */}
        <div className="relative flex items-center">
          <select
            value={selectedSeason}
            onChange={(e) => onSeasonChange(parseInt(e.target.value))}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-md pl-2.5 pr-7 py-1 appearance-none focus:outline-none focus:border-slate-500"
          >
            {seasons.map((y) => (
              <option key={y} value={y}>
                {y} Season
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-1.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Cards — side by side on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Drivers */}
        <div className="rounded-xl bg-slate-800/40 border border-slate-700/60 p-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 px-2 pt-1 pb-1.5 font-medium">
            Drivers
          </p>
          <div className="space-y-0.5">
            {top3Drivers.length === 0
              ? [1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="w-7 h-7 rounded-md bg-slate-700/60 animate-pulse" />
                    <div className="flex-1 h-3 bg-slate-700/60 rounded animate-pulse" />
                  </div>
                ))
              : top3Drivers.map((d) => (
                  <DriverRow key={d.driverId} d={d} highlight={false} />
                ))}
            {showMyDriver && <DriverRow d={myDriverData} highlight={true} />}
          </div>
          <button className="w-full flex items-center justify-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors py-2 mt-1 border-t border-slate-800">
            View all drivers ›
          </button>
        </div>

        {/* Constructors */}
        <div className="rounded-xl bg-slate-800/40 border border-slate-700/60 p-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 px-2 pt-1 pb-1.5 font-medium">
            Constructors
          </p>
          <div className="space-y-0.5">
            {top3Constructors.length === 0
              ? [1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="w-7 h-7 rounded-md bg-slate-700/60 animate-pulse" />
                    <div className="flex-1 h-3 bg-slate-700/60 rounded animate-pulse" />
                  </div>
                ))
              : top3Constructors.map((c) => (
                  <ConstructorRow key={c.constructorId} c={c} highlight={false} />
                ))}
            {showMyTeam && <ConstructorRow c={myTeamData} highlight={true} />}
          </div>
          <button className="w-full flex items-center justify-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors py-2 mt-1 border-t border-slate-800">
            View all ›
          </button>
        </div>
      </div>
    </div>
  );
}
