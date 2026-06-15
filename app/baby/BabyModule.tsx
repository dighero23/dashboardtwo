"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Baby, LogIn, Plus, Wifi, WifiOff } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { createClient } from "@/lib/supabase/client";
import LoginModal from "@/app/components/LoginModal";
import PushSubscribeButton from "@/app/components/PushSubscribeButton";
import BottleCard from "./components/BottleCard";
import MedicationCard from "./components/MedicationCard";
import BreastfeedingCard from "./components/BreastfeedingCard";
import DailyHistory from "./components/DailyHistory";
import AddMedModal from "./components/AddMedModal";
import type { BabyTimer } from "@/lib/baby/types";

export default function BabyModule() {
  const { user, loading: authLoading, canEditBaby } = usePermissions();

  const [timers,     setTimers]     = useState<BabyTimer[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [showLogin,  setShowLogin]  = useState(false);
  const [showAddMed, setShowAddMed] = useState(false);
  const [realtimeOk, setRealtimeOk] = useState(false);
  const [logTick,    setLogTick]    = useState(0);

  const loadTimers = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/baby/timers");
      const json = await res.json();
      setTimers(json.timers ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!user || !canEditBaby) return;
    loadTimers();
  }, [user, canEditBaby, loadTimers]);

  // Supabase Realtime â€” listen for baby_timers changes
  useEffect(() => {
    if (!user || !canEditBaby) return;
    const supabase = createClient();
    const channel  = supabase
      .channel("baby_timers_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "baby_timers" },
        () => {
          // Another parent changed a timer â€” reload state from DB
          loadTimers();
          setLogTick((t) => t + 1);
        }
      )
      .subscribe((status) => {
        setRealtimeOk(status === "SUBSCRIBED");
      });

    return () => { supabase.removeChannel(channel); };
  }, [user, canEditBaby, loadTimers]);

  function handleReset() {
    loadTimers();
    setLogTick((t) => t + 1);
  }

  function handleIntervalChange(timerId: string, minutes: number) {
    setTimers((prev) =>
      prev.map((t) => t.id === timerId ? { ...t, interval_minutes: minutes } : t)
    );
  }

  function handleMedEdit(updated: BabyTimer) {
    setTimers((prev) => prev.map((t) => t.id === updated.id ? updated : t));
  }

  function handleMedDelete(id: string) {
    setTimers((prev) => prev.filter((t) => t.id !== id));
  }

  // â”€â”€ Loading skeleton â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (authLoading) return <main className="min-h-screen bg-slate-900" />;

  // â”€â”€ Not logged in â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!user) {
    return (
      <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4 gap-4">
        <Baby className="w-10 h-10 text-rose-400/40" />
        <p className="text-slate-400 text-sm">Sign in to access Baby Tracker</p>
        <button
          onClick={() => setShowLogin(true)}
          className="flex items-center gap-2 text-sm text-white bg-rose-500/20 border border-rose-500/30 px-4 py-2 rounded-xl hover:bg-rose-500/30 transition-colors"
        >
          <LogIn className="w-4 h-4" /> Sign in
        </button>
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />}
      </main>
    );
  }

  // â”€â”€ No permission â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!canEditBaby) {
    return (
      <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4 gap-3">
        <Baby className="w-10 h-10 text-rose-400/40" />
        <p className="text-slate-400 text-sm text-center">Access restricted â€” contact admin</p>
        <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">â† Back to home</Link>
      </main>
    );
  }

  const bottleTimer = timers.find((t) => t.type === "bottle");
  const medTimers   = timers.filter((t) => t.type === "medication");

  // â”€â”€ Main UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <main className="min-h-screen bg-slate-900 pb-16">
      {/* Header */}
      <div className="px-4 pt-10 sm:pt-14 pb-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60"
          >
            â† Home
          </Link>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-rose-500/15 border border-rose-500/30">
              <Baby className="w-4 h-4 text-rose-400" />
            </div>
            <h1 className="text-lg font-bold text-white">Baby Tracker</h1>
            {/* Realtime indicator */}
            <span title={realtimeOk ? "Synced in real-time" : "Not synced"}>
              {realtimeOk
                ? <Wifi className="w-3.5 h-3.5 text-emerald-500/70" />
                : <WifiOff className="w-3.5 h-3.5 text-slate-600" />
              }
            </span>
          </div>

          <PushSubscribeButton mobile />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 max-w-lg mx-auto space-y-4">
        {/* Bottle card */}
        {loading && !bottleTimer && (
          <div className="h-52 rounded-2xl bg-slate-800/40 animate-pulse" />
        )}
        {bottleTimer && (
          <BottleCard
            timer={bottleTimer}
            onReset={handleReset}
            onIntervalChange={(mins) => handleIntervalChange(bottleTimer.id, mins)}
          />
        )}

        {/* Medication cards */}
        {medTimers.map((timer) => (
          <MedicationCard
            key={timer.id}
            timer={timer}
            onReset={handleReset}
            onEdit={handleMedEdit}
            onDelete={handleMedDelete}
          />
        ))}

        {/* Add medication button */}
        <button
          onClick={() => setShowAddMed(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-slate-700 text-slate-500 hover:text-violet-400 hover:border-violet-500/40 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" /> Add medication
        </button>

        {/* Breastfeeding timer */}
        <BreastfeedingCard />

        {/* Daily history */}
        <DailyHistory refreshTick={logTick} />
      </div>

      {/* Modals */}
      {showAddMed && (
        <AddMedModal
          onClose={() => setShowAddMed(false)}
          onSuccess={(timer) => {
            setTimers((prev) => [...prev, timer]);
            setShowAddMed(false);
          }}
        />
      )}
      {showLogin && (
        <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />
      )}
    </main>
  );
}

