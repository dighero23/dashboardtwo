"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LastRaceResponse } from "@/lib/f1/types";
import { formatRaceDate } from "../constants";

interface Props {
  lastRace: LastRaceResponse | null;
}

export default function LastRaceCard({ lastRace }: Props) {
  const season = lastRace?.season ?? new Date().getFullYear();

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-medium">
        Last race · {season} Season
      </p>

      {!lastRace ? (
        <div className="rounded-xl bg-slate-800/50 border border-slate-700/60 px-4 py-3">
          <div className="h-4 w-40 bg-slate-700/60 rounded animate-pulse" />
        </div>
      ) : (
        <Link href={`/f1/races/${lastRace.raceId}`} className="block group">
          <div className="w-full text-left rounded-xl bg-slate-800/50 border border-slate-700/60 hover:bg-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm truncate">{lastRace.raceName}</p>
                <p className="text-xs text-slate-500 truncate mt-0.5">{lastRace.circuitName}</p>
              </div>
              <p className="text-xs text-slate-400 tabular-nums flex-shrink-0">
                {formatRaceDate(lastRace.date)}
              </p>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </div>
          </div>
        </Link>
      )}
    </div>
  );
}
