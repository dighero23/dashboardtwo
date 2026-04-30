"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, RefreshCw, TrendingUp, TrendingDown, Minus, LogIn, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import LoginModal from "@/app/stocks/components/LoginModal";
import type { IndicatorsResponse, MacroEvent, MacroNotificationPrefs } from "@/lib/macro/types";
import NotificationsCard from "./components/NotificationsCard";

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return "—";
  return n.toFixed(decimals);
}

function fmtMonth(iso: string): string {
  const [y, m] = iso.slice(0, 7).split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m) - 1]} '${y.slice(2)}`;
}

function fmtEventDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function fmtEventTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) + " CST";
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function inflationColor(yoy: number | null): string {
  if (yoy == null) return "text-slate-300";
  if (yoy > 3.5)  return "text-red-400";
  if (yoy > 2.5)  return "text-amber-400";
  return "text-emerald-400";
}

function inflationHex(yoy: number | null): string {
  if (yoy == null) return "#94a3b8";
  if (yoy > 3.5)  return "#f87171";
  if (yoy > 2.5)  return "#fbbf24";
  return "#34d399";
}

function spreadColor(v: number): string {
  if (v < -0.5) return "text-red-400";
  if (v < 0)    return "text-amber-400";
  return "text-emerald-400";
}

function spreadHex(v: number): string {
  if (v < -0.5) return "#f87171";
  if (v < 0)    return "#fbbf24";
  return "#34d399";
}

function vixColor(v: number): string {
  if (v > 30) return "text-red-400";
  if (v > 20) return "text-amber-400";
  return "text-emerald-400";
}

function vixLabel(v: number): string {
  if (v > 40) return "Extreme fear";
  if (v > 30) return "High fear";
  if (v > 20) return "Elevated";
  if (v > 15) return "Moderate";
  return "Low volatility";
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ values, color, targetLine }: {
  values: number[];
  color: string;
  targetLine?: number;
}) {
  if (values.length < 2) return null;

  const W = 80, H = 30;
  const allVals = targetLine != null ? [...values, targetLine] : values;
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 1;

  const px = (i: number) => (i / (values.length - 1)) * W;
  const py = (v: number) => H - ((v - minV) / range) * (H - 4) - 2;

  const d = values.map((v, i) => `${i === 0 ? "M" : "L"} ${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(" ");
  const lastX = px(values.length - 1);
  const lastY = py(values[values.length - 1]);
  const targetY = targetLine != null ? py(targetLine) : null;

  return (
    <svg width={W} height={H} className="overflow-visible flex-shrink-0">
      {targetY != null && (
        <line x1={0} y1={targetY} x2={W} y2={targetY}
          stroke="#475569" strokeWidth={1} strokeDasharray="3,2" />
      )}
      <path d={d} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} />
    </svg>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-medium">
      {children}
    </p>
  );
}

function Skeleton({ h = "h-20" }: { h?: string }) {
  return <div className={`${h} rounded-xl bg-slate-800/40 border border-slate-700/40 animate-pulse`} />;
}

// ─── Component ────────────────────────────────────────────────────────────────

const NOTIF_DEFAULTS: MacroNotificationPrefs = {
  cpiRelease: true, fedDecision: true, gdpRelease: false, jobsReport: true, pceRelease: false,
};

export default function MacroPulse() {
  // Auth + permissions
  const { user, loading: authLoading, canEditMacro } = usePermissions();
  const [showLogin, setShowLogin] = useState(false);

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState<MacroNotificationPrefs>(NOTIF_DEFAULTS);

  // Data
  const [indicators, setIndicators] = useState<IndicatorsResponse | null>(null);
  const [events,     setEvents]     = useState<MacroEvent[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Auth ────────────────────────────────────────────────────────────────────
  // ── Load notification prefs when user has Macro access ──────────────────
  useEffect(() => {
    if (!user || !canEditMacro) return;
    fetch("/api/macro/notifications")
      .then((r) => r.json())
      .then((p: MacroNotificationPrefs) => setNotifPrefs(p))
      .catch(() => {});
  }, [user, canEditMacro]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  const handleNotifToggle = useCallback(
    async (key: keyof MacroNotificationPrefs, value: boolean) => {
      const newPrefs = { ...notifPrefs, [key]: value };
      setNotifPrefs(newPrefs);
      if (canEditMacro) {
        await fetch("/api/macro/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newPrefs),
        });
      }
    },
    [notifPrefs, canEditMacro]
  );

  const load = useCallback(async () => {
    const [indRes, evtRes] = await Promise.allSettled([
      fetch("/api/macro/indicators").then((r) => r.json()),
      fetch("/api/macro/events?filter=high").then((r) => r.json()),
    ]);
    if (indRes.status === "fulfilled") setIndicators(indRes.value as IndicatorsResponse);
    if (evtRes.status === "fulfilled") setEvents((evtRes.value as { events: MacroEvent[] }).events ?? []);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const fedFunds    = indicators?.fedFunds    ?? null;
  const cpi         = indicators?.cpi         ?? null;
  const pce         = indicators?.pce         ?? null;
  const unemployment = indicators?.unemployment ?? null;
  const treasury10y = indicators?.treasury10y ?? null;
  const treasury2y  = indicators?.treasury2y  ?? null;
  const yieldSpread = indicators?.yieldSpread ?? null;
  const vix         = indicators?.vix         ?? null;

  // Group events by date string (YYYY-MM-DD)
  const eventsByDate = events.reduce<Record<string, MacroEvent[]>>((acc, e) => {
    const date = e.time ? e.time.slice(0, 10) : "TBD";
    (acc[date] ??= []).push(e);
    return acc;
  }, {});
  const sortedDates = Object.keys(eventsByDate).sort();

  // Fed Funds direction
  const fedDir =
    fedFunds?.prev != null && fedFunds.current > fedFunds.prev ? "up" :
    fedFunds?.prev != null && fedFunds.current < fedFunds.prev ? "down" : "flat";

  return (
    <div className="min-h-screen bg-slate-900">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: "#3b82f622", border: "1px solid #3b82f655" }}>
              <BarChart3 className="w-3.5 h-3.5" style={{ color: "#3b82f6" }} />
            </div>
            <span className="font-semibold text-white text-sm sm:text-base">Macro Pulse</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              title="Refresh data"
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
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

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="max-w-md sm:max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Monetary Policy ─────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Monetary Policy</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} />)
            ) : (
              <>
                {/* Fed Funds */}
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 px-4 py-3.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-medium">
                    Fed Funds
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xl font-semibold tabular-nums ${
                      fedDir === "down" ? "text-emerald-400" :
                      fedDir === "up"   ? "text-red-400" : "text-white"
                    }`}>
                      {fedFunds ? `${fmt(fedFunds.current)}%` : "—"}
                    </span>
                    {fedDir === "up"   && <TrendingUp   className="w-3.5 h-3.5 text-red-400" />}
                    {fedDir === "down" && <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {fedFunds?.prev != null
                      ? `Prev ${fmt(fedFunds.prev)}% · ${fmtMonth(fedFunds.date)}`
                      : fedFunds?.date ? fmtMonth(fedFunds.date) : "—"}
                  </p>
                </div>

                {/* 10Y Treasury */}
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 px-4 py-3.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-medium">
                    10Y Treasury
                  </p>
                  <p className="text-xl font-semibold tabular-nums text-white">
                    {treasury10y ? `${fmt(treasury10y.rate)}%` : "—"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {treasury10y ? fmtMonth(treasury10y.date) : "—"}
                  </p>
                </div>

                {/* 2Y Treasury */}
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 px-4 py-3.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-medium">
                    2Y Treasury
                  </p>
                  <p className="text-xl font-semibold tabular-nums text-white">
                    {treasury2y ? `${fmt(treasury2y.rate)}%` : "—"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {treasury2y ? fmtMonth(treasury2y.date) : "—"}
                  </p>
                </div>

                {/* 10Y-2Y Spread */}
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 px-4 py-3.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-medium">
                    10Y – 2Y Spread
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xl font-semibold tabular-nums ${yieldSpread ? spreadColor(yieldSpread.spread) : "text-slate-300"}`}>
                      {yieldSpread ? `${fmt(yieldSpread.spread)}%` : "—"}
                    </span>
                    {yieldSpread && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        yieldSpread.spread < 0
                          ? "bg-red-400/15 text-red-400"
                          : "bg-emerald-400/15 text-emerald-400"
                      }`}>
                        {yieldSpread.spread < 0 ? "Inverted" : "Normal"}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {yieldSpread ? fmtMonth(yieldSpread.date) : "—"}
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── Inflation ───────────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Inflation · 2% Fed target</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h="h-24" />)
            ) : (
              <>
                {/* CPI */}
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 px-4 py-3.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-medium">
                    CPI YoY
                  </p>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className={`text-2xl font-semibold tabular-nums ${inflationColor(cpi?.yoy ?? null)}`}>
                        {cpi?.yoy != null ? `${fmt(cpi.yoy)}%` : "—"}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {cpi ? fmtMonth(cpi.date) : "—"}
                      </p>
                    </div>
                    {(cpi?.history.length ?? 0) >= 2 && (
                      <Sparkline
                        values={cpi!.history.map((h) => h.value)}
                        color={inflationHex(cpi?.yoy ?? null)}
                        targetLine={2}
                      />
                    )}
                  </div>
                </div>

                {/* PCE */}
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 px-4 py-3.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-medium">
                    PCE YoY
                  </p>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className={`text-2xl font-semibold tabular-nums ${inflationColor(pce?.yoy ?? null)}`}>
                        {pce?.yoy != null ? `${fmt(pce.yoy)}%` : "—"}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {pce ? fmtMonth(pce.date) : "—"}
                      </p>
                    </div>
                    {(pce?.history.length ?? 0) >= 2 && (
                      <Sparkline
                        values={pce!.history.map((h) => h.value)}
                        color={inflationHex(pce?.yoy ?? null)}
                        targetLine={2}
                      />
                    )}
                  </div>
                </div>

                {/* Unemployment */}
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 px-4 py-3.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-medium">
                    Unemployment
                  </p>
                  <p className="text-2xl font-semibold tabular-nums text-white">
                    {unemployment ? `${fmt(unemployment.rate)}%` : "—"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {unemployment ? fmtMonth(unemployment.date) : "—"}
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── Market Sentiment ────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Market Sentiment</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {loading ? (
              Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} />)
            ) : (
              <>
                {/* VIX */}
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 px-4 py-3.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-medium">
                    VIX
                  </p>
                  <p className={`text-xl font-semibold tabular-nums ${vix ? vixColor(vix.value) : "text-slate-300"}`}>
                    {vix ? fmt(vix.value) : "—"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {vix ? vixLabel(vix.value) : "—"}
                  </p>
                </div>

                {/* Yield curve sparkline card */}
                {yieldSpread && (yieldSpread.history?.length ?? 0) >= 2 && (
                  <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 px-4 py-3.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-medium">
                      Spread trend
                    </p>
                    <Sparkline
                      values={yieldSpread.history.map((h) => h.value)}
                      color={spreadHex(yieldSpread.spread)}
                      targetLine={0}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* ── Economic Calendar ────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Economic Calendar · Next 4 Weeks · High Impact</SectionLabel>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h="h-14" />)}
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-xl bg-slate-800/40 border border-slate-700/50 px-4 py-8 text-center">
              <p className="text-sm text-slate-500">No high-impact events in the next 4 weeks.</p>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-800/40 border border-slate-700/50 overflow-hidden">
              {sortedDates.map((date) => (
                <div key={date} className="border-b border-slate-800/80 last:border-0">
                  {/* Date header */}
                  <div className="px-4 py-2 bg-slate-800/60 border-b border-slate-800/80">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      {date === "TBD" ? "TBD" : fmtEventDay(date)}
                    </p>
                  </div>

                  {/* Events for this date */}
                  {eventsByDate[date].map((e, i) => {
                    const impactCls =
                      e.impact === "high"   ? "bg-red-400/20 text-red-400 border-red-400/30" :
                      e.impact === "medium" ? "bg-amber-400/20 text-amber-400 border-amber-400/30" :
                                              "bg-slate-700/50 text-slate-400 border-slate-600/30";

                    const beatEstimate =
                      e.actual != null && e.estimate != null
                        ? e.actual > e.estimate ? "beat"
                        : e.actual < e.estimate ? "miss"
                        : "inline"
                      : null;

                    return (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/60 last:border-0">
                        {/* Impact badge */}
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${impactCls}`}>
                          {e.impact === "high" ? "High" : e.impact === "medium" ? "Med" : "Low"}
                        </span>

                        {/* Event name + time */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 leading-tight truncate">{e.event}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {fmtEventTime(e.time)}
                            {e.prev != null && ` · Prev ${fmt(e.prev, 1)}${e.unit ?? ""}`}
                            {e.estimate != null && ` · Est ${fmt(e.estimate, 1)}${e.unit ?? ""}`}
                          </p>
                        </div>

                        {/* Actual + beat/miss */}
                        {e.actual != null ? (
                          <div className="text-right flex-shrink-0">
                            <p className={`text-sm font-semibold tabular-nums ${
                              beatEstimate === "beat" ? "text-emerald-400" :
                              beatEstimate === "miss" ? "text-red-400" : "text-white"
                            }`}>
                              {fmt(e.actual, 1)}{e.unit ?? ""}
                            </p>
                            {beatEstimate && beatEstimate !== "inline" && (
                              <div className="flex items-center justify-end gap-0.5 mt-0.5">
                                {beatEstimate === "beat"
                                  ? <TrendingUp  className="w-3 h-3 text-emerald-400" />
                                  : <TrendingDown className="w-3 h-3 text-red-400" />}
                                <span className="text-[10px] text-slate-500">
                                  {beatEstimate === "beat" ? "beat" : "miss"}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex-shrink-0">
                            <Minus className="w-3.5 h-3.5 text-slate-600" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Notifications ───────────────────────────────────────────────── */}
        <NotificationsCard
          user={user}
          canEdit={canEditMacro}
          prefs={notifPrefs}
          onToggle={handleNotifToggle}
          onLoginRequest={() => setShowLogin(true)}
        />

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="pt-2 text-center space-y-0.5">
          <p className="text-[10px] text-slate-600">
            Powered by FRED · Finnhub
          </p>
          {indicators?.updatedAt && (
            <p className="text-[10px] text-slate-700">
              Updated {new Date(indicators.updatedAt).toLocaleTimeString("en-US", {
                hour: "numeric", minute: "2-digit"
              })}
            </p>
          )}
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
