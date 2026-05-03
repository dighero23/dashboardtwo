"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, RefreshCw, Loader2, Megaphone, X, RotateCcw } from "lucide-react";
import Link from "next/link";

type PermKey = "is_admin" | "can_edit_stocks" | "can_edit_f1" | "can_edit_macro" | "can_edit_health";

interface Perms {
  is_admin: boolean;
  can_edit_stocks: boolean;
  can_edit_f1: boolean;
  can_edit_macro: boolean;
  can_edit_health: boolean;
}

interface UserRow {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  permissions: Perms;
}

const PERM_COLS: { key: PermKey; label: string; color: string }[] = [
  { key: "is_admin",        label: "Admin",  color: "#a78bfa" },
  { key: "can_edit_stocks", label: "Stocks", color: "#34d399" },
  { key: "can_edit_f1",     label: "F1",     color: "#fbbf24" },
  { key: "can_edit_macro",  label: "Macro",  color: "#60a5fa" },
  { key: "can_edit_health", label: "Health", color: "#f87171" },
];

const MODULES = ["all", "f1", "stocks", "macro", "health"] as const;
type Mod = typeof MODULES[number];

const MOD_LABELS: Record<Mod, string> = {
  all: "Everyone", f1: "F1", stocks: "Stocks", macro: "Macro", health: "Health",
};
const MOD_COLORS: Record<Mod, string> = {
  all: "#a78bfa", f1: "#fbbf24", stocks: "#34d399", macro: "#60a5fa", health: "#f87171",
};

const SYNC_MODULES = ["all", "f1", "stocks", "macro"] as const;
type SyncMod = typeof SYNC_MODULES[number];
const SYNC_LABELS: Record<SyncMod, string> = {
  all: "All", f1: "F1", stocks: "Stocks", macro: "Macro",
};

function Toggle({
  checked,
  color,
  disabled,
  onChange,
}: {
  checked: boolean;
  color: string;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
      }`}
      style={{ background: checked ? color : "#334155" }}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminPanel() {
  const [users,   setUsers]   = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [saving,  setSaving]  = useState<Set<string>>(new Set());

  // Broadcast state
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [bMod,     setBMod]     = useState<Mod>("all");
  const [bTitle,   setBTitle]   = useState("");
  const [bMessage, setBMessage] = useState("");
  const [bSending, setBSending] = useState(false);
  const [bResult,  setBResult]  = useState<string | null>(null);

  // Sync state
  const [showSync, setShowSync]   = useState(false);
  const [sMod,     setSMod]       = useState<SyncMod>("all");
  const [sSyncing, setSSyncing]   = useState(false);
  const [sResult,  setSResult]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (res.status === 401 || res.status === 403) {
        setError("You don't have permission to view this page.");
        return;
      }
      const json = await res.json();
      setUsers(json.users ?? []);
    } catch {
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(userId: string, key: PermKey, current: boolean) {
    const saveKey = `${userId}:${key}`;
    setSaving((s) => new Set(s).add(saveKey));
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, permissions: { ...u.permissions, [key]: !current } }
          : u
      )
    );
    try {
      const res = await fetch(`/api/admin/users/${userId}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: !current }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, permissions: { ...u.permissions, [key]: current } }
            : u
        )
      );
    } finally {
      setSaving((s) => {
        const next = new Set(s);
        next.delete(saveKey);
        return next;
      });
    }
  }

  async function sendBroadcast() {
    if (!bTitle.trim() || !bMessage.trim()) return;
    setBSending(true);
    setBResult(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: bTitle, message: bMessage, module: bMod }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBResult(`Error: ${json.error ?? "Unknown error"}`);
      } else {
        setBResult(`Sent to ${json.sent} device(s).${json.failed > 0 ? ` ${json.failed} failed/removed.` : ""}`);
        setBTitle("");
        setBMessage("");
      }
    } catch {
      setBResult("Network error.");
    } finally {
      setBSending(false);
    }
  }

  async function runSync() {
    setSSyncing(true);
    setSResult(null);
    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: sMod }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSResult(`Error: ${json.error ?? "Unknown error"}`);
      } else {
        const r = json.result as Record<string, number | string>;
        const parts = Object.entries(r)
          .filter(([, v]) => v !== 0 && v !== "error")
          .map(([k, v]) => `${k.toUpperCase()}: ${v === "refreshed" ? "refreshed" : `${v} expired`}`);
        setSResult(parts.length > 0 ? parts.join(" · ") : "Nothing to clear.");
      }
    } catch {
      setSResult("Network error.");
    } finally {
      setSSyncing(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-900 px-4 pt-10 pb-16 sm:pt-14">
      <div className="max-w-3xl mx-auto">

        {/* Header — two rows */}
        <div className="mb-6">
          {/* Row 1: Title + Home */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "#a78bfa1a", border: "1px solid #a78bfa44" }}
              >
                <Shield className="w-5 h-5" style={{ color: "#a78bfa" }} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Admin Panel</h1>
                {!loading && !error && (
                  <p className="text-xs text-slate-500">
                    {users.length} {users.length === 1 ? "user" : "users"}
                  </p>
                )}
              </div>
            </div>
            <Link
              href="/"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60"
            >
              ← Home
            </Link>
          </div>

          {/* Row 2: Action buttons */}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => { setShowSync(true); setSResult(null); }}
              className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500/20"
            >
              <RotateCcw className="w-3 h-3" />
              Sync
            </button>
            <button
              onClick={() => { setShowBroadcast(true); setBResult(null); }}
              className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20"
            >
              <Megaphone className="w-3 h-3" />
              Broadcast
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 hover:bg-slate-700/60"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-5 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !error && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl bg-slate-800/40 border border-slate-700/50 p-4 animate-pulse"
              >
                <div className="h-3 bg-slate-700/60 rounded w-48 mb-2.5" />
                <div className="h-2.5 bg-slate-700/60 rounded w-36" />
              </div>
            ))}
          </div>
        )}

        {/* Scrollable table: headers + rows */}
        {!loading && !error && (
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="min-w-[520px] pb-3">

              {/* Column headers */}
              {users.length > 0 && (
                <div className="flex items-center mb-2 pr-1">
                  <div className="flex-1" />
                  <div className="flex items-center gap-6">
                    {PERM_COLS.map(({ key, label, color }) => (
                      <span
                        key={key}
                        className="text-[10px] font-semibold uppercase tracking-wider w-10 text-center"
                        style={{ color }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* User rows */}
              <div className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-xl bg-slate-800/40 border border-slate-700/50 px-4 py-3 flex items-center gap-4"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-300">
                      {(u.email?.[0] ?? "?").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">
                        {u.email ?? "(no email)"}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Joined {fmt(u.created_at)}
                        {u.last_sign_in_at && (
                          <span className="hidden sm:inline"> · Last login {fmt(u.last_sign_in_at)}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 flex-shrink-0">
                      {PERM_COLS.map(({ key, color }) => {
                        const saveKey = `${u.id}:${key}`;
                        return (
                          <div key={key} className="w-10 flex justify-center">
                            {saving.has(saveKey) ? (
                              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                            ) : (
                              <Toggle
                                checked={u.permissions[key]}
                                color={color}
                                disabled={false}
                                onChange={() => toggle(u.id, key, u.permissions[key])}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        )}

      </div>

      {/* Sync modal */}
      {showSync && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSync(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-slate-800 border border-slate-700 p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-sky-400" />
                <span className="text-sm font-semibold text-white">Force Sync</span>
              </div>
              <button
                onClick={() => setShowSync(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Expires cached data so the next load fetches fresh from the source. Stocks data is refreshed immediately.
            </p>

            <div className="flex flex-wrap gap-1.5 mb-5">
              {SYNC_MODULES.map((m) => (
                <button
                  key={m}
                  onClick={() => setSMod(m)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                  style={
                    sMod === m
                      ? { background: MOD_COLORS[m] + "33", color: MOD_COLORS[m], border: `1px solid ${MOD_COLORS[m]}66` }
                      : { background: "transparent", color: "#94a3b8", border: "1px solid #334155" }
                  }
                >
                  {SYNC_LABELS[m]}
                </button>
              ))}
            </div>

            {sResult && (
              <p className="text-xs text-slate-400 mb-3">{sResult}</p>
            )}

            <button
              onClick={runSync}
              disabled={sSyncing}
              className="w-full py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-sky-500/20 border border-sky-500/40 text-sky-300 hover:bg-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sSyncing
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <RotateCcw className="w-4 h-4" />
              }
              {sSyncing ? "Syncing…" : "Sync Now"}
            </button>
          </div>
        </div>
      )}

      {/* Broadcast modal */}
      {showBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowBroadcast(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-slate-800 border border-slate-700 p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-white">Broadcast Notification</span>
              </div>
              <button
                onClick={() => setShowBroadcast(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {MODULES.map((m) => (
                <button
                  key={m}
                  onClick={() => setBMod(m)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                  style={
                    bMod === m
                      ? { background: MOD_COLORS[m] + "33", color: MOD_COLORS[m], border: `1px solid ${MOD_COLORS[m]}66` }
                      : { background: "transparent", color: "#94a3b8", border: "1px solid #334155" }
                  }
                >
                  {MOD_LABELS[m]}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Title"
              value={bTitle}
              onChange={(e) => setBTitle(e.target.value)}
              className="w-full mb-2 px-3 py-2 rounded-lg bg-slate-700/60 border border-slate-600 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
            />
            <textarea
              placeholder="Message"
              value={bMessage}
              onChange={(e) => setBMessage(e.target.value)}
              rows={3}
              className="w-full mb-3 px-3 py-2 rounded-lg bg-slate-700/60 border border-slate-600 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 resize-none"
            />

            {bResult && (
              <p className="text-xs text-slate-400 mb-3">{bResult}</p>
            )}

            <button
              onClick={sendBroadcast}
              disabled={bSending || !bTitle.trim() || !bMessage.trim()}
              className="w-full py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bSending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Megaphone className="w-4 h-4" />
              }
              {bSending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
