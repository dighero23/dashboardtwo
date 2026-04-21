"use client";

import { useState, useEffect } from "react";
import type { TeamStats, F1Team } from "@/lib/f1/types";
import { getTeamColor } from "../constants";

interface MyTeam {
  id: string;
  name: string;
}

interface Props {
  myTeam: MyTeam | null;
  onTeamChange: (id: string, name: string) => void;
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-slate-900/60 border border-slate-800 px-2 py-2 text-center">
      <p className="text-lg font-semibold text-white tabular-nums leading-none">{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-slate-500 mt-1.5 leading-none">{label}</p>
    </div>
  );
}

export default function MyTeamCard({ myTeam, onTeamChange }: Props) {
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [teams, setTeams] = useState<F1Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  useEffect(() => {
    if (!myTeam) { setStats(null); return; }
    setLoadingStats(true);
    fetch(`/api/f1/team/${myTeam.id}/stats`)
      .then((r) => r.json())
      .then((data: TeamStats) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));
  }, [myTeam?.id]);

  function openPicker() {
    setShowPicker(true);
    if (teams.length > 0) return;
    setLoadingTeams(true);
    fetch("/api/f1/teams-list")
      .then((r) => r.json())
      .then((data: { teams: F1Team[] }) => setTeams(data.teams))
      .catch(() => {})
      .finally(() => setLoadingTeams(false));
  }

  function selectTeam(t: F1Team) {
    onTeamChange(t.constructorId, t.name);
    setShowPicker(false);
  }

  const teamColor = myTeam ? getTeamColor(myTeam.id) : "#94a3b8";

  return (
    <>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-medium">
          My team ·{" "}
          <button
            onClick={openPicker}
            className="normal-case tracking-normal hover:opacity-80 transition-opacity"
            style={{ color: myTeam ? teamColor : "#94a3b8" }}
          >
            {myTeam?.name ?? "Pick a team →"}
          </button>
        </p>

        <div
          className="rounded-xl bg-slate-800/40 border p-4"
          style={{ borderColor: "#fbbf2444" }}
        >
          {!myTeam ? (
            <div className="text-center py-4">
              <p className="text-slate-500 text-sm">No team selected.</p>
              <button
                onClick={openPicker}
                className="mt-2 text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: "#fbbf2422", color: "#fbbf24", border: "1px solid #fbbf2444" }}
              >
                Choose team
              </button>
            </div>
          ) : loadingStats ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-8 w-16 bg-slate-700/60 rounded" />
              <div className="grid grid-cols-4 gap-2">
                {[0,1,2,3].map(i => <div key={i} className="h-12 bg-slate-700/60 rounded-lg" />)}
              </div>
            </div>
          ) : stats ? (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Position</p>
                  <p className="text-3xl font-bold text-white tabular-nums leading-none">
                    P{stats.position}
                  </p>
                  <div
                    className="h-0.5 w-8 rounded-full mt-2"
                    style={{ background: teamColor }}
                  />
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Points</p>
                  <p className="text-3xl font-bold text-white tabular-nums leading-none">
                    {stats.points}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3">
                <StatTile value={stats.wins}    label="Wins" />
                <StatTile value={stats.podiums} label="Podiums" />
                <StatTile value={stats.poles}   label="Poles" />
                <StatTile value={stats.oneTwo}  label="1-2 Fin." />
              </div>
            </>
          ) : (
            <p className="text-slate-500 text-sm text-center py-2">Failed to load stats.</p>
          )}
        </div>
      </div>

      {/* Picker modal */}
      {showPicker && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowPicker(false)}
        >
          <div
            className="w-full max-w-sm max-h-96 overflow-y-auto bg-slate-800 rounded-2xl border border-slate-700 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">
              Choose team
            </p>
            {loadingTeams ? (
              <div className="space-y-2">
                {[0,1,2,3].map(i => <div key={i} className="h-9 bg-slate-700/60 rounded-lg animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-1">
                {teams.map((t) => (
                  <button
                    key={t.constructorId}
                    onClick={() => selectTeam(t)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-slate-700/60"
                    style={
                      myTeam?.id === t.constructorId
                        ? { background: "#fbbf2422", color: getTeamColor(t.constructorId), fontWeight: 500 }
                        : { color: "#cbd5e1" }
                    }
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
