"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import type { HealthEvent } from "@/lib/health/types";

interface Props {
  event: HealthEvent;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CompleteEventModal({ event, onClose, onSuccess }: Props) {
  const [completedDate, setCompletedDate] = useState(event.eventDate);
  const [notes,         setNotes]         = useState(event.notes ?? "");
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/health/events/${event.id}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completedDate,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Failed to save");
        return;
      }
      onSuccess();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-700/60">
          <h2 className="text-base font-semibold text-white">Mark as Completed</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <p className="text-sm text-slate-300 font-medium">{event.title}</p>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Completion date</label>
            <input
              type="date"
              value={completedDate}
              onChange={(e) => setCompletedDate(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
              required
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Notes <span className="text-slate-600">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Doctor said everything looks good..."
              className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !completedDate}
            className="w-full py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Mark as completed
          </button>
        </form>
      </div>
    </div>
  );
}
