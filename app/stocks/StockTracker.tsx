"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Bell,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ArrowLeft,
  LogIn,
  LogOut,
  Circle,
  AlertCircle,
  Plus,
  Trash2,
} from "lucide-react";
import type { TickerData, TickersResponse } from "@/lib/buildTickerData";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import LoginModal from "./components/LoginModal";
import AddTickerModal from "./components/AddTickerModal";
import AlertPanel from "./components/AlertPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

type Timezone = "CST" | "EST";
type SortKey = keyof Pick<
  TickerData,
  "symbol" | "price" | "changePct" | "athPct" | "targetPrice" | "targetPct" | "earningsDays"
>;
type SortDir = "asc" | "desc";
interface MarketStatus { label: string; color: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMarketStatus(now: Date): MarketStatus {
  const day = now.getDay();
  if (day === 0 || day === 6) return { label: "Closed", color: "text-slate-400" };
  const t = (now.getUTCHours() * 60 + now.getUTCMinutes()) - 5 * 60;
  const min = t < 0 ? t + 1440 : t;
  if (min >= 570 && min < 960) return { label: "Open", color: "text-emerald-400" };
  if (min >= 240 && min < 570) return { label: "Pre-market", color: "text-amber-400" };
  if (min >= 960 && min < 1200) return { label: "After-hours", color: "text-amber-400" };
  return { label: "Closed", color: "text-slate-400" };
}

function formatTime(date: Date, tz: Timezone) {
  return date.toLocaleTimeString("en-US", {
    timeZone: tz === "EST" ? "America/New_York" : "America/Guatemala",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
}

function formatPrice(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(n: number | null, showSign = false) {
  if (n === null) return "—";
  return `${showSign && n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function proximityColor(pct: number | null) {
  if (pct === null) return "bg-transparent";
  const abs = Math.abs(pct);
  if (abs > 5) return "bg-emerald-500";
  if (abs >= 2) return "bg-amber-400";
  return "bg-red-500";
}

function pctColor(n: number | null) {
  if (n === null) return "text-slate-400";
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-red-400";
  return "text-slate-300";
}

function earningsBadge(days: number | null) {
  if (days === null || days < 0) return null;
  return { text: `ER: ${days}d`, urgent: days <= 7 };
}

function sortTickers(data: TickerData[], key: SortKey, dir: SortDir): TickerData[] {
  return [...data].sort((a, b) => {
    const va = a[key] ?? (dir === "asc" ? Infinity : -Infinity);
    const vb = b[key] ?? (dir === "asc" ? Infinity : -Infinity);
    if (typeof va === "string" && typeof vb === "string")
      return dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    return dir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });
}

// ─── Skeleton components ──────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 bg-slate-700/60 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl bg-slate-800/50 border border-slate-700/60 p-4 animate-pulse space-y-2">
      <div className="h-4 bg-slate-700/60 rounded w-1/3" />
      <div className="h-3 bg-slate-700/40 rounded w-2/3" />
      <div className="h-3 bg-slate-700/40 rounded w-1/2" />
    </div>
  );
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 text-slate-600" />;
  return sortDir === "asc"
    ? <ChevronUp className="w-3 h-3 text-slate-300" />
    : <ChevronDown className="w-3 h-3 text-slate-300" />;
}

// ─── Column config ────────────────────────────────────────────────────────────

const COLUMNS: { key: SortKey; label: string; align: string }[] = [
  { key: "symbol",       label: "Ticker",       align: "text-left"  },
  { key: "price",        label: "Price",        align: "text-right" },
  { key: "changePct",    label: "Change %",     align: "text-right" },
  { key: "athPct",       label: "% vs ATH",     align: "text-right" },
  { key: "targetPrice",  label: "Target",       align: "text-right" },
  { key: "targetPct",    label: "% vs Target",  align: "text-right" },
  { key: "earningsDays", label: "Earnings",     align: "text-right" },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function StockTracker() {
  // Data
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedISO, setLastUpdatedISO] = useState<string | null>(null);

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // UI state
  const [timezone, setTimezone] = useState<Timezone>("CST");
  const [now, setNow] = useState(new Date());
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [refreshCooldown, setRefreshCooldown] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals
  const [showLogin, setShowLogin] = useState(false);
  const [showAddTicker, setShowAddTicker] = useState(false);
  const [alertPanelTickerId, setAlertPanelTickerId] = useState<string | null | undefined>(undefined);
  // undefined = closed, null = open (list view), "id" = open for specific ticker

  // ── Auth setup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Preferences ─────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dash-sort");
      if (saved) { const { key, dir } = JSON.parse(saved); setSortKey(key); setSortDir(dir); }
      const savedTz = localStorage.getItem("dash-timezone") as Timezone | null;
      if (savedTz === "EST" || savedTz === "CST") setTimezone(savedTz);
    } catch {}
  }, []);

  // ── Initial data fetch ──────────────────────────────────────────────────────
  const loadTickers = useCallback(async () => {
    try {
      const res = await fetch("/api/tickers");
      if (!res.ok) throw new Error();
      const data: TickersResponse = await res.json();
      setTickers(data.tickers);
      setLastUpdatedISO(data.updatedAt);
    } catch {
      setError("Failed to load price data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTickers(); }, [loadTickers]);

  // ── Clock ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Cooldown countdown ──────────────────────────────────────────────────────
  useEffect(() => {
    if (refreshCooldown <= 0) return;
    const id = setInterval(() => setRefreshCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [refreshCooldown]);

  // ── Computed ─────────────────────────────────────────────────────────────────
  const marketStatus = useMemo(() => getMarketStatus(now), [now]);
  const currentTime = useMemo(() => formatTime(now, timezone), [now, timezone]);
  const sorted = useMemo(() => sortTickers(tickers, sortKey, sortDir), [tickers, sortKey, sortDir]);

  const lastUpdatedDisplay = useMemo(() => {
    if (!lastUpdatedISO) return null;
    return new Date(lastUpdatedISO).toLocaleTimeString("en-US", {
      timeZone: timezone === "EST" ? "America/New_York" : "America/Guatemala",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    });
  }, [lastUpdatedISO, timezone]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSort = useCallback((key: SortKey) => {
    const newDir: SortDir = key === sortKey && sortDir === "asc" ? "desc" : "asc";
    setSortKey(key); setSortDir(newDir);
    localStorage.setItem("dash-sort", JSON.stringify({ key, dir: newDir }));
  }, [sortKey, sortDir]);

  const handleTimezone = useCallback((tz: Timezone) => {
    setTimezone(tz);
    localStorage.setItem("dash-timezone", tz);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (refreshCooldown > 0 || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      if (!res.ok) throw new Error();
      const data: TickersResponse = await res.json();
      setTickers(data.tickers);
      setLastUpdatedISO(data.updatedAt);
      setRefreshCooldown(60);
    } catch {
      // silently keep old data
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshCooldown, isRefreshing]);

  const handleLogout = useCallback(async () => {
    await createClient().auth.signOut();
  }, []);

  const handleDeleteTicker = useCallback(async (id: string, symbol: string) => {
    if (!confirm(`Remove ${symbol} from watchlist? This will also delete its alerts.`)) return;
    await fetch(`/api/tickers/${id}`, { method: "DELETE" });
    setTickers((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">

      {/* ── Top nav ── */}
      <nav className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <h1 className="font-semibold text-white text-sm sm:text-base">Stock Tracker</h1>

          <div className="flex items-center gap-2">
            {!authLoading && user && (
              <>
                <button
                  onClick={() => setShowAddTicker(true)}
                  className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors border border-slate-700 hover:border-emerald-500/40 rounded-lg px-3 py-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add ticker
                </button>
                <button
                  onClick={() => setAlertPanelTickerId(null)}
                  className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition-colors border border-slate-700 hover:border-amber-500/40 rounded-lg px-3 py-1.5"
                >
                  <Bell className="w-3.5 h-3.5" />
                  Alerts
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors border border-slate-700 rounded-lg px-3 py-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </>
            )}
            {!authLoading && !user && (
              <button
                onClick={() => setShowLogin(true)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors border border-slate-700 rounded-lg px-3 py-1.5 hover:border-slate-600"
              >
                <LogIn className="w-3.5 h-3.5" />
                Login
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── Controls bar ── */}
      <div className="border-b border-slate-800 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-3 justify-between">
          {/* Market status */}
          <div className="flex items-center gap-2 text-xs">
            <span className={`flex items-center gap-1.5 font-medium ${marketStatus.color}`}>
              <Circle className="w-2 h-2 fill-current" />
              {marketStatus.label}
            </span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400 tabular-nums">{currentTime}</span>
            <span className="text-slate-600">{timezone}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Timezone toggle */}
            <div className="flex items-center text-xs rounded-lg border border-slate-700 overflow-hidden">
              {(["CST", "EST"] as Timezone[]).map((tz) => (
                <button
                  key={tz}
                  onClick={() => handleTimezone(tz)}
                  className={`px-2.5 py-1 transition-colors ${
                    timezone === tz
                      ? "bg-slate-700 text-white font-medium"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  {tz}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={refreshCooldown > 0 || isRefreshing || loading}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                refreshCooldown > 0 || isRefreshing || loading
                  ? "border-slate-800 text-slate-600 cursor-not-allowed"
                  : "border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              {refreshCooldown > 0
                ? <span className="tabular-nums w-6">{refreshCooldown}s</span>
                : <span>Refresh</span>}
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pb-2 text-xs text-slate-600">
          {lastUpdatedDisplay
            ? `Last updated: ${lastUpdatedDisplay} ${timezone}`
            : loading ? "Loading prices…" : "—"}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-4">

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── DESKTOP TABLE ── */}
        <div className="hidden md:block">
          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-800/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/80 bg-slate-800/60">
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`px-4 py-3 font-medium text-slate-400 cursor-pointer hover:text-slate-200 select-none whitespace-nowrap ${col.align}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                      </span>
                    </th>
                  ))}
                  {/* Bell + Delete columns — only when authenticated */}
                  <th className="px-4 py-3 w-10" />
                  {user && <th className="px-2 py-3 w-8" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                  : sorted.map((ticker) => {
                      const badge = earningsBadge(ticker.earningsDays);
                      const proxColor = proximityColor(ticker.targetPct);
                      return (
                        <tr key={ticker.id} className="group hover:bg-slate-800/50 transition-colors">
                          {/* Ticker + proximity */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-1 h-8 rounded-full ${proxColor} flex-shrink-0`} />
                              <div>
                                <span className="font-bold text-white text-sm">{ticker.symbol}</span>
                                <p className="text-xs text-slate-500 leading-none mt-0.5">{ticker.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-white">
                            ${formatPrice(ticker.price)}
                          </td>
                          <td className={`px-4 py-3 text-right font-mono ${pctColor(ticker.changePct)}`}>
                            {formatPct(ticker.changePct, true)}
                          </td>
                          <td className={`px-4 py-3 text-right font-mono ${pctColor(ticker.athPct)}`}>
                            {formatPct(ticker.athPct, true)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-300">
                            {ticker.targetPrice !== null
                              ? `$${formatPrice(ticker.targetPrice)}`
                              : <span className="text-slate-600">—</span>}
                          </td>
                          <td className={`px-4 py-3 text-right font-mono ${pctColor(ticker.targetPct)}`}>
                            {formatPct(ticker.targetPct, true)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {badge ? (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                badge.urgent
                                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                  : "bg-slate-700 text-slate-400"
                              }`}>
                                {badge.text}
                              </span>
                            ) : (
                              <span className="text-slate-600 text-xs">—</span>
                            )}
                          </td>
                          {/* Bell icon — auth only */}
                          <td className="px-4 py-3 text-center">
                            {user && (
                              <button
                                onClick={() => setAlertPanelTickerId(ticker.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-amber-400 p-1 rounded relative"
                              >
                                <Bell className="w-4 h-4" />
                                {ticker.hasAlert && (
                                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-amber-400 rounded-full" />
                                )}
                              </button>
                            )}
                          </td>
                          {/* Delete — auth only */}
                          {user && (
                            <td className="px-2 py-3 text-center">
                              <button
                                onClick={() => handleDeleteTicker(ticker.id, ticker.symbol)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-red-400 p-1 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>

          {/* Legend + add ticker button */}
          <div className="flex items-center justify-between mt-3 px-1">
            <p className="text-xs text-slate-600">
              Proximity: <span className="text-emerald-500">&gt;5%</span> ·{" "}
              <span className="text-amber-400">2–5%</span> ·{" "}
              <span className="text-red-500">&lt;2%</span>
              {user && " · Bell on hover to manage alerts"}
            </p>
            {user && !loading && (
              <button
                onClick={() => setShowAddTicker(true)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-400 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add ticker
              </button>
            )}
          </div>
        </div>

        {/* ── MOBILE CARDS ── */}
        <div className="md:hidden">
          {/* Mobile action bar (auth) */}
          {user && !loading && (
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setShowAddTicker(true)}
                className="flex items-center gap-1.5 text-xs border border-slate-700 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40 rounded-lg px-3 py-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add ticker
              </button>
              <button
                onClick={() => setAlertPanelTickerId(null)}
                className="flex items-center gap-1.5 text-xs border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-500/40 rounded-lg px-3 py-1.5 transition-colors"
              >
                <Bell className="w-3.5 h-3.5" />
                Alerts
              </button>
            </div>
          )}

          {/* Sort selector */}
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs text-slate-500 flex-shrink-0">Sort:</span>
            <div className="flex flex-wrap gap-1.5">
              {COLUMNS.map((col) => (
                <button
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    sortKey === col.key
                      ? "bg-slate-700 border-slate-600 text-white font-medium"
                      : "border-slate-700 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1 opacity-60">{sortDir === "asc" ? "↑" : "↓"}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Cards */}
          <div className="space-y-2">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              : sorted.map((ticker) => {
                  const badge = earningsBadge(ticker.earningsDays);
                  const proxColor = proximityColor(ticker.targetPct);

                  // Secondary data items — only render what exists
                  const secondaryItems: React.ReactNode[] = [];
                  if (ticker.targetPrice !== null) {
                    secondaryItems.push(
                      <span key="target" className="text-slate-400">
                        Target: <span className="text-slate-200 font-mono">${formatPrice(ticker.targetPrice)}</span>
                      </span>
                    );
                    secondaryItems.push(
                      <span key="vs-target" className={`font-mono ${pctColor(ticker.targetPct)}`}>
                        {formatPct(ticker.targetPct, true)}
                      </span>
                    );
                  }
                  if (badge) {
                    secondaryItems.push(
                      <span
                        key="er"
                        className={badge.urgent ? "text-red-400 font-medium" : "text-slate-400"}
                      >
                        {badge.text}
                      </span>
                    );
                  }

                  return (
                    <div
                      key={ticker.id}
                      className="relative rounded-xl bg-slate-800/50 border border-slate-700/60 overflow-hidden"
                    >
                      {/* Proximity left border */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${proxColor}`} />

                      <div className="pl-4 pr-3 py-3">
                        {/* Row 1: bell · ticker · [price + change%] */}
                        <div className="flex items-center gap-2.5">
                          {/* Bell — always present, invisible placeholder when not authed */}
                          <div className="flex-shrink-0 w-7 flex items-center justify-center">
                            {user ? (
                              <button
                                onClick={() => setAlertPanelTickerId(ticker.id)}
                                className="relative text-slate-500 hover:text-amber-400 active:text-amber-300 transition-colors p-0.5"
                              >
                                <Bell className="w-4 h-4" />
                                {ticker.hasAlert && (
                                  <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-amber-400 rounded-full" />
                                )}
                              </button>
                            ) : (
                              <span className="w-4 h-4" />
                            )}
                          </div>

                          {/* Ticker symbol */}
                          <span className="font-bold text-white text-base leading-none tracking-wide">
                            {ticker.symbol}
                          </span>

                          {/* Spacer */}
                          <div className="flex-1" />

                          {/* Price + Change% */}
                          <div className="text-right flex-shrink-0">
                            <span className="font-semibold text-white font-mono text-sm">
                              ${formatPrice(ticker.price)}
                            </span>
                            <span className={`ml-2 text-xs font-mono ${pctColor(ticker.changePct)}`}>
                              {formatPct(ticker.changePct, true)}
                            </span>
                          </div>

                          {/* Delete (auth only) */}
                          {user && (
                            <button
                              onClick={() => handleDeleteTicker(ticker.id, ticker.symbol)}
                              className="flex-shrink-0 text-slate-700 hover:text-red-400 active:text-red-300 transition-colors p-0.5 ml-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Row 2: company name */}
                        <p className="text-xs text-slate-500 mt-1 ml-9 truncate leading-none">
                          {ticker.name}
                        </p>

                        {/* Row 3: secondary data — only if anything to show */}
                        {secondaryItems.length > 0 && (
                          <div className="flex items-center gap-0 mt-2 ml-9 text-xs">
                            {secondaryItems.map((item, i) => (
                              <span key={i} className="flex items-center">
                                {i > 0 && <span className="mx-1.5 text-slate-700">·</span>}
                                {item}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={() => setShowLogin(false)}
        />
      )}

      {showAddTicker && (
        <AddTickerModal
          onClose={() => setShowAddTicker(false)}
          onAdded={() => { setShowAddTicker(false); loadTickers(); }}
        />
      )}

      {alertPanelTickerId !== undefined && (
        <AlertPanel
          tickers={tickers}
          initialTickerId={alertPanelTickerId}
          onClose={() => setAlertPanelTickerId(undefined)}
          onChanged={loadTickers}
        />
      )}
    </div>
  );
}
