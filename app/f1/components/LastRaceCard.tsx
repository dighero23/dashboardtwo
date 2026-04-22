"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Zap } from "lucide-react";
import type { LastRaceResponse } from "@/lib/f1/types";
import { formatRaceDate, getTeamColor } from "../constants";

interface ResultRow {
  position: number;
  driver: string;
  code: string;
  constructorId: string;
  team: string;
  status: string;
  fastestLap: string | null;
  isFastestLap: boolean;
}

interface DetailData {
  results: ResultRow[];
  poleDriver: string | null;
}

interface Props {
  lastRace: LastRaceResponse | null;
}

const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

function isDnf(status: string) {
  return status !== "Finished" && !/^\+\d+ Lap/.test(status);
}

function PosBadge({ pos }: { pos: number }) {
  const style =
    pos === 1 ? { background: "#fbbf24", color: "#78350f" } :
    pos === 2 ? { background: "#cbd5e1", color: "#1e293b" } :
    pos === 3 ? { background: "#c2855b", color: "#422006" } :
               { background: "#1e293b", color: "#94a3b8" };
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold tabular-nums flex-shrink-0"
      style={style}
    >
      {pos}
    </span>
  );
}

export default function LastRaceCard({ lastRace }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<DetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const season = lastRace?.season ?? new Date().getFullYear();

  async function toggle() {
    if (!lastRace) return;
    if (!expanded && !detail) {
      setLoadingDetail(true);
      try {
        const res = await fetch("/api/f1/last-race/detail");
        const data = await res.json() as DetailData;
        setDetail(data);
      } catch {}
      setLoadingDetail(false);
    }
    setExpanded((e) => !e);
  }

  const top10 = detail?.results.filter((r) => r.position <= 10) ?? [];
  const dnfs = detail?.results.filter((r) => isDnf(r.status)) ?? [];
  const fastestLapRow = detail?.results.find((r) => r.isFastestLap);

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
        <div className="rounded-xl bg-slate-800/50 border border-slate-700/60 overflow-hidden">
          {/* Header — always visible, tappable */}
          <button
            onClick={toggle}
            className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-slate-800/70 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm truncate">{lastRace.raceName}</p>
              <p className="text-xs text-slate-500 truncate mt-0.5">{lastRace.circuitName}</p>
            </div>
            <p className="text-xs text-slate-400 tabular-nums flex-shrink-0">
              {formatRaceDate(lastRace.date)}
            </p>
            {expanded
              ? <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" />
              : <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
            }
          </button>

          {/* Accordion body */}
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              <div className="border-t border-slate-700/60 px-3 pb-3 pt-2">
                {loadingDetail ? (
                  <div className="space-y-2 py-2 animate-pulse">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-7 bg-slate-700/40 rounded" />
                    ))}
                  </div>
                ) : detail ? (
                  <>
                    {/* Top 10 results */}
                    <div className="space-y-px">
                      {top10.map((r) => {
                        const pts = (POINTS[r.position - 1] ?? 0) + (r.isFastestLap && r.position <= 10 ? 1 : 0);
                        const teamColor = getTeamColor(r.constructorId);
                        const statusLabel = r.status === "Finished" ? "Fin." : r.status;
                        return (
                          <div key={r.position} className="flex items-center gap-2 py-1 px-1">
                            <PosBadge pos={r.position} />
                            <div
                              className="w-0.5 h-4 rounded-full flex-shrink-0"
                              style={{ background: teamColor }}
                            />
                            <span className="font-mono text-[11px] font-semibold text-slate-200 w-8 flex-shrink-0 tracking-wide">
                              {r.code}
                            </span>
                            <span className="text-[11px] text-slate-500 flex-1 truncate">
                              {statusLabel}
                              {r.isFastestLap && (
                                <Zap className="inline w-2.5 h-2.5 ml-0.5 mb-px text-purple-400" />
                              )}
                            </span>
                            <span className="text-[11px] font-mono text-slate-300 w-5 text-right flex-shrink-0">
                              {pts}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pole + fastest lap */}
                    <div className="mt-3 pt-2 border-t border-slate-800 flex flex-wrap gap-x-4 gap-y-1">
                      {detail.poleDriver && (
                        <p className="text-[10px] text-slate-500">
                          <span className="text-slate-600 mr-1">Pole</span>
                          <span className="text-slate-400">{detail.poleDriver}</span>
                        </p>
                      )}
                      {fastestLapRow && (
                        <p className="text-[10px] text-slate-500 flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5 text-purple-400 flex-shrink-0" />
                          <span className="text-slate-400 ml-0.5">{fastestLapRow.driver}</span>
                          {fastestLapRow.fastestLap && (
                            <span className="text-slate-600 ml-1">{fastestLapRow.fastestLap}</span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* DNFs */}
                    {dnfs.length > 0 && (
                      <p className="text-[10px] text-slate-600 mt-1.5">
                        DNF · {dnfs.map((r) => r.code).join(", ")}
                      </p>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
