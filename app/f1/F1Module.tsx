"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Flag, LogIn, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import LoginModal from "@/app/stocks/components/LoginModal";
import type {
  NextRaceResponse,
  LastRaceResponse,
  UpcomingRace,
  StandingsResponse,
  F1NotificationPrefs,
} from "@/lib/f1/types";
import { type Timezone } from "./constants";
import LastRaceCard       from "./components/LastRaceCard";
import NextRaceCard       from "./components/NextRaceCard";
import UpcomingList       from "./components/UpcomingList";
import Standings          from "./components/Standings";
import MyDriverCard       from "./components/MyDriverCard";
import MyTeamCard         from "./components/MyTeamCard";
import NotificationsCard  from "./components/NotificationsCard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MyPick { id: string; name: string; }

const NOTIF_DEFAULTS: F1NotificationPrefs = {
  weekAhead: true, preQuali: true, qualiResult: true, preRace: true, raceResult: false,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function F1Module() {
  // Auth + permissions
  const { user, loading: authLoading, canEditF1 } = usePermissions();
  const [showLogin, setShowLogin] = useState(false);

  // Preferences
  const [timezone, setTimezone] = useState<Timezone>("CST");
  const [myDriver, setMyDriver] = useState<MyPick | null>(null);
  const [myTeam,   setMyTeam]   = useState<MyPick | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<F1NotificationPrefs>(NOTIF_DEFAULTS);

  // Data
  const [nextRace,  setNextRace]  = useState<NextRaceResponse | null>(null);
  const [lastRace,  setLastRace]  = useState<LastRaceResponse  | null>(null);
  const [upcoming,  setUpcoming]  = useState<UpcomingRace[]>([]);
  const [standings, setStandings] = useState<StandingsResponse | null>(null);
  const [seasons,   setSeasons]   = useState<number[]>([new Date().getFullYear()]);
  const [selectedSeason, setSelectedSeason] = useState(new Date().getFullYear());

  // ── Load notification prefs when user has F1 access ──────────────────────
  useEffect(() => {
    if (!user || !canEditF1) return;
    fetch("/api/f1/notifications")
      .then((r) => r.json())
      .then((p: F1NotificationPrefs) => setNotifPrefs(p))
      .catch(() => {});
  }, [user, canEditF1]);

  // ── Hydrate localStorage preferences (client-only) ────────────────────────
  useEffect(() => {
    try {
      const tz = localStorage.getItem("f1-timezone") as Timezone | null;
      if (tz === "CST" || tz === "EST" || tz === "LOCAL") setTimezone(tz);

      const driver = localStorage.getItem("f1-my-driver");
      if (driver) setMyDriver(JSON.parse(driver) as MyPick);

      const team = localStorage.getItem("f1-my-team");
      if (team) setMyTeam(JSON.parse(team) as MyPick);

      const prefs = localStorage.getItem("f1-notif-prefs");
      if (prefs) setNotifPrefs(JSON.parse(prefs) as F1NotificationPrefs);
    } catch {}
  }, []);

  // ── Fetch seasons list ────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/f1/seasons")
      .then((r) => r.json())
      .then(({ seasons }: { seasons: number[] }) => setSeasons(seasons))
      .catch(() => {});
  }, []);

  // ── Fetch main data on mount ───────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [nextRes, lastRes, upcomingRes] = await Promise.allSettled([
        fetch("/api/f1/next-race").then((r) => r.json()),
        fetch("/api/f1/last-race").then((r) => r.json()),
        fetch("/api/f1/upcoming").then((r) => r.json()),
      ]);
      if (nextRes.status     === "fulfilled") setNextRace(nextRes.value as NextRaceResponse);
      if (lastRes.status     === "fulfilled") setLastRace(lastRes.value as LastRaceResponse);
      if (upcomingRes.status === "fulfilled") {
        const data = upcomingRes.value as { races: UpcomingRace[] };
        setUpcoming(data.races ?? []);
      }
    }
    load();
  }, []);

  // ── Fetch standings when season changes ────────────────────────────────────
  useEffect(() => {
    fetch(`/api/f1/standings?season=${selectedSeason}`)
      .then((r) => r.json())
      .then((data: StandingsResponse) => setStandings(data))
      .catch(() => {});
  }, [selectedSeason]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleTimezone(tz: Timezone) {
    setTimezone(tz);
    localStorage.setItem("f1-timezone", tz);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  function handleDriverChange(id: string, name: string) {
    const pick: MyPick = { id, name };
    setMyDriver(pick);
    localStorage.setItem("f1-my-driver", JSON.stringify(pick));
  }

  function handleTeamChange(id: string, name: string) {
    const pick: MyPick = { id, name };
    setMyTeam(pick);
    localStorage.setItem("f1-my-team", JSON.stringify(pick));
  }

  const handleNotifToggle = useCallback(
    async (key: keyof F1NotificationPrefs, value: boolean) => {
      const newPrefs = { ...notifPrefs, [key]: value };
      setNotifPrefs(newPrefs);
      if (canEditF1) {
        await fetch("/api/f1/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newPrefs),
        });
      } else {
        localStorage.setItem("f1-notif-prefs", JSON.stringify(newPrefs));
      }
    },
    [notifPrefs, canEditF1]
  );

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-900">
      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Back */}
          <Link
            href="/"
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          {/* Title */}
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: "#fbbf2422", border: "1px solid #fbbf2455" }}
            >
              <Flag className="w-3.5 h-3.5" style={{ color: "#fbbf24" }} />
            </div>
            <span className="font-semibold text-white text-sm sm:text-base">Formula 1</span>
          </div>

          {/* Right controls: timezone + auth */}
          <div className="flex items-center gap-2">
            <div className="flex items-center text-xs rounded-lg border border-slate-700 overflow-hidden">
              {(["CST", "EST", "LOCAL"] as Timezone[]).map((tz) => (
                <button
                  key={tz}
                  onClick={() => handleTimezone(tz)}
                  className={`px-2 py-1 transition-colors ${
                    timezone === tz
                      ? "bg-slate-700 text-white font-medium"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  {tz}
                </button>
              ))}
            </div>
            {!authLoading && user && (
              <button
                onClick={handleLogout}
                title="Sign out"
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 transition-colors border border-slate-700 rounded-lg px-2 py-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            )}
            {!authLoading && !user && (
              <button
                onClick={() => setShowLogin(true)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors border border-slate-700 hover:border-slate-600 rounded-lg px-2 py-1"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Login</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="max-w-md sm:max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5 sm:space-y-6">
        {/* Last race */}
        <LastRaceCard lastRace={lastRace} />

        {/* Next race (hero) */}
        <NextRaceCard nextRace={nextRace} timezone={timezone} />

        {/* Upcoming */}
        <UpcomingList races={upcoming} />

        {/* Standings */}
        <Standings
          standings={standings}
          selectedSeason={selectedSeason}
          seasons={seasons}
          onSeasonChange={setSelectedSeason}
          myDriver={myDriver?.id ?? null}
          myTeam={myTeam?.id ?? null}
        />

        {/* My driver + My team — side by side on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MyDriverCard myDriver={myDriver} onDriverChange={handleDriverChange} />
          <MyTeamCard   myTeam={myTeam}     onTeamChange={handleTeamChange} />
        </div>

        {/* Notifications */}
        <NotificationsCard
          user={user}
          canEdit={canEditF1}
          prefs={notifPrefs}
          onToggle={handleNotifToggle}
          onLoginRequest={() => setShowLogin(true)}
        />

        {/* Footer */}
        <div className="pt-4 text-center">
          <p className="text-[10px] text-slate-600">
            Powered by Jolpica-F1 · Open-Meteo
          </p>
        </div>
      </div>

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={() => setShowLogin(false)}
        />
      )}
    </div>
  );
}
