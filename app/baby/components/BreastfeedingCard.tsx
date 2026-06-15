"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { RotateCcw } from "lucide-react";

const ALERT_SECS = 15 * 60; // 15 minutes

interface SideState {
  running: boolean;
  elapsed: number;  // seconds
  startedAt: number | null; // Date.now() when last started
}

const INITIAL: SideState = { running: false, elapsed: 0, startedAt: null };

function fmtTimer(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Play a short beep via Web Audio API
function playAlert() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } catch {
    // AudioContext not available (SSR or permission denied)
  }
}

interface CircleTimerProps {
  label: string;
  state: SideState;
  onToggle: () => void;
}

function CircleTimer({ label, state, onToggle }: CircleTimerProps) {
  const [display, setDisplay] = useState(state.elapsed);
  const alerted = useRef(false);

  useEffect(() => {
    alerted.current = state.elapsed >= ALERT_SECS;
  }, [state.elapsed]);

  useEffect(() => {
    if (!state.running) {
      setDisplay(state.elapsed);
      return;
    }
    function tick() {
      const current = state.elapsed + Math.floor((Date.now() - (state.startedAt ?? Date.now())) / 1000);
      setDisplay(current);
      // Fire alert exactly once when crossing 15 min threshold
      if (current >= ALERT_SECS && !alerted.current) {
        alerted.current = true;
        playAlert();
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate([300, 100, 300]);
        }
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state.running, state.elapsed, state.startedAt]);

  const isOverThreshold = display >= ALERT_SECS;
  const isRunning       = state.running;

  // Circle progress (capped at 100%)
  const pct = Math.min(display / ALERT_SECS, 1);
  const radius = 44;
  const circ   = 2 * Math.PI * radius;
  const dash   = pct * circ;

  const ringColor   = isOverThreshold ? "#ef4444" : isRunning ? "#be185d" : "#475569";
  const textColor   = isOverThreshold ? "text-red-400" : isRunning ? "text-rose-400" : "text-slate-400";
  const outerBorder = isOverThreshold ? "border-red-500/50" : isRunning ? "border-rose-500/40" : "border-slate-700/50";

  return (
    <button
      onClick={onToggle}
      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${outerBorder} ${
        isRunning ? "bg-rose-500/5 active:scale-95" : "bg-slate-800/60 hover:bg-slate-800 active:scale-95"
      }`}
    >
      {/* SVG circle */}
      <div className="relative w-28 h-28">
        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
          {/* Track */}
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#1e293b" strokeWidth="6" />
          {/* Progress */}
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="6"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.5s ease, stroke 0.5s ease" }}
          />
        </svg>
        {/* Time in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-xl font-bold tabular-nums ${textColor}`}>
            {fmtTimer(display)}
          </span>
          {isOverThreshold && (
            <span className="text-[9px] text-red-400 font-semibold">15 min+</span>
          )}
        </div>
      </div>
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      <span className={`text-[10px] font-medium ${isRunning ? "text-rose-400" : "text-slate-600"}`}>
        {isRunning ? "Tap to pause" : display > 0 ? "Tap to resume" : "Tap to start"}
      </span>
    </button>
  );
}

export default function BreastfeedingCard() {
  const [left,  setLeft]  = useState<SideState>(INITIAL);
  const [right, setRight] = useState<SideState>(INITIAL);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("bf_timer");
      if (saved) {
        const { left: l, right: r } = JSON.parse(saved);
        // If was running when page closed, adjust elapsed
        const adjust = (s: SideState): SideState => {
          if (!s.running || !s.startedAt) return s;
          const extra = Math.floor((Date.now() - s.startedAt) / 1000);
          return { ...s, elapsed: s.elapsed + extra, startedAt: Date.now() };
        };
        setLeft(adjust(l));
        setRight(adjust(r));
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist to localStorage on every state change
  useEffect(() => {
    try {
      localStorage.setItem("bf_timer", JSON.stringify({ left, right }));
    } catch {
      // ignore
    }
  }, [left, right]);

  function toggle(side: "left" | "right") {
    const setter = side === "left" ? setLeft : setRight;
    setter((prev) => {
      if (prev.running) {
        // Pause: accumulate elapsed
        const extra = Math.floor((Date.now() - (prev.startedAt ?? Date.now())) / 1000);
        return { running: false, elapsed: prev.elapsed + extra, startedAt: null };
      } else {
        // Start/resume
        return { ...prev, running: true, startedAt: Date.now() };
      }
    });
  }

  function reset() {
    setLeft(INITIAL);
    setRight(INITIAL);
    try { localStorage.removeItem("bf_timer"); } catch { /* ignore */ }
  }

  const anyRunning = left.running || right.running;
  const anyActive  = left.elapsed > 0 || right.elapsed > 0 || anyRunning;

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
            <span className="text-rose-400 text-sm font-bold">♡</span>
          </div>
          <span className="font-semibold text-white text-sm">Breastfeeding</span>
        </div>
        {anyActive && (
          <button
            onClick={reset}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded-lg hover:bg-slate-700/60 transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <CircleTimer label="Left" state={left} onToggle={() => toggle("left")} />
        <CircleTimer label="Right" state={right} onToggle={() => toggle("right")} />
      </div>

      {anyActive && (
        <p className="text-center text-[10px] text-slate-600 mt-3">
          Tap a circle to start · pause · resume · 15 min = red alert
        </p>
      )}
      {!anyActive && (
        <p className="text-center text-[10px] text-slate-600 mt-3">
          Tap a circle to start · both sides can run at the same time
        </p>
      )}
    </div>
  );
}
