"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Plus,
  Star,
  Trash2,
  Loader2,
  Bell,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import type { TickerData, AlertData } from "@/lib/buildTickerData";

interface Props {
  tickers: TickerData[];
  initialTickerId?: string | null; // open directly to this ticker's add form
  onClose: () => void;
  onChanged: () => void; // refresh tickers after any mutation
}

type Mode = "list" | "add";

interface FormState {
  tickerId: string;
  targetPrice: string;
  comment: string;
}

function formatPrice(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── AlertRow ─────────────────────────────────────────────────────────────────

function AlertRow({
  alert,
  isOnly,
  onDelete,
  onSetDisplay,
  onEdit,
}: {
  alert: AlertData;
  isOnly: boolean;
  onDelete: (id: string) => void;
  onSetDisplay: (id: string) => void;
  onEdit: (alert: AlertData) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [promoting, setPromoting] = useState(false);

  async function handleDelete() {
    if (!confirm("¿Eliminar esta alerta?")) return;
    setDeleting(true);
    await fetch(`/api/alerts/${alert.id}`, { method: "DELETE" });
    onDelete(alert.id);
    setDeleting(false);
  }

  async function handleSetDisplay() {
    if (alert.isDisplayTarget) return;
    setPromoting(true);
    await fetch(`/api/alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_display_target: true }),
    });
    onSetDisplay(alert.id);
    setPromoting(false);
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      {/* Star / display target */}
      <button
        onClick={handleSetDisplay}
        disabled={isOnly || alert.isDisplayTarget || promoting}
        title={alert.isDisplayTarget ? "Display target" : "Set as display target"}
        className={`flex-shrink-0 w-5 h-5 flex items-center justify-center transition-colors ${
          alert.isDisplayTarget
            ? "text-amber-400"
            : isOnly
            ? "text-amber-400/40"
            : "text-slate-600 hover:text-amber-400"
        }`}
      >
        {promoting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Star className={`w-3.5 h-3.5 ${alert.isDisplayTarget ? "fill-current" : ""}`} />
        )}
      </button>

      {/* Target price */}
      <button
        onClick={() => onEdit(alert)}
        className="flex-1 text-left"
      >
        <span className="text-sm font-mono text-white">
          ${formatPrice(alert.targetPrice)}
        </span>
        {alert.comment && (
          <span className="text-xs text-slate-500 ml-2 italic truncate max-w-[120px] inline-block align-bottom">
            "{alert.comment}"
          </span>
        )}
      </button>

      {/* Status badge */}
      <span
        className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
          alert.status === "triggered"
            ? "bg-amber-500/20 text-amber-400"
            : "bg-slate-700 text-slate-400"
        }`}
      >
        {alert.status}
      </span>

      {/* Delete */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="flex-shrink-0 text-red-500/40 hover:text-red-400 transition-colors"
      >
        {deleting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

// ─── EditAlertModal (inline) ───────────────────────────────────────────────────

function EditForm({
  alert,
  onSave,
  onCancel,
}: {
  alert: AlertData;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [price, setPrice] = useState(String(alert.targetPrice));
  const [comment, setComment] = useState(alert.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!price || isNaN(Number(price))) { setError("Invalid price"); return; }
    setSaving(true);
    const res = await fetch(`/api/alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_price: Number(price), comment }),
    });
    setSaving(false);
    if (res.ok) onSave();
    else setError("Failed to save");
  }

  return (
    <div className="mt-1 mb-2 bg-slate-900 rounded-lg p-3 border border-slate-700 space-y-2">
      <div className="flex gap-2">
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-slate-400"
          placeholder="Target price"
          step="0.01"
          min="0"
        />
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-slate-400"
          placeholder="Comment (optional)"
          maxLength={100}
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 text-xs text-slate-400 hover:text-slate-200 py-1">Cancel</button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded py-1 flex items-center justify-center gap-1"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Save
        </button>
      </div>
    </div>
  );
}

// ─── TickerSection ─────────────────────────────────────────────────────────────

function TickerSection({
  ticker,
  onChanged,
  defaultOpen,
}: {
  ticker: TickerData;
  onChanged: () => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [alerts, setAlerts] = useState<AlertData[]>(ticker.alerts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addPrice, setAddPrice] = useState("");
  const [addComment, setAddComment] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleDelete = useCallback((id: string) => {
    setAlerts((prev) => {
      const next = prev.filter((a) => a.id !== id);
      // If we deleted the display target and there are others, promote the first
      const deletedWasDisplay = prev.find((a) => a.id === id)?.isDisplayTarget;
      if (deletedWasDisplay && next.length > 0 && !next.some((a) => a.isDisplayTarget)) {
        next[0] = { ...next[0], isDisplayTarget: true };
      }
      return next;
    });
    onChanged();
  }, [onChanged]);

  const handleSetDisplay = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => ({ ...a, isDisplayTarget: a.id === id }))
    );
    onChanged();
  }, [onChanged]);

  async function handleAdd() {
    if (!addPrice || isNaN(Number(addPrice)) || Number(addPrice) <= 0) {
      setAddError("Enter a valid price"); return;
    }
    setAdding(true);
    setAddError(null);
    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker_id: ticker.id,
        target_price: Number(addPrice),
        comment: addComment.trim() || null,
      }),
    });
    const json = await res.json();
    setAdding(false);
    if (!res.ok) { setAddError(json.error ?? "Failed"); return; }

    const newAlert: AlertData = {
      id: json.id,
      tickerId: ticker.id,
      targetPrice: json.target_price,
      comment: json.comment,
      isDisplayTarget: json.is_display_target,
      status: json.status,
      triggeredAt: json.triggered_at,
      cooldownUntil: json.cooldown_until,
    };

    setAlerts((prev) => {
      // If this is the first alert, it's already set as display target by the API
      if (json.is_display_target) {
        return [newAlert, ...prev.map((a) => ({ ...a, isDisplayTarget: false }))];
      }
      return [...prev, newAlert];
    });
    setAddOpen(false);
    setAddPrice("");
    setAddComment("");
    onChanged();
  }

  return (
    <div className="border border-slate-700/60 rounded-xl overflow-hidden">
      {/* Ticker header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/60 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-bold text-white text-sm">{ticker.symbol}</span>
          <span className="text-xs text-slate-500">{ticker.name}</span>
          {alerts.length > 0 && (
            <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full">
              {alerts.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">${formatPrice(ticker.price)}</span>
          {open ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-3 bg-slate-900/40">
          {/* Alert list */}
          {alerts.length === 0 && !addOpen && (
            <p className="text-xs text-slate-600 py-2">No alerts configured.</p>
          )}

          <div className="divide-y divide-slate-800">
            {alerts.map((alert) =>
              editingId === alert.id ? (
                <EditForm
                  key={alert.id}
                  alert={alert}
                  onSave={() => { setEditingId(null); onChanged(); }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  isOnly={alerts.length === 1}
                  onDelete={handleDelete}
                  onSetDisplay={handleSetDisplay}
                  onEdit={(a) => setEditingId(a.id)}
                />
              )
            )}
          </div>

          {/* Add alert inline form */}
          {addOpen && (
            <div className="mt-2 bg-slate-800 rounded-lg p-3 border border-slate-700 space-y-2">
              <div className="flex gap-2">
                <input
                  type="number"
                  value={addPrice}
                  onChange={(e) => setAddPrice(e.target.value)}
                  autoFocus
                  className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-slate-400"
                  placeholder="Target price"
                  step="0.01"
                  min="0"
                />
                <input
                  type="text"
                  value={addComment}
                  onChange={(e) => setAddComment(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-slate-400"
                  placeholder="Comment (optional)"
                  maxLength={100}
                />
              </div>
              {addError && <p className="text-xs text-red-400">{addError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => { setAddOpen(false); setAddError(null); }}
                  className="flex-1 text-xs text-slate-400 hover:text-slate-200 py-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={adding}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded py-1 flex items-center justify-center gap-1"
                >
                  {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Add alert
                </button>
              </div>
            </div>
          )}

          {/* Add alert button */}
          {!addOpen && (
            <button
              onClick={() => setAddOpen(true)}
              className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-400 transition-colors py-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add alert
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── AlertPanel (main) ─────────────────────────────────────────────────────────

export default function AlertPanel({ tickers, initialTickerId, onClose, onChanged }: Props) {
  const [mode, setMode] = useState<Mode>("list");
  const [form, setForm] = useState<FormState>({
    tickerId: initialTickerId ?? (tickers[0]?.id ?? ""),
    targetPrice: "",
    comment: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // If opened from a specific ticker's bell → go straight to add form
  useEffect(() => {
    if (initialTickerId) setMode("add");
  }, [initialTickerId]);

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    if (!form.tickerId || !form.targetPrice) return;
    setSaving(true);
    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker_id: form.tickerId,
        target_price: Number(form.targetPrice),
        comment: form.comment.trim() || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setForm((f) => ({ ...f, targetPrice: "", comment: "" }));
      setMode("list");
      onChanged();
    } else {
      const json = await res.json();
      setSaveError(json.error ?? "Failed to create alert");
    }
  }

  // Panel content
  const panelContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <h2 className="font-semibold text-white text-sm">Alerts</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode(mode === "add" ? "list" : "add")}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-400 transition-colors border border-slate-700 rounded-lg px-2.5 py-1.5 hover:border-emerald-500/40"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Quick-add form */}
      {mode === "add" && (
        <form onSubmit={handleQuickAdd} className="px-4 py-4 border-b border-slate-800 bg-slate-800/40 flex-shrink-0 space-y-3">
          <p className="text-xs text-slate-400 font-medium">New alert</p>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Ticker</label>
            <select
              value={form.tickerId}
              onChange={(e) => setForm((f) => ({ ...f, tickerId: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-500"
            >
              {tickers.map((t) => (
                <option key={t.id} value={t.id}>{t.symbol} — {t.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Target price</label>
              <input
                type="number"
                value={form.targetPrice}
                onChange={(e) => setForm((f) => ({ ...f, targetPrice: e.target.value }))}
                required
                autoFocus
                step="0.01"
                min="0"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-slate-500"
                placeholder="150.00"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">Comment</label>
              <input
                type="text"
                value={form.comment}
                onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                maxLength={100}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-500"
                placeholder="Buen punto para DCA"
              />
            </div>
          </div>

          {saveError && <p className="text-xs text-red-400">{saveError}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("list")}
              className="flex-1 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg py-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xs font-medium rounded-lg py-2 flex items-center justify-center gap-1 transition-colors"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Create
            </button>
          </div>
        </form>
      )}

      {/* Ticker sections */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {tickers.length === 0 && (
          <p className="text-xs text-slate-600 text-center py-8">No tickers in watchlist.</p>
        )}
        {tickers.map((ticker) => (
          <TickerSection
            key={ticker.id}
            ticker={ticker}
            onChanged={onChanged}
            defaultOpen={ticker.id === initialTickerId || tickers.length === 1}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-slate-800 flex-shrink-0">
        <p className="text-xs text-slate-600">
          <Star className="w-3 h-3 inline mr-1 text-amber-400/60" />
          Star = display target shown in watchlist
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: slide-in panel from right */}
      <div className="hidden md:flex fixed inset-0 z-40">
        <div className="flex-1 bg-black/40" onClick={onClose} />
        <div className="w-96 bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
          {panelContent}
        </div>
      </div>

      {/* Mobile: full-screen bottom sheet */}
      <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end">
        <div className="flex-1 bg-black/40" onClick={onClose} />
        <div className="bg-slate-900 border-t border-slate-800 rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh]">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 bg-slate-700 rounded-full" />
          </div>
          {panelContent}
        </div>
      </div>
    </>
  );
}
