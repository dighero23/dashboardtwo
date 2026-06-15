"use client";

import { useState, useEffect, useRef } from "react";
import { Milk, Settings, RotateCcw, Check } from "lucide-react";
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
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min`;
  return `${secs}s`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

type StatusColor = "green" | "amber" | "red";

function getStatus(elapsedSecs: number, intervalMins: number): StatusColor {
  const pct = elapsedSecs / (intervalMins * 60);
  if (pct >= 1) return "red";
  if (pct >= 0.8) return "amber";
  return "green";
}

const STATUS_STYLES: Record<StatusColor, { ring: string; text: string; bg: string; badge: string }> = {
  green: {
    ring:  "border-emerald-500/40",
    text:  "text-emerald-400",
    bg:    "bg-emerald-500/10",
    badge: "bg-emerald-500/20 text-emerald-300",
  },
  amber: {
    ring:  "border-amber-500/40",
    text:  "text-amber-400",
    bg:    "bg-amber-500/10",
    badge: "bg-amber-500/20 text-amber-300",
  },
  red: {
    ring:  "border-red-500/50",
    text:  "text-red-400",
    bg:    "bg-red-500/10",
    badge: "bg-red-500/20 text-red-300",
  },
};

export default function BottleCard({ timer, onReset, onIntervalChange }: Props) {
  const elapsed = useElapsed(timer.last_reset_at);
  const status  = getStatus(elapsed, timer.interval_minutes);
  const styles  = STATUS_STYLES[status];
  const isOverdue = status === "red";

  const [resetting, setResetting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [intervalInput, setIntervalInput] = useState(String(Math.round(timer.interval_minutes / 60)));

  async function handleReset() {
    setResetting(true);
    try {
      await fetch(`/api/baby/timers/${timer.id}/reset`, { method: "POST" });
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
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interval_minutes: mins }),
    });
    onIntervalChange(mins);
    setShowSettings(false);
  }

  return (
    <div className={`rounded-2xl border-2 ${styles.ring} ${styles.bg} p-5`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${styles.bg} border ${styles.ring}`}>
            <Milk className={`w-4 h-4 ${styles.text}`} />
          </div>
          <span className="font-semibold text-white text-sm">Milk</span>
          {isOverdue && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${styles.badge}`}>
              OVERDUE
            </span>
          )}
        </div>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-700/60 transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Elapsed time */}
      <div className="text-center my-4">
        <p className={`text-4xl font-bold tabular-nums ${styles.text}`}>
          {fmtElapsed(elapsed)}
        </p>
        <p className="text-slate-400 text-xs mt-1">
          ago · last at {fmtTime(timer.last_reset_at)}
        </p>
        <p className="text-slate-600 text-[10px] mt-0.5">
          every {timer.interval_minutes >= 60
            ? `${timer.interval_minutes / 60}h`
            : `${timer.interval_minutes}min`}
        </p>
      </div>

      {/* Reset button */}
      <button
        onClick={handleReset}
        disabled={resetting}
        className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
          resetting
            ? "bg-slate-700 text-slate-500 cursor-not-allowed"
            : `${styles.bg} border ${styles.ring} ${styles.text} hover:brightness-110 active:scale-95`
        }`}
      >
        {resetting ? (
          <RotateCcw className="w-4 h-4 animate-spin" />
        ) : (
          <Check className="w-4 h-4" />
        )}
        Just fed
      </button>

      {/* Interval settings */}
      {showSettings && (
        <div className="mt-4 pt-4 border-t border-slate-700/50">
          <p className="text-xs text-slate-400 mb-2">Feeding interval (hours)</p>
          <div className="flex gap-2">
            <input
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={intervalInput}
              onChange={(e) => setIntervalInput(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500/60"
            />
            <button
              onClick={handleSaveInterval}
              className="px-3 py-2 bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-lg text-sm hover:bg-rose-500/30 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setShowSettings(false)}
              className="px-3 py-2 bg-slate-700/50 text-slate-400 rounded-lg text-sm hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
