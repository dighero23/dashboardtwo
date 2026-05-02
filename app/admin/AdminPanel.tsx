"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, RefreshCw, Loader2 } from "lucide-react";
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
  const [users, setUsers]     = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [saving, setSaving]   = useState<Set<string>>(new Set());

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

    // Optimistic update
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
      // Revert on failure
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

  return (
    <main className="min-h-screen bg-slate-900 px-4 pt-10 pb-16 sm:pt-14">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
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

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60"
            >
              ← Home
            </Link>
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
            <div className="min-w-[520px]">

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
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-300">
                      {(u.email?.[0] ?? "?").toUpperCase()}
                    </div>

                    {/* Info */}
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

                    {/* Permission toggles */}
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
    </main>
  );
}
