"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ArrowLeft, Flag } from "lucide-react";

type Timezone = "CST" | "EST" | "LOCAL";

export default function F1Module() {
  const [timezone, setTimezone] = useState<Timezone>("CST");

  useEffect(() => {
    const saved = localStorage.getItem("f1-timezone") as Timezone | null;
    if (saved === "CST" || saved === "EST" || saved === "LOCAL") setTimezone(saved);
  }, []);

  function handleTimezone(tz: Timezone) {
    setTimezone(tz);
    localStorage.setItem("f1-timezone", tz);
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Back link */}
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

          {/* Timezone toggle */}
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
        </div>
      </header>

      {/* Content — Phase 2b/2c will fill this in */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="rounded-xl bg-slate-800/40 border border-slate-700/60 p-8 text-center">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{ background: "#fbbf2422", border: "1px solid #fbbf2455" }}
          >
            <Flag className="w-6 h-6" style={{ color: "#fbbf24" }} />
          </div>
          <p className="text-slate-400 text-sm">Loading race data…</p>
        </div>
      </div>
    </div>
  );
}
