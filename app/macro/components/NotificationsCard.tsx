"use client";

import { LogIn } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { MacroNotificationPrefs } from "@/lib/macro/types";
import PushSubscribeButton from "@/app/stocks/components/PushSubscribeButton";

interface NotifItem {
  key: keyof MacroNotificationPrefs;
  label: string;
  sub: string;
}

const ITEMS: NotifItem[] = [
  { key: "cpiRelease",  label: "CPI report",       sub: "1 hour before release · ~8:30am ET" },
  { key: "fedDecision", label: "FOMC decision",     sub: "1 hour before announcement · ~2pm ET" },
  { key: "gdpRelease",  label: "GDP report",        sub: "1 hour before release · ~8:30am ET" },
  { key: "jobsReport",  label: "Jobs report (NFP)", sub: "1 hour before release · ~8:30am ET" },
  { key: "pceRelease",  label: "PCE report",        sub: "1 hour before release · ~8:30am ET" },
];

interface Props {
  user: User | null;
  canEdit: boolean;
  prefs: MacroNotificationPrefs;
  onToggle: (key: keyof MacroNotificationPrefs, value: boolean) => void;
  onLoginRequest: () => void;
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className="relative w-9 h-5 rounded-full transition-colors flex-shrink-0"
      style={{ background: on ? "#3b82f6" : "#334155" }}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? "left-4" : "left-0.5"}`} />
    </button>
  );
}

export default function NotificationsCard({ user, canEdit, prefs, onToggle, onLoginRequest }: Props) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-medium">
        Notifications
      </p>

      {!user ? (
        <button
          onClick={onLoginRequest}
          className="w-full text-left rounded-xl bg-slate-800/40 border border-slate-700/60 px-4 py-3.5 hover:bg-slate-800 hover:border-slate-700 transition-colors group"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-300 font-medium leading-tight">
                Sign in to configure alerts
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Get push notifications before key economic releases.
              </p>
            </div>
            <LogIn className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0" />
          </div>
        </button>
      ) : !canEdit ? (
        <div className="rounded-xl bg-slate-800/40 border border-slate-700/60 px-4 py-3.5">
          <p className="text-sm text-slate-500">Macro notifications not enabled for your account.</p>
        </div>
      ) : (
        <>
          <div className="flex justify-end mb-2">
            <PushSubscribeButton mobile />
          </div>
          <div className="rounded-xl bg-slate-800/40 border border-slate-700/60 divide-y divide-slate-800/80">
            {ITEMS.map(({ key, label, sub }) => (
              <div key={key} className="flex items-center px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 leading-tight">{label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>
                </div>
                <Toggle on={prefs[key]} onClick={() => onToggle(key, !prefs[key])} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
