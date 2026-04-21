"use client";

import type { UpcomingRace } from "@/lib/f1/types";
import { formatRaceDate } from "../constants";

interface Props {
  races: UpcomingRace[];
}

export default function UpcomingList({ races }: Props) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-medium">
        Upcoming
      </p>
      <div className="rounded-xl bg-slate-800/30 border border-slate-700/60 overflow-hidden divide-y divide-slate-800/80">
        {races.length === 0 ? (
          <div className="px-4 py-3">
            <div className="h-3 w-32 bg-slate-700/60 rounded animate-pulse" />
          </div>
        ) : (
          races.map((race) => (
            <div
              key={race.round}
              className="flex items-center px-4 py-2.5 hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate">{race.raceName}</p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{race.circuitName}</p>
              </div>
              <p className="text-xs text-slate-400 tabular-nums flex-shrink-0 ml-3">
                {formatRaceDate(race.date)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
