"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import type { BabyTimer } from "@/lib/baby/types";

interface Props {
  onClose: () => void;
  onSuccess: (timer: BabyTimer) => void;
}

export default function AddMedModal({ onClose, onSuccess }: Props) {
  const [name,  setName]  = useState("");
  const [hours, setHours] = useState("8");
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  async function handleSubmit() {
    if (!name.trim()) { setErr("Name is required"); return; }
    const h = parseFloat(hours);
    if (isNaN(h) || h <= 0) { setErr("Valid interval required"); return; }
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/baby/timers", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: name.trim(), interval_minutes: Math.round(h * 60) }),
      });
      if (!res.ok) { setErr("Failed to create"); return; }
      const data = await res.json();
      onSuccess(data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-sm bg-slate-800 border border-slate-700/60 rounded-2xl shadow-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Add medication</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Name</label>
            <input
              autoFocus
              type="text"
              placeholder="e.g. Vitamin D"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/60"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Interval (hours)</label>
            <input
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/60"
            />
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm text-slate-400 bg-slate-700/50 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-violet-500/30 border border-violet-500/40 hover:bg-violet-500/40 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {saving ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
