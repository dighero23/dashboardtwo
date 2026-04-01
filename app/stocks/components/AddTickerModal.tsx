"use client";

import { useState, useEffect, useRef } from "react";
import { X, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface Props {
  onClose: () => void;
  onAdded: () => void;
}

type LookupState = "idle" | "loading" | "found" | "not-found";

export default function AddTickerModal({ onClose, onAdded }: Props) {
  const [symbol, setSymbol] = useState("");
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a ref so handleSubmit always reads the latest resolved name
  const resolvedNameRef = useRef<string | null>(null);

  async function lookupSymbol(raw: string) {
    const sym = raw.trim().toUpperCase();
    if (!sym) {
      setLookupState("idle");
      return;
    }

    setLookupState("loading");
    setResolvedName(null);
    resolvedNameRef.current = null;

    try {
      const res = await fetch(`/api/tickers/lookup?symbol=${encodeURIComponent(sym)}`);
      if (res.ok) {
        const json = await res.json();
        const name = json.name ?? sym;
        setResolvedName(name);
        resolvedNameRef.current = name;
        setLookupState("found");
      } else {
        setLookupState("not-found");
      }
    } catch {
      setLookupState("not-found");
    }
  }

  // Debounced auto-lookup as user types — no need to blur
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const sym = symbol.trim();
    if (!sym) {
      setLookupState("idle");
      setResolvedName(null);
      resolvedNameRef.current = null;
      return;
    }
    setLookupState("loading");
    debounceRef.current = setTimeout(() => lookupSymbol(sym), 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sym = symbol.trim().toUpperCase();
    if (!sym || lookupState !== "found") return;

    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/tickers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Use ref — avoids stale closure if state hasn't settled yet
      body: JSON.stringify({ symbol: sym, name: resolvedNameRef.current }),
    });

    const json = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(json.error ?? "Failed to add ticker");
    } else {
      onAdded();
    }
  }

  const canSubmit = lookupState === "found" && !submitting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Add ticker</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Symbol <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => {
                setSymbol(e.target.value.toUpperCase());
                setLookupState("idle");
                setResolvedName(null);
              }}
              required
              autoFocus
              maxLength={10}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-[16px] text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors font-mono uppercase"
              placeholder="AAPL"
            />

            {/* Company name resolution feedback */}
            <div className="mt-2 min-h-[20px]">
              {lookupState === "loading" && (
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Looking up…
                </span>
              )}
              {lookupState === "found" && resolvedName && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle className="w-3 h-3 flex-shrink-0" />
                  {resolvedName}
                </span>
              )}
              {lookupState === "not-found" && (
                <span className="flex items-center gap-1.5 text-xs text-red-400">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  Ticker not found
                </span>
              )}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium text-sm rounded-lg py-2.5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium text-sm rounded-lg py-2.5 transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
