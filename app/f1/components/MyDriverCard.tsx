"use client";

import { useState, useEffect } from "react";
import type { DriverStats, F1Driver } from "@/lib/f1/types";
import { getTeamColor } from "../constants";

interface MyDriver {
  id: string;
  name: string;
}

interface Props {
  myDriver: MyDriver | null;
  onDriverChange: (id: string, name: string) => void;
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-slate-900/60 border border-slate-800 px-2 py-2 text-center">
      <p className="text-lg font-semibold text-white tabular-nums leading-none">{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-slate-500 mt-1.5 leading-none">{label}</p>
    </div>
  );
}

export default function MyDriverCard({ myDriver, onDriverChange }: Props) {
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [drivers, setDrivers] = useState<F1Driver[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  // Fetch stats when driver changes
  useEffect(() => {
    if (!myDriver) { setStats(null); return; }
    setLoadingStats(true);
    fetch(`/api/f1/driver/${myDriver.id}/stats`)
      .then((r) => r.json())
      .then((data: DriverStats) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));
  }, [myDriver?.id]);

  function openPicker() {
    setShowPicker(true);
    if (drivers.length > 0) return;
    setLoadingDrivers(true);
    fetch("/api/f1/drivers-list")
      .then((r) => r.json())
      .then((data: { drivers: F1Driver[] }) => setDrivers(data.drivers))
      .catch(() => {})
      .finally(() => setLoadingDrivers(false));
  }

  function selectDriver(d: F1Driver) {
    onDriverChange(d.driverId, d.name);
    setShowPicker(false);
  }

  const teamColor = stats ? getTeamColor(stats.constructorId) : "#94a3b8";

  return (
    <>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-medium">
          My driver ·{" "}
          <button
            onClick={openPicker}
            className="text-slate-400 normal-case tracking-normal hover:text-slate-200 transition-colors"
          >
            {myDriver?.name ?? "Pick a driver →"}
          </button>
        </p>

        <div
          className="rounded-xl bg-slate-800/40 border p-4"
          style={{ borderColor: "#fbbf2444" }}
        >
          {!myDriver ? (
            <div className="text-center py-4">
              <p className="text-slate-500 text-sm">No driver selected.</p>
              <button
                onClick={openPicker}
                className="mt-2 text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: "#fbbf2422", color: "#fbbf24", border: "1px solid #fbbf2444" }}
              >
                Choose driver
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
                  <p className="text-[11px] mt-2" style={{ color: teamColor }}>
                    {stats.team}
                  </p>
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
                <StatTile value={stats.dnfs}    label="DNFs" />
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
              Choose driver
            </p>
            {loadingDrivers ? (
              <div className="space-y-2">
                {[0,1,2,3].map(i => <div key={i} className="h-9 bg-slate-700/60 rounded-lg animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-1">
                {drivers.map((d) => (
                  <button
                    key={d.driverId}
                    onClick={() => selectDriver(d)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      myDriver?.id === d.driverId
                        ? "text-white font-medium"
                        : "text-slate-300 hover:bg-slate-700/60 hover:text-white"
                    }`}
                    style={myDriver?.id === d.driverId ? { background: "#fbbf2422" } : undefined}
                  >
                    {d.name}
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
