"use client";

import { useState, useEffect } from "react";
import { Pill, RotateCcw, Check, Pencil, Trash2, X } from "lucide-react";
import type { BabyTimer } from "@/lib/baby/types";

interface Props {
  timer: BabyTimer;
  onReset: () => void;
  onEdit: (updated: BabyTimer) => void;
  onDelete: (id: string) => void;
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
    ring:  "border-emerald-500/30",
    text:  "text-emerald-400",
    bg:    "bg-emerald-500/8",
    badge: "bg-emerald-500/20 text-emerald-300",
  },
  amber: {
    ring:  "border-amber-500/40",
    text:  "text-amber-400",
    bg:    "bg-amber-500/8",
    badge: "bg-amber-500/20 text-amber-300",
  },
  red: {
    ring:  "border-red-500/50",
    text:  "text-red-400",
    bg:    "bg-red-500/8",
    badge: "bg-red-500/20 text-red-300",
  },
};

export default function MedicationCard({ timer, onReset, onEdit, onDelete }: Props) {
  const elapsed = useElapsed(timer.last_reset_at);
  const status  = getStatus(elapsed, timer.interval_minutes);
  const styles  = STATUS_STYLES[status];
  const isOverdue = status === "red";

  const [resetting,    setResetting]    = useState(false);
  const [editing,      setEditing]      = useState(false);
  const [confirmDel,   setConfirmDel]   = useState(false);
  const [nameInput,    setNameInput]    = useState(timer.name ?? "");
  const [hoursInput,   setHoursInput]   = useState(String(timer.interval_minutes / 60));

  async function handleReset() {
    setResetting(true);
    try {
      await fetch(`/api/baby/timers/${timer.id}/reset`, { method: "POST" });
      onReset();
    } finally {
      setResetting(false);
    }
  }

  async function handleSaveEdit() {
    const hours = parseFloat(hoursInput);
    if (!nameInput.trim() || isNaN(hours) || hours <= 0) return;
    const mins = Math.round(hours * 60);
    const res  = await fetch(`/api/baby/timers/${timer.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name: nameInput.trim(), interval_minutes: mins }),
    });
    if (res.ok) {
      const updated = await res.json();
      onEdit(updated);
      setEditing(false);
    }
  }

  async function handleDelete() {
    await fetch(`/api/baby/timers/${timer.id}`, { method: "DELETE" });
    onDelete(timer.id);
  }

  const intervalLabel = timer.interval_minutes >= 60
    ? `${timer.interval_minutes / 60}h`
    : `${timer.interval_minutes}min`;

  return (
    <div className={`rounded-2xl border ${styles.ring} bg-slate-800/60 p-4`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-violet-500/15 border border-violet-500/30">
            <Pill className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <span className="font-semibold text-white text-sm">{timer.name}</span>
          {isOverdue && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${styles.badge}`}>
              OVERDUE
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setEditing((v) => !v); setConfirmDel(false); }}
            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-700/60 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setConfirmDel((v) => !v); setEditing(false); }}
            className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
              confirmDel ? "bg-red-500/20 text-red-400" : "text-slate-500 hover:text-red-400 hover:bg-slate-700/60"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Time display */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className={`text-2xl font-bold tabular-nums ${styles.text}`}>{fmtElapsed(elapsed)}</p>
          <p className="text-slate-400 text-[11px]">ago · last at {fmtTime(timer.last_reset_at)}</p>
          <p className="text-slate-600 text-[10px]">every {intervalLabel}</p>
        </div>
        <button
          onClick={handleReset}
          disabled={resetting}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            resetting
              ? "bg-slate-700 text-slate-500 cursor-not-allowed"
              : `${styles.bg} border ${styles.ring} ${styles.text} hover:brightness-110 active:scale-95`
          }`}
        >
          {resetting ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Just gave
        </button>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="pt-3 border-t border-slate-700/50 space-y-2">
          <input
            type="text"
            placeholder="Medication name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/60"
          />
          <div className="flex gap-2 items-center">
            <label className="text-xs text-slate-400 shrink-0">Interval (h)</label>
            <input
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={hoursInput}
              onChange={(e) => setHoursInput(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/60"
            />
            <button
              onClick={handleSaveEdit}
              className="px-3 py-2 bg-violet-500/20 border border-violet-500/30 text-violet-300 rounded-lg text-xs hover:bg-violet-500/30 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="w-7 h-7 flex items-center justify-center bg-slate-700/50 rounded-lg text-slate-400 hover:bg-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDel && (
        <div className="pt-3 border-t border-slate-700/50 flex items-center justify-between gap-3">
          <p className="text-xs text-red-400">Delete &ldquo;{timer.name}&rdquo;?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDel(false)}
              className="text-xs text-slate-400 px-2 py-1 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="text-xs text-red-400 bg-red-500/20 hover:bg-red-500/30 px-2 py-1 rounded-lg transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
