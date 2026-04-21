"use client";

import type { User } from "@supabase/supabase-js";
import type { F1NotificationPrefs } from "@/lib/f1/types";

interface NotifItem {
  key: keyof F1NotificationPrefs;
  label: string;
  sub: string;
}

const ITEMS: NotifItem[] = [
  { key: "weekAhead",   label: "1 week before race",      sub: "Mondays · 12pm" },
  { key: "preQuali",    label: "1 hour before quali",     sub: "Saturday" },
  { key: "qualiResult", label: "Qualifying result",       sub: "Within 30 min" },
  { key: "preRace",     label: "1 hour before race",      sub: "Sunday" },
  { key: "raceResult",  label: "Race result",             sub: "Within 30 min" },
];

interface Props {
  user: User | null;
  prefs: F1NotificationPrefs;
  onToggle: (key: keyof F1NotificationPrefs, value: boolean) => void;
  onLoginRequest: () => void;
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className="relative w-9 h-5 rounded-full transition-colors flex-shrink-0"
      style={{ background: on ? "#fbbf24" : "#334155" }}
    >
      <div
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
          on ? "left-4" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function NotificationsCard({ user, prefs, onToggle, onLoginRequest }: Props) {
  function handleToggle(key: keyof F1NotificationPrefs, currentVal: boolean) {
    if (!user) {
      onLoginRequest();
      return;
    }
    onToggle(key, !currentVal);
  }

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-medium">
        Notifications
      </p>

      {!user && (
        <p className="text-[11px] text-slate-500 mb-2 px-1">
          Sign in to receive push notifications.
        </p>
      )}

      <div className="rounded-xl bg-slate-800/40 border border-slate-700/60 divide-y divide-slate-800/80">
        {ITEMS.map(({ key, label, sub }) => (
          <div key={key} className="flex items-center px-4 py-3 gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-200 leading-tight">{label}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>
            </div>
            <Toggle
              on={prefs[key]}
              onClick={() => handleToggle(key, prefs[key])}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
