"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import type { HealthEvent, Dependent, EventType } from "@/lib/health/types";

const EVENT_TYPES: { value: EventType; label: string; color: string }[] = [
  { value: "vaccine",     label: "Vaccine",     color: "text-blue-400 bg-blue-500/15 border-blue-500/30"   },
  { value: "appointment", label: "Appointment", color: "text-purple-400 bg-purple-500/15 border-purple-500/30" },
  { value: "study",       label: "Study",       color: "text-orange-400 bg-orange-500/15 border-orange-500/30" },
  { value: "other",       label: "Other",       color: "text-slate-400 bg-slate-500/15 border-slate-600/30"  },
];

interface Props {
  event:      HealthEvent;
  dependents: Dependent[];
  onClose:    () => void;
  onSuccess:  () => void;
}

export default function EditEventModal({ event, dependents, onClose, onSuccess }: Props) {
  const [title,       setTitle]       = useState(event.title);
  const [eventType,   setEventType]   = useState<EventType>(event.eventType);
  const [eventDate,   setEventDate]   = useState(event.eventDate);
  const [eventTime,   setEventTime]   = useState(event.eventTime?.slice(0, 5) ?? "");
  const [forType,     setForType]     = useState<"self" | "dependent">(event.forType);
  const [dependentId, setDependentId] = useState(event.dependentId ?? "");
  const [notes,       setNotes]       = useState(event.notes ?? "");
  const [alert1Week,  setAlert1Week]  = useState(event.alert1Week);
  const [alert1Day,   setAlert1Day]   = useState(event.alert1Day);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  function handleForWhom(val: string) {
    if (val === "self") {
      setForType("self");
      setDependentId("");
    } else {
      setForType("dependent");
      setDependentId(val);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !eventDate) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/health/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:       title.trim(),
          eventType,
          eventDate,
          eventTime:   eventTime || null,
          forType,
          dependentId: forType === "dependent" ? dependentId : null,
          notes:       notes.trim() || null,
          alert1Week,
          alert1Day,
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
          <h2 className="text-base font-semibold text-white">Edit Event</h2>
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

          {/* Title */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Event name</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='e.g. "Vacuna influenza", "Chequeo gastro"'
              className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50"
              required
              autoFocus
            />
          </div>

          {/* Type selector */}
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Type</label>
            <div className="grid grid-cols-4 gap-1.5">
              {EVENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setEventType(t.value)}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium transition-all ${
                    eventType === t.value
                      ? t.color
                      : "text-slate-500 bg-slate-700/30 border-slate-700/50 hover:border-slate-600"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* For whom */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">For whom</label>
            <select
              value={forType === "self" ? "self" : dependentId}
              onChange={(e) => handleForWhom(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
            >
              <option value="self">Myself</option>
              {dependents.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Date + Time */}
          <div className="flex gap-3 items-start">
            <div className="flex-1 min-w-0">
              <label className="text-xs text-slate-400 block mb-1">Date</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
                required
              />
            </div>
            <div className="w-32 flex-shrink-0">
              <label className="text-xs text-slate-400 block mb-1">
                Time <span className="text-slate-600">(opt.)</span>
              </label>
              <input
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
              />
            </div>
          </div>

          {/* Alert toggles */}
          <div>
            <label className="text-xs text-slate-400 block mb-2">Push alerts</label>
            <div className="space-y-2">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-300">1 week before <span className="text-[11px] text-slate-500">(Mon 12pm CST)</span></span>
                <button
                  type="button"
                  onClick={() => setAlert1Week((v) => !v)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
                    alert1Week ? "bg-teal-500" : "bg-slate-600"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${alert1Week ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-slate-300">1 day before <span className="text-[11px] text-slate-500">(12pm CST)</span></span>
                <button
                  type="button"
                  onClick={() => setAlert1Day((v) => !v)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
                    alert1Day ? "bg-teal-500" : "bg-slate-600"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${alert1Day ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Notes <span className="text-slate-600">(optional)</span></label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Doctor name, clinic, instructions..."
              className="w-full bg-slate-900/60 border border-slate-600/50 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !title.trim() || !eventDate}
            className="w-full py-2.5 rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-300 text-sm font-medium hover:bg-teal-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}
