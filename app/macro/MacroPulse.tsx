"use client";

import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";

export default function MacroPulse() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* ── Sticky header ─────────────────────────────────────────────────── */}
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
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: "#3b82f622", border: "1px solid #3b82f655" }}
            >
              <BarChart3 className="w-3.5 h-3.5" style={{ color: "#3b82f6" }} />
            </div>
            <span className="font-semibold text-white text-sm sm:text-base">Macro Pulse</span>
          </div>

          <div className="w-20" />
        </div>
      </header>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 flex flex-col items-center justify-center gap-6 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "#3b82f610", border: "1px solid #3b82f630" }}
        >
          <BarChart3 className="w-8 h-8" style={{ color: "#3b82f6" }} />
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white">Macro Pulse</h2>
          <p className="text-slate-400 text-sm mt-1.5 max-w-xs">
            Economic indicators, yield curve & market events — loading up.
          </p>
        </div>

        <div className="w-full max-w-sm space-y-2.5">
          {["Fed Funds Rate", "CPI / Inflation", "10Y–2Y Spread", "Economic Calendar"].map((label) => (
            <div
              key={label}
              className="h-14 rounded-xl bg-slate-800/40 border border-slate-700/50 animate-pulse"
            />
          ))}
        </div>

        <p className="text-[10px] text-slate-600">
          Powered by FRED · Finnhub
        </p>
      </div>
    </div>
  );
}
