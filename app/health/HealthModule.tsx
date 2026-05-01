"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Heart, Plus, Check, Trash2, Users, Calendar, ClipboardList, LogIn, AlertCircle,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import LoginModal from "@/app/stocks/components/LoginModal";
import PushSubscribeButton from "@/app/stocks/components/PushSubscribeButton";
import type { HealthEvent, Dependent, EventType } from "@/lib/health/types";
import AddEventModal from "./components/AddEventModal";
import AddDependentModal from "./components/AddDependentModal";
import CompleteEventModal from "./components/CompleteEventModal";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Tab = "upcoming" | "history" | "family";

const TYPE_CFG: Record<EventType, { label: string; color: string; bg: string; border: string }> = {
  vaccine:     { label: "Vaccine",     color: "text-blue-400",   bg: "bg-blue-500/15",   border: "border-l-blue-500"   },
  appointment: { label: "Appointment", color: "text-purple-400", bg: "bg-purple-500/15", border: "border-l-purple-500" },
  study:       { label: "Study",       color: "text-orange-400", bg: "bg-orange-500/15", border: "border-l-orange-500" },
  other:       { label: "Other",       color: "text-slate-400",  bg: "bg-slate-500/15",  border: "border-l-slate-500"  },
};

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function daysUntil(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const now    = Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  return Math.round((target - now) / 86_400_000);
}

function DaysChip({ days }: { days: number }) {
  if (days < 0)  return <span className="text-[11px] font-semibold text-red-400 bg-red-500/15 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertCircle className="w-3 h-3" />Overdue</span>;
  if (days === 0) return <span className="text-[11px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">Today</span>;
  if (days === 1) return <span className="text-[11px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">Tomorrow</span>;
  if (days < 7)   return <span className="text-[11px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">{days}d</span>;
  return <span className="text-[11px] text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full">{days}d</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HealthModule() {
  const { user, loading: authLoading, canEditHealth } = usePermissions();
  const [showLogin,  setShowLogin]  = useState(false);
  const [tab,        setTab]        = useState<Tab>("upcoming");

  const [events,     setEvents]     = useState<HealthEvent[]>([]);
  const [history,    setHistory]    = useState<HealthEvent[]>([]);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [loading,    setLoading]    = useState(false);

  const [showAddEvent,      setShowAddEvent]      = useState(false);
  const [showAddDependent,  setShowAddDependent]  = useState(false);
  const [completingEvent,   setCompletingEvent]   = useState<HealthEvent | null>(null);
  const [confirmDeleteId,   setConfirmDeleteId]   = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/health/events");
      const json = await res.json();
      setEvents(json.events ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    const res  = await fetch("/api/health/events/history");
    const json = await res.json();
    setHistory(json.events ?? []);
  }, []);

  const loadDependents = useCallback(async () => {
    const res  = await fetch("/api/health/dependents");
    const json = await res.json();
    setDependents(json.dependents ?? []);
  }, []);

  useEffect(() => {
    if (!user || !canEditHealth) return;
    loadEvents();
    loadDependents();
  }, [user, canEditHealth, loadEvents, loadDependents]);

  useEffect(() => {
    if (!user || !canEditHealth || tab !== "history") return;
    loadHistory();
  }, [user, canEditHealth, tab, loadHistory]);

  async function deleteEvent(id: string) {
    await fetch(`/api/health/events/${id}`, { method: "DELETE" });
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setHistory((prev) => prev.filter((e) => e.id !== id));
    setConfirmDeleteId(null);
  }

  async function deleteDependent(id: string) {
    await fetch(`/api/health/dependents/${id}`, { method: "DELETE" });
    setDependents((prev) => prev.filter((d) => d.id !== id));
    setEvents((prev) => prev.filter((e) => e.dependentId !== id));
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (authLoading) return <main className="min-h-screen bg-slate-900" />;

  // ── Not logged in ────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4 gap-4">
        <Heart className="w-10 h-10 text-red-400/40" />
        <p className="text-slate-400 text-sm">Sign in to access Family Health</p>
        <button
          onClick={() => setShowLogin(true)}
          className="flex items-center gap-2 text-sm text-white bg-red-500/20 border border-red-500/30 px-4 py-2 rounded-xl hover:bg-red-500/30 transition-colors"
        >
          <LogIn className="w-4 h-4" /> Sign in
        </button>
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />}
      </main>
    );
  }

  // ── No permission ────────────────────────────────────────────────────────────
  if (!canEditHealth) {
    return (
      <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4 gap-3">
        <Heart className="w-10 h-10 text-red-400/40" />
        <p className="text-slate-400 text-sm text-center">You don't have access to Family Health.</p>
        <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Back to home</Link>
      </main>
    );
  }

  const overdueCount = events.filter((e) => daysUntil(e.eventDate) < 0).length;

  // ── Main UI ──────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-900 pb-16">
      {/* Header */}
      <div className="px-4 pt-10 sm:pt-14 pb-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60"
          >
            ← Home
          </Link>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "#0d948820", border: "1px solid #0d948844" }}
            >
              <Heart className="w-4 h-4 text-teal-400" />
            </div>
            <h1 className="text-lg font-bold text-white">Family Health</h1>
          </div>
          <PushSubscribeButton mobile />
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-slate-800/60 border border-slate-700/50 rounded-xl p-1">
          {(["upcoming", "history", "family"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all capitalize relative ${
                tab === t ? "bg-slate-700 text-white shadow" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t === "upcoming" ? "Upcoming" : t === "history" ? "History" : "Family"}
              {t === "upcoming" && overdueCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center">
                  {overdueCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 max-w-lg mx-auto">

        {/* ── Upcoming ────────────────────────────────────────────────────────── */}
        {tab === "upcoming" && (
          <div className="space-y-2">
            {loading && [1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-slate-800/40 border border-slate-700/50 animate-pulse" />
            ))}

            {!loading && events.length === 0 && (
              <div className="text-center py-14">
                <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No upcoming events</p>
                <p className="text-slate-600 text-xs mt-1">Tap + to add your first event</p>
              </div>
            )}

            {!loading && events.map((e) => {
              const days     = daysUntil(e.eventDate);
              const cfg      = TYPE_CFG[e.eventType];
              const isOverdue = days < 0;
              const isDeleting = confirmDeleteId === e.id;

              return (
                <div
                  key={e.id}
                  className={`rounded-2xl border border-l-4 px-4 py-3 transition-colors ${
                    isOverdue
                      ? "bg-red-950/20 border-slate-700/50 border-l-red-500"
                      : `bg-slate-800/60 border-slate-700/50 ${cfg.border}`
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.color} ${cfg.bg}`}>
                          {cfg.label}
                        </span>
                        {e.dependentName && (
                          <span className="text-[10px] text-slate-500">{e.dependentName}</span>
                        )}
                      </div>
                      <p className={`text-sm font-medium ${isOverdue ? "text-red-200" : "text-white"}`}>
                        {e.title}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {fmtDate(e.eventDate)}{e.eventTime ? ` · ${e.eventTime.slice(0, 5)}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <DaysChip days={days} />
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setCompletingEvent(e)}
                          title="Mark complete"
                          className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(isDeleting ? null : e.id)}
                          title="Delete"
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                            isDeleting ? "bg-red-500/30" : "bg-slate-700/50 hover:bg-red-500/20"
                          }`}
                        >
                          <Trash2 className={`w-3.5 h-3.5 transition-colors ${isDeleting ? "text-red-400" : "text-slate-500 hover:text-red-400"}`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Delete confirmation */}
                  {isDeleting && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                      <p className="text-xs text-red-400">Delete "{e.title}"? This cannot be undone.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-700 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => deleteEvent(e.id)}
                          className="text-xs text-red-400 bg-red-500/20 hover:bg-red-500/30 px-2 py-1 rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}

                  {e.notes && !isDeleting && (
                    <p className="text-[11px] text-slate-500 mt-2 border-t border-slate-700/50 pt-2">{e.notes}</p>
                  )}
                </div>
              );
            })}

            <button
              onClick={() => setShowAddEvent(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-slate-700 text-slate-500 hover:text-teal-400 hover:border-teal-500/40 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" /> Add event
            </button>
          </div>
        )}

        {/* ── History ─────────────────────────────────────────────────────────── */}
        {tab === "history" && (
          <div className="space-y-2">
            {history.length === 0 && (
              <div className="text-center py-14">
                <ClipboardList className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No history yet</p>
              </div>
            )}

            {history.map((e) => {
              const cfg = TYPE_CFG[e.eventType];
              return (
                <div
                  key={e.id}
                  className={`rounded-2xl bg-slate-800/40 border border-l-4 border-slate-700/40 ${cfg.border} px-4 py-3 opacity-70`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.color} ${cfg.bg}`}>
                          {cfg.label}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full text-emerald-400 bg-emerald-500/10">
                          completed
                        </span>
                        {e.dependentName && (
                          <span className="text-[10px] text-slate-500">{e.dependentName}</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400">{e.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Scheduled {fmtDate(e.eventDate)}
                        {e.completedDate && e.completedDate !== e.eventDate
                          ? ` · Done ${fmtDate(e.completedDate)}`
                          : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteEvent(e.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-700/50 hover:bg-red-500/20 group transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-red-400 transition-colors" />
                    </button>
                  </div>
                  {e.notes && (
                    <p className="text-[11px] text-slate-500 mt-2 border-t border-slate-700/50 pt-2">{e.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Family ──────────────────────────────────────────────────────────── */}
        {tab === "family" && (
          <div className="space-y-2">
            {dependents.length === 0 && (
              <div className="text-center py-14">
                <Users className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No family members added</p>
              </div>
            )}

            {dependents.map((dep) => {
              const upcomingCount = events.filter((e) => e.dependentId === dep.id).length;
              return (
                <div
                  key={dep.id}
                  className="rounded-2xl bg-slate-800/60 border border-slate-700/50 px-4 py-3 flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-teal-400">{dep.name[0].toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{dep.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {upcomingCount > 0
                        ? `${upcomingCount} upcoming event${upcomingCount > 1 ? "s" : ""}`
                        : "No upcoming events"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (!confirm(`Delete ${dep.name} and all their events? This cannot be undone.`)) return;
                      deleteDependent(dep.id);
                    }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-700/50 hover:bg-red-500/20 group transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-red-400 transition-colors" />
                  </button>
                </div>
              );
            })}

            <button
              onClick={() => setShowAddDependent(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-slate-700 text-slate-500 hover:text-teal-400 hover:border-teal-500/40 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" /> Add family member
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddEvent && (
        <AddEventModal
          dependents={dependents}
          onClose={() => setShowAddEvent(false)}
          onSuccess={() => { setShowAddEvent(false); loadEvents(); }}
        />
      )}
      {showAddDependent && (
        <AddDependentModal
          onClose={() => setShowAddDependent(false)}
          onSuccess={(dep) => { setShowAddDependent(false); setDependents((prev) => [...prev, dep]); }}
        />
      )}
      {completingEvent && (
        <CompleteEventModal
          event={completingEvent}
          onClose={() => setCompletingEvent(null)}
          onSuccess={() => {
            setCompletingEvent(null);
            loadEvents();
          }}
        />
      )}
      {showLogin && (
        <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />
      )}
    </main>
  );
}
