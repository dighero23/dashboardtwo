"use client";

import { useState, useEffect } from "react";
import { Pill, RotateCcw, Check, Pencil, Trash2, X, Clock } from "lucide-react";
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

function toLocalDateTimeInput(iso: string): string {
  const d   = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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

// Small circular ring for medication cards
function MiniRing({ pct, status }: { pct: number; status: Status }) {
  const r = 22, cx = 28, cy = 28;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(pct, 1) * circ;
  const strokeColor =
    status === "red"   ? "#ef4444" :
    status === "amber" ? "#f59e0b" :
                         "#10b981";
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth="5" />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={strokeColor}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        style={{ transition: "stroke-dasharray 0.5s ease, stroke 0.5s ease" }}
      />
    </svg>
  );
}

type Panel = "none" | "manual" | "edit";

export default function MedicationCard({ timer, onReset, onEdit, onDelete }: Props) {
  const [localResetAt, setLocalResetAt] = useState(timer.last_reset_at);
  useEffect(() => { setLocalResetAt(timer.last_reset_at); }, [timer.last_reset_at]);

  const elapsed   = useElapsed(localResetAt);
  const status    = getStatus(elapsed, timer.interval_minutes);
  const isOverdue = status === "red";
  const pct       = elapsed / (timer.interval_minutes * 60);

  const [resetting,   setResetting]   = useState(false);
  const [panel,       setPanel]       = useState<Panel>("none");
  const [confirmDel,  setConfirmDel]  = useState(false);
  const [manualTime,  setManualTime]  = useState(toLocalDateTimeInput(timer.last_reset_at));
  const [nameInput,   setNameInput]   = useState(timer.name ?? "");
  const [hoursInput,  setHoursInput]  = useState(String(timer.interval_minutes / 60));

  const textColor =
    status === "red"   ? "text-red-400" :
    status === "amber" ? "text-amber-400" :
                         "text-emerald-400";

  const borderColor =
    status === "red"   ? "border-red-500/30" :
    status === "amber" ? "border-amber-500/30" :
                         "border-slate-700/50";

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
      onEdit(await res.json());
      setPanel("none");
    }
  }

  async function handleDelete() {
    await fetch(`/api/baby/timers/${timer.id}`, { method: "DELETE" });
    onDelete(timer.id);
  }

  const intervalLabel = timer.interval_minutes % 60 === 0
    ? `${timer.interval_minutes / 60}h`
    : `${timer.interval_minutes}min`;

  return (
    <div className={`rounded-2xl border ${borderColor} bg-slate-800/60 overflow-hidden`}>
      {/* Main row */}
      <div className="flex items-center gap-3 p-4">
        {/* Mini ring */}
        <div className="relative flex-shrink-0 w-14 h-14">
          <MiniRing pct={pct} status={status} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Pill className="w-4 h-4 text-violet-400" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="font-semibold text-white text-sm truncate">{timer.name}</span>
            {isOverdue && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 shrink-0 animate-pulse">
                OVERDUE
              </span>
            )}
          </div>
          <p className={`text-xl font-extrabold tabular-nums leading-none ${textColor}`}>
            {fmtElapsed(elapsed)}
            <span className="text-xs font-normal text-slate-500 ml-1">ago</span>
          </p>
          <p className="text-slate-500 text-[10px] mt-0.5">
            Last at {fmtTime(localResetAt)} · every {intervalLabel}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {/* Just gave */}
          <button
            onClick={() => doReset()}
            disabled={resetting}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
              resetting
                ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                : status === "red"
                  ? "bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30"
                  : status === "amber"
                    ? "bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30"
                    : "bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25"
            }`}
          >
            {resetting ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Just gave
          </button>

          {/* Icon row: manual time + edit + delete */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setManualTime(toLocalDateTimeInput(new Date().toISOString()));
                setPanel(panel === "manual" ? "none" : "manual");
                setConfirmDel(false);
              }}
              title="Set time manually"
              className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                panel === "manual" ? "bg-rose-500/20 text-rose-400" : "text-slate-500 hover:text-slate-300 hover:bg-slate-700/60"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setPanel(panel === "edit" ? "none" : "edit"); setConfirmDel(false); }}
              title="Edit"
              className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                panel === "edit" ? "bg-violet-500/20 text-violet-400" : "text-slate-500 hover:text-slate-300 hover:bg-slate-700/60"
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setConfirmDel((v) => !v); setPanel("none"); }}
              title="Delete"
              className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                confirmDel ? "bg-red-500/20 text-red-400" : "text-slate-500 hover:text-red-400 hover:bg-slate-700/60"
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Manual time panel */}
      {panel === "manual" && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-700/40">
          <p className="text-xs text-slate-400 mb-2 pt-3">When was it?</p>
          <input
            type="datetime-local"
            value={manualTime}
            onChange={(e) => setManualTime(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-rose-500/60 mb-2"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setPanel("none")}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-slate-700/50 rounded-lg text-slate-400 hover:bg-slate-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => doReset(localDateTimeToISO(manualTime))}
              disabled={resetting}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-lg hover:bg-rose-500/30 transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Edit panel */}
      {panel === "edit" && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-700/40 space-y-2">
          <p className="text-xs text-slate-400 pt-3">Edit</p>
          <input
            type="text"
            placeholder="Name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/60"
          />
          <div className="flex gap-2 items-center">
            <label className="text-xs text-slate-400 shrink-0">Every (h)</label>
            <input
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={hoursInput}
              onChange={(e) => setHoursInput(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/60"
            />
            <button
              onClick={handleSaveEdit}
              className="px-3 py-2 bg-violet-500/20 border border-violet-500/30 text-violet-300 rounded-lg text-xs hover:bg-violet-500/30 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setPanel("none")}
              className="w-9 h-9 flex items-center justify-center bg-slate-700/50 rounded-lg text-slate-400 hover:bg-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDel && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-700/40">
          <div className="flex items-center justify-between pt-3 gap-3">
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
        </div>
      )}
    </div>
  );
}
