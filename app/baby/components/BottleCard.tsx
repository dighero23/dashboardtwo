"use client";

import { useState, useEffect } from "react";
import { Settings, RotateCcw, Check, Clock, X } from "lucide-react";
import type { BabyTimer } from "@/lib/baby/types";

interface Props {
  timer: BabyTimer;
  onReset: () => void;
  onIntervalChange: (minutes: number) => void;
}

function useElapsed(lastResetAt: string) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    function tick() {
      setElapsed(Math.floor((Date.now() - new Date(lastResetAt).getTime()) / 1000));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastResetAt]);
  return elapsed;
}

function fmtElapsed(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${secs}s`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// Returns "YYYY-MM-DDTHH:MM" in local time for <input type="datetime-local">
function toLocalDateTimeInput(iso: string): string {
  const d   = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Convert "YYYY-MM-DDTHH:MM" (local) to ISO UTC string
function localDateTimeToISO(dtLocal: string): string {
  const d = new Date(dtLocal);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

type Status = "green" | "amber" | "red";

function getStatus(elapsedSecs: number, intervalMins: number): Status {
  const pct = elapsedSecs / (intervalMins * 60);
  if (pct >= 1) return "red";
  if (pct >= 0.8) return "amber";
  return "green";
}

// Arc SVG: 270° sweep (starts bottom-left, ends bottom-right)
function ArcRing({ pct, status }: { pct: number; status: Status }) {
  const r = 54;
  const cx = 64, cy = 64;
  const startAngle = 135; // degrees
  const sweep = 270;
  const filled = Math.min(pct, 1);

  function polar(angle: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(fromDeg: number, toDeg: number) {
    const s = polar(fromDeg);
    const e = polar(toDeg);
    const large = toDeg - fromDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const trackPath = arcPath(startAngle, startAngle + sweep);
  const fillPath  = filled > 0 ? arcPath(startAngle, startAngle + sweep * filled) : null;

  const strokeColor =
    status === "red"   ? "#ef4444" :
    status === "amber" ? "#f59e0b" :
                         "#10b981";

  const glowColor =
    status === "red"   ? "drop-shadow(0 0 6px #ef444488)" :
    status === "amber" ? "drop-shadow(0 0 6px #f59e0b88)" :
                         "drop-shadow(0 0 6px #10b98188)";

  return (
    <svg width="104" height="104" viewBox="0 0 128 128">
      {/* Track */}
      <path d={trackPath} fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
      {/* Fill */}
      {fillPath && (
        <path
          d={fillPath}
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinecap="round"
          style={{ filter: glowColor, transition: "stroke 0.5s ease" }}
        />
      )}
    </svg>
  );
}

type Panel = "none" | "manual" | "settings";

export default function BottleCard({ timer, onReset, onIntervalChange }: Props) {
  // Local reset time — updated immediately from API response so stopwatch
  // reflects the change without waiting for the parent to reload timers.
  const [localResetAt, setLocalResetAt] = useState(timer.last_reset_at);
  useEffect(() => { setLocalResetAt(timer.last_reset_at); }, [timer.last_reset_at]);

  const elapsed   = useElapsed(localResetAt);
  const status    = getStatus(elapsed, timer.interval_minutes);
  const isOverdue = status === "red";
  const pct       = elapsed / (timer.interval_minutes * 60);

  const [resetting,     setResetting]     = useState(false);
  const [panel,         setPanel]         = useState<Panel>("none");
  const [manualTime,    setManualTime]    = useState(toLocalDateTimeInput(timer.last_reset_at));
  const [intervalInput, setIntervalInput] = useState(String(timer.interval_minutes / 60));

  const textColor =
    status === "red"   ? "text-red-400" :
    status === "amber" ? "text-amber-400" :
                         "text-emerald-400";

  const borderColor =
    status === "red"   ? "border-red-500/40" :
    status === "amber" ? "border-amber-500/40" :
                         "border-emerald-500/20";

  async function doReset(at?: string) {
    setResetting(true);
    try {
      const res = await fetch(`/api/baby/timers/${timer.id}/reset`, {
        method:  "POST",
        headers: at ? { "Content-Type": "application/json" } : undefined,
        body:    at ? JSON.stringify({ at }) : undefined,
      });
      if (res.ok) {
        const updated = await res.json();
        setLocalResetAt(updated.last_reset_at);
      }
      setPanel("none");
      onReset();
    } finally {
      setResetting(false);
    }
  }

  async function handleSaveInterval() {
    const hours = parseFloat(intervalInput);
    if (isNaN(hours) || hours <= 0) return;
    const mins = Math.round(hours * 60);
    await fetch(`/api/baby/timers/${timer.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ interval_minutes: mins }),
    });
    onIntervalChange(mins);
    setPanel("none");
  }

  const intervalLabel = timer.interval_minutes % 60 === 0
    ? `${timer.interval_minutes / 60}h`
    : `${timer.interval_minutes}min`;

  return (
    <div className={`rounded-2xl border-2 ${borderColor} bg-slate-800/70 overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-white tracking-tight">
          {timer.name || (timer.type === "poop" ? "Poop" : "Milk")}
        </span>
          {isOverdue && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 animate-pulse">
              OVERDUE
            </span>
          )}
        </div>
        <button
          onClick={() => setPanel(panel === "settings" ? "none" : "settings")}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-700/60 transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Arc + time */}
      <div className="flex flex-col items-center pt-0.5 pb-2">
        <div className="relative w-[104px] h-[104px]">
          <ArcRing pct={pct} status={status} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-extrabold tabular-nums leading-none ${textColor}`}>
              {fmtElapsed(elapsed)}
            </span>
            <span className="text-[10px] text-slate-500 mt-1">ago</span>
          </div>
        </div>
        <p className="text-slate-400 text-xs mt-0">
          Last at <span className="text-slate-300">{fmtTime(localResetAt)}</span>
          <span className="text-slate-600 ml-2">· every {intervalLabel}</span>
        </p>
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-4 space-y-1.5">
        {/* Primary button */}
        <button
          onClick={() => doReset()}
          disabled={resetting}
          className={`w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
            resetting
              ? "bg-slate-700 text-slate-500 cursor-not-allowed"
              : status === "red"
                ? "bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30"
                : status === "amber"
                  ? "bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
                  : "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30"
          }`}
        >
          {resetting ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {timer.type === "poop" ? "Just poop" : "Just fed"}
        </button>

        {/* Secondary: set time manually */}
        <button
          onClick={() => {
            setManualTime(toLocalDateTimeInput(new Date().toISOString()));
            setPanel(panel === "manual" ? "none" : "manual");
          }}
          className="w-full py-1.5 rounded-xl text-xs text-slate-500 hover:text-slate-300 flex items-center justify-center gap-1.5 hover:bg-slate-700/40 transition-colors"
        >
          <Clock className="w-3.5 h-3.5" />
          Set time manually
        </button>
      </div>

      {/* Manual time panel */}
      {panel === "manual" && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-700/50">
          <p className="text-xs text-slate-400 mb-2 pt-3">When was it?</p>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={manualTime}
              onChange={(e) => setManualTime(e.target.value)}
              className="flex-1 min-w-0 bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-rose-500/60"
            />
            <button
              onClick={() => doReset(localDateTimeToISO(manualTime))}
              disabled={resetting}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-lg hover:bg-rose-500/30 transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPanel("none")}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-slate-700/50 rounded-lg text-slate-400 hover:bg-slate-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Interval settings panel */}
      {panel === "settings" && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-700/50">
          <p className="text-xs text-slate-400 mb-2 pt-3">Intervalo (horas)</p>
          <div className="flex gap-2">
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={intervalInput}
              onChange={(e) => setIntervalInput(e.target.value)}
              className="flex-1 min-w-0 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500/60"
            />
            <button
              onClick={handleSaveInterval}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-lg hover:bg-rose-500/30 transition-colors"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPanel("none")}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-slate-700/50 rounded-lg text-slate-400 hover:bg-slate-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
