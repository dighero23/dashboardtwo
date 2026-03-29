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
  Circle,
} from "lucide-react";
import { MOCK_TICKERS, TickerData } from "@/lib/mockData";

// ─── Types ────────────────────────────────────────────────────────────────────

type Timezone = "CST" | "EST";
type SortKey = keyof Pick<
  TickerData,
  "symbol" | "price" | "changePct" | "athPct" | "targetPrice" | "targetPct" | "earningsDays"
>;
type SortDir = "asc" | "desc";

interface MarketStatus {
  label: string;
  color: string;
  dot: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMarketStatus(now: Date): MarketStatus {
  const day = now.getDay(); // 0=Sun 6=Sat
  if (day === 0 || day === 6) {
    return { label: "Closed", color: "text-slate-400", dot: "bg-slate-400" };
  }
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  const totalMin = h * 60 + m - 5 * 60; // offset to EST (UTC-5)
  const t = totalMin < 0 ? totalMin + 1440 : totalMin;

  if (t >= 9 * 60 + 30 && t < 16 * 60)
    return { label: "Open", color: "text-emerald-400", dot: "bg-emerald-400" };
  if (t >= 4 * 60 && t < 9 * 60 + 30)
    return { label: "Pre-market", color: "text-amber-400", dot: "bg-amber-400" };
  if (t >= 16 * 60 && t < 20 * 60)
    return { label: "After-hours", color: "text-amber-400", dot: "bg-amber-400" };
  return { label: "Closed", color: "text-slate-400", dot: "bg-slate-400" };
}

function formatTime(date: Date, tz: Timezone): string {
  return date.toLocaleTimeString("en-US", {
    timeZone: tz === "EST" ? "America/New_York" : "America/Guatemala",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatPrice(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(n: number | null, opts?: { showSign?: boolean }): string {
  if (n === null) return "—";
  const sign = opts?.showSign && n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function proximityColor(targetPct: number | null): string {
  if (targetPct === null) return "bg-transparent";
  const abs = Math.abs(targetPct);
  if (abs > 5) return "bg-emerald-500";
  if (abs >= 2) return "bg-amber-400";
  return "bg-red-500";
}

function pctColor(n: number | null): string {
  if (n === null) return "text-slate-400";
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-red-400";
  return "text-slate-300";
}

function earningsBadge(days: number | null): { text: string; urgent: boolean } | null {
  if (days === null) return null;
  if (days < 0) return null;
  return { text: `ER: ${days}d`, urgent: days <= 7 };
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────

function sortTickers(
  data: TickerData[],
  key: SortKey,
  dir: SortDir
): TickerData[] {
  return [...data].sort((a, b) => {
    const va = a[key] ?? (dir === "asc" ? Infinity : -Infinity);
    const vb = b[key] ?? (dir === "asc" ? Infinity : -Infinity);
    if (typeof va === "string" && typeof vb === "string") {
      return dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    const na = va as number;
    const nb = vb as number;
    return dir === "asc" ? na - nb : nb - na;
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SortIcon({
  col,
  sortKey,
  sortDir,
}: {
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
}) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 text-slate-600" />;
  return sortDir === "asc" ? (
    <ChevronUp className="w-3 h-3 text-slate-300" />
  ) : (
    <ChevronDown className="w-3 h-3 text-slate-300" />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StockTracker() {
  const [tickers, setTickers] = useState<TickerData[]>(MOCK_TICKERS);
  const [timezone, setTimezone] = useState<Timezone>("CST");
  const [now, setNow] = useState<Date>(new Date());
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [refreshCooldown, setRefreshCooldown] = useState(0); // seconds remaining
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load sort preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("dash-sort");
    if (saved) {
      try {
        const { key, dir } = JSON.parse(saved);
        setSortKey(key);
        setSortDir(dir);
      } catch {}
    }
    const savedTz = localStorage.getItem("dash-timezone") as Timezone | null;
    if (savedTz === "EST" || savedTz === "CST") setTimezone(savedTz);
  }, []);

  // Clock tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Refresh cooldown countdown
  useEffect(() => {
    if (refreshCooldown <= 0) return;
    const id = setInterval(() => {
      setRefreshCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [refreshCooldown]);

  const marketStatus = useMemo(() => getMarketStatus(now), [now]);
  const currentTime = useMemo(() => formatTime(now, timezone), [now, timezone]);

  const sorted = useMemo(
    () => sortTickers(tickers, sortKey, sortDir),
    [tickers, sortKey, sortDir]
  );

  const handleSort = useCallback(
    (key: SortKey) => {
      let newDir: SortDir = "asc";
      if (key === sortKey) newDir = sortDir === "asc" ? "desc" : "asc";
      setSortKey(key);
      setSortDir(newDir);
      localStorage.setItem("dash-sort", JSON.stringify({ key, dir: newDir }));
    },
    [sortKey, sortDir]
  );

  const handleTimezone = useCallback((tz: Timezone) => {
    setTimezone(tz);
    localStorage.setItem("dash-timezone", tz);
  }, []);

  const handleRefresh = useCallback(() => {
    if (refreshCooldown > 0) return;
    setIsRefreshing(true);
    // Simulate a refresh with mock data (jitter prices slightly)
    setTimeout(() => {
      setTickers((prev) =>
        prev.map((t) => ({
          ...t,
          price: +(t.price * (1 + (Math.random() - 0.5) * 0.002)).toFixed(2),
        }))
      );
      setLastUpdated(new Date());
      setIsRefreshing(false);
      setRefreshCooldown(60);
    }, 600);
  }, [refreshCooldown]);

  // ─── Column headers config ─────────────────────────────────────────────────

  const columns: { key: SortKey; label: string; align: string }[] = [
    { key: "symbol", label: "Ticker", align: "text-left" },
    { key: "price", label: "Price", align: "text-right" },
    { key: "changePct", label: "Change %", align: "text-right" },
    { key: "athPct", label: "% vs ATH", align: "text-right" },
    { key: "targetPrice", label: "Target", align: "text-right" },
    { key: "targetPct", label: "% vs Target", align: "text-right" },
    { key: "earningsDays", label: "Earnings", align: "text-right" },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* ── Top nav ── */}
      <nav className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <h1 className="font-semibold text-white text-sm sm:text-base">
            Stock Tracker
          </h1>

          <button className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors border border-slate-700 rounded-lg px-3 py-1.5 hover:border-slate-600">
            <LogIn className="w-3.5 h-3.5" />
            <span>Login</span>
          </button>
        </div>
      </nav>

      {/* ── Controls bar ── */}
      <div className="border-b border-slate-800 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-3 justify-between">
          {/* Market status + time */}
          <div className="flex items-center gap-2 text-xs">
            <span className={`flex items-center gap-1.5 font-medium ${marketStatus.color}`}>
              <Circle className={`w-2 h-2 fill-current ${marketStatus.color}`} />
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

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={refreshCooldown > 0 || isRefreshing}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                refreshCooldown > 0 || isRefreshing
                  ? "border-slate-800 text-slate-600 cursor-not-allowed"
                  : "border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white"
              }`}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
              {refreshCooldown > 0 ? (
                <span className="tabular-nums w-6">{refreshCooldown}s</span>
              ) : (
                <span>Refresh</span>
              )}
            </button>
          </div>
        </div>

        {/* Last updated */}
        <div className="max-w-7xl mx-auto px-4 pb-2 text-xs text-slate-600">
          Last updated:{" "}
          {lastUpdated.toLocaleTimeString("en-US", {
            timeZone: timezone === "EST" ? "America/New_York" : "America/Guatemala",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })}{" "}
          {timezone}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-4">
        {/* ── DESKTOP TABLE (> 768px) ── */}
        <div className="hidden md:block">
          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-800/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/80 bg-slate-800/60">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-4 py-3 font-medium text-slate-400 cursor-pointer hover:text-slate-200 select-none whitespace-nowrap ${col.align}`}
                      onClick={() => handleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sorted.map((ticker) => {
                  const badge = earningsBadge(ticker.earningsDays);
                  const proxColor = proximityColor(ticker.targetPct);
                  return (
                    <tr
                      key={ticker.id}
                      className="group hover:bg-slate-800/50 transition-colors"
                    >
                      {/* Proximity bar */}
                      <td className="px-4 py-3 text-left">
                        <div className="flex items-center gap-3">
                          <div className={`w-1 h-8 rounded-full ${proxColor} flex-shrink-0`} />
                          <div>
                            <span className="font-bold text-white text-sm">
                              {ticker.symbol}
                            </span>
                            <p className="text-xs text-slate-500 leading-none mt-0.5">
                              {ticker.name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-white">
                        ${formatPrice(ticker.price)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${pctColor(ticker.changePct)}`}>
                        {formatPct(ticker.changePct, { showSign: true })}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${pctColor(ticker.athPct)}`}>
                        {formatPct(ticker.athPct, { showSign: true })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">
                        {ticker.targetPrice !== null
                          ? `$${formatPrice(ticker.targetPrice)}`
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${pctColor(ticker.targetPct)}`}>
                        {formatPct(ticker.targetPct, { showSign: true })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {badge ? (
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              badge.urgent
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : "bg-slate-700 text-slate-400"
                            }`}
                          >
                            {badge.text}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-amber-400 p-1 rounded">
                          <Bell className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Column legend */}
          <p className="text-xs text-slate-600 mt-3 px-1">
            Proximity indicator: <span className="text-emerald-500">&gt;5% away</span> ·{" "}
            <span className="text-amber-400">2–5% away</span> ·{" "}
            <span className="text-red-500">&lt;2% away</span> · Bell icon visible on hover (auth required)
          </p>
        </div>

        {/* ── MOBILE CARDS (≤ 768px) ── */}
        <div className="md:hidden">
          {/* Sort selector */}
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs text-slate-500 flex-shrink-0">Sort by:</span>
            <div className="flex flex-wrap gap-1.5">
              {columns.map((col) => (
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
                    <span className="ml-1 opacity-60">
                      {sortDir === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Cards */}
          <div className="space-y-2.5">
            {sorted.map((ticker) => {
              const badge = earningsBadge(ticker.earningsDays);
              const proxColor = proximityColor(ticker.targetPct);
              return (
                <div
                  key={ticker.id}
                  className="relative rounded-xl bg-slate-800/50 border border-slate-700/60 overflow-hidden"
                >
                  {/* Proximity left border */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${proxColor}`} />

                  <div className="pl-4 pr-4 py-3.5">
                    {/* Line 1: symbol + price + change */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-white text-base leading-none">
                          {ticker.symbol}
                        </span>
                        <p className="text-xs text-slate-500 mt-0.5">{ticker.name}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-white font-mono text-sm">
                          ${formatPrice(ticker.price)}
                        </p>
                        <p className={`text-xs font-mono mt-0.5 ${pctColor(ticker.changePct)}`}>
                          {formatPct(ticker.changePct, { showSign: true })}
                        </p>
                      </div>
                      {/* Bell icon */}
                      <button className="flex-shrink-0 text-slate-500 hover:text-amber-400 transition-colors p-1 -mr-1 -mt-0.5">
                        <Bell className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Line 2: ATH / Target / vs Target */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5 text-xs">
                      <span className="text-slate-500">
                        vs ATH:{" "}
                        <span className={pctColor(ticker.athPct)}>
                          {formatPct(ticker.athPct, { showSign: true })}
                        </span>
                      </span>
                      {ticker.targetPrice !== null && (
                        <>
                          <span className="text-slate-700">·</span>
                          <span className="text-slate-500">
                            Target:{" "}
                            <span className="text-slate-300 font-mono">
                              ${formatPrice(ticker.targetPrice)}
                            </span>
                          </span>
                          <span className="text-slate-700">·</span>
                          <span className="text-slate-500">
                            vs Target:{" "}
                            <span className={pctColor(ticker.targetPct)}>
                              {formatPct(ticker.targetPct, { showSign: true })}
                            </span>
                          </span>
                        </>
                      )}
                    </div>

                    {/* Line 3: Earnings badge */}
                    {badge && (
                      <div className="mt-2">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            badge.urgent
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : "bg-slate-700/80 text-slate-400"
                          }`}
                        >
                          {badge.text}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
