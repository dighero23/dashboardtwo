import Link from "next/link";
import { TrendingUp, Flag, BarChart3, ChevronRight, Zap } from "lucide-react";

const modules = [
  {
    id: "stocks",
    icon: TrendingUp,
    title: "Stock Tracker",
    subtitle: "Real-time watchlist with price alerts",
    href: "/stocks",
    active: true,
    accentColor: "text-emerald-400",
    borderColor: "border-emerald-500/30",
    bgGlow: "from-emerald-500/10",
  },
  {
    id: "f1",
    icon: Flag,
    title: "Formula 1",
    subtitle: "Race calendar, standings & results",
    href: "/f1",
    active: true,
    accentColor: "text-amber-400",
    borderColor: "border-amber-500/30",
    bgGlow: "from-amber-500/10",
  },
  {
    id: "macro",
    icon: BarChart3,
    title: "Macro Pulse",
    subtitle: "Economic indicators & market events",
    href: "/macro",
    active: true,
    accentColor: "text-blue-400",
    borderColor: "border-blue-500/30",
    bgGlow: "from-blue-500/10",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-start px-4 pt-16 pb-10 sm:pt-20">
      {/* Header */}
      <div className="text-center mb-10">
        {/* Lightning bolt logo */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-5 relative">
          {/* Outer glow ring */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-yellow-300 opacity-20 blur-md scale-110" />
          {/* Gradient circle */}
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Zap className="w-8 h-8 text-white fill-white drop-shadow-sm" strokeWidth={2.5} />
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          JD Dashboard
        </h1>
        <p className="mt-2 text-slate-400 text-base sm:text-lg">
          Your tools. Your data. Your pace.
        </p>
      </div>

      {/* Module cards */}
      <div className="w-full max-w-md space-y-3">
        {modules.map((mod) => {
          const Icon = mod.icon;

          if (!mod.active) {
            return (
              <div
                key={mod.id}
                className="relative flex items-center gap-4 p-4 sm:p-5 rounded-2xl bg-slate-800/40 border border-slate-700/50 opacity-50 cursor-not-allowed select-none"
              >
                <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-slate-700/50 flex items-center justify-center">
                  <Icon className={`w-5 h-5 ${mod.accentColor} opacity-50`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-300 text-sm sm:text-base">
                      {mod.title}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 font-medium">
                      Coming soon
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs sm:text-sm mt-0.5 truncate">
                    {mod.subtitle}
                  </p>
                </div>
              </div>
            );
          }

          return (
            <Link key={mod.id} href={mod.href} className="group block">
              <div
                className={`relative flex items-center gap-4 p-4 sm:p-5 rounded-2xl bg-slate-800/60 border ${mod.borderColor} hover:bg-slate-800 transition-all duration-200 shadow-lg`}
              >
                <div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${mod.bgGlow} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
                />
                <div
                  className={`relative flex-shrink-0 w-11 h-11 rounded-xl bg-slate-700/60 border ${mod.borderColor} flex items-center justify-center group-hover:scale-105 transition-transform duration-200`}
                >
                  <Icon className={`w-5 h-5 ${mod.accentColor}`} />
                </div>
                <div className="relative flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm sm:text-base">
                    {mod.title}
                  </p>
                  <p className="text-slate-400 text-xs sm:text-sm mt-0.5 truncate">
                    {mod.subtitle}
                  </p>
                </div>
                <ChevronRight className="relative flex-shrink-0 w-4 h-4 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all duration-200" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <p className="mt-10 text-slate-600 text-xs">
        JD Dashboard 2.0 — Phase 1
      </p>
    </main>
  );
}
