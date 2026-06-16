"use client";

import { useState, useEffect, useMemo } from "react";
import { TrendingUp, Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, Check } from "lucide-react";
import type { BabyProfile, GrowthMeasurement } from "@/lib/baby/types";
import { calcPercentiles, whoCurvePoint, ageInMonths } from "@/lib/who/percentile";

// Set to false to disable WHO percentile feature entirely
const SHOW_PERCENTILES = true;

// ---- Weight helpers --------------------------------------------------------

function ozToDisplay(oz: number): string {
  const lb = Math.floor(oz / 16);
  const rem = oz % 16;
  return rem === 0 ? `${lb} lb` : `${lb} lb ${rem} oz`;
}

function parseWeight(lb: string, oz: string): number | null {
  const lbN = lb.trim() === "" ? 0 : parseInt(lb, 10);
  const ozN = oz.trim() === "" ? 0 : parseInt(oz, 10);
  if (lb.trim() === "" && oz.trim() === "") return null;
  if (isNaN(lbN) || isNaN(ozN) || lbN < 0 || ozN < 0 || ozN > 15) return null;
  return lbN * 16 + ozN;
}

function weightDiff(curr: number, prev: number): string {
  const delta = curr - prev;
  const sign  = delta >= 0 ? "+" : "";
  const lb    = Math.floor(Math.abs(delta) / 16);
  const oz    = Math.abs(delta) % 16;
  if (lb === 0) return `${sign}${delta > 0 ? "" : "-"}${oz} oz`;
  if (oz === 0) return `${sign}${delta >= 0 ? lb : -lb} lb`;
  return `${sign}${delta >= 0 ? lb : -lb} lb ${oz} oz`;
}

function heightDiff(curr: number, prev: number): string {
  const d = curr - prev;
  return (d >= 0 ? "+" : "") + d.toFixed(1) + " cm";
}

function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function todayISO(): string {
  return new Date().toLocaleDateString("en-CA");
}

// ---- Percentile badge -------------------------------------------------------

function PctBadge({ p, label }: { p: number; label: string }) {
  const color =
    p < 15 || p > 85
      ? "text-amber-400 bg-amber-400/10"
      : "text-slate-400 bg-slate-700/50";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${color}`}>
      {label} P{p}
    </span>
  );
}

// ---- Sparkline (wider than MacroPulse version) ------------------------------

function GrowthSparkline({ values, color, label }: { values: number[]; color: string; label: string }) {
  if (values.length < 2) return null;
  const W = 120, H = 36;
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const px = (i: number) => (i / (values.length - 1)) * W;
  const py = (v: number) => H - ((v - minV) / range) * (H - 4) - 2;
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"} ${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(" ");
  const lastX = px(values.length - 1);
  const lastY = py(values[values.length - 1]);
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[9px] text-slate-500 uppercase tracking-wide">{label}</span>
      <svg width={W} height={H} className="overflow-visible">
        <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={lastX} cy={lastY} r={2.5} fill={color} />
      </svg>
    </div>
  );
}

// ---- WHO Growth Curves chart ------------------------------------------------

const PERCENTILE_LINES: Array<{ p: number; stroke: string; dash?: string }> = [
  { p: 3,  stroke: "#ef4444", dash: "4,2" },
  { p: 15, stroke: "#f59e0b", dash: "3,2" },
  { p: 50, stroke: "#10b981" },
  { p: 85, stroke: "#f59e0b", dash: "3,2" },
  { p: 97, stroke: "#ef4444", dash: "4,2" },
];

function GrowthCurveChart({
  sex,
  metric,
  measurements,
  dob,
}: {
  sex: "male" | "female";
  metric: "weight" | "height";
  measurements: GrowthMeasurement[];
  dob: string;
}) {
  const CW = 260, CH = 130;
  const ML = 32, MB = 22, MT = 8, MR = 8;
  const W = CW + ML + MR, H = CH + MT + MB;

  // Determine Y range based on metric
  const [yMin, yMax] = metric === "weight" ? [2, 22] : [45, 115];
  const maxMonth = 60;

  const toX = (m: number) => ML + (m / maxMonth) * CW;
  const toY = (v: number) => MT + CH - ((v - yMin) / (yMax - yMin)) * CH;

  // Compute WHO percentile curve paths
  const curvePaths = useMemo(() => {
    return PERCENTILE_LINES.map(({ p }) => {
      const pts = Array.from({ length: 61 }, (_, m) => {
        const val = whoCurvePoint(sex, metric, m, p);
        if (val == null) return null;
        return { x: toX(m), y: toY(val) };
      }).filter(Boolean) as { x: number; y: number }[];

      if (pts.length < 2) return null;
      return pts.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sex, metric]);

  // Baby's actual data points + their percentile
  const dataPoints = useMemo(() => {
    return measurements
      .filter((m) => metric === "weight" ? m.weight_oz != null : m.height_cm != null)
      .map((m) => {
        const months = ageInMonths(dob, m.measured_on);
        const val = metric === "weight"
          ? (m.weight_oz! * 0.0283495)
          : Number(m.height_cm);
        const x = toX(months);
        const y = toY(val);
        const inRange = y >= MT && y <= MT + CH;
        const pct = calcPercentiles(
          sex, dob, m.measured_on,
          metric === "weight" ? m.weight_oz : null,
          metric === "height" ? m.height_cm : null,
        );
        const p = metric === "weight" ? pct.weight : pct.height;
        return { x, y, inRange, p };
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurements, dob, metric, sex]);

  // Y axis labels
  const yTicks = metric === "weight"
    ? [2, 5, 10, 15, 20]
    : [50, 60, 70, 80, 90, 100, 110];

  // X axis labels (months)
  const xTicks = [0, 12, 24, 36, 48, 60];

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      {/* Grid lines */}
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={ML} y1={toY(v)} x2={ML + CW} y2={toY(v)}
            stroke="#1e293b" strokeWidth={1}
          />
          <text x={ML - 3} y={toY(v) + 3.5} textAnchor="end" fontSize={7} fill="#475569">
            {v}
          </text>
        </g>
      ))}
      {xTicks.map((m) => (
        <g key={m}>
          <line
            x1={toX(m)} y1={MT} x2={toX(m)} y2={MT + CH}
            stroke="#1e293b" strokeWidth={1}
          />
          <text x={toX(m)} y={MT + CH + 10} textAnchor="middle" fontSize={7} fill="#475569">
            {m}m
          </text>
        </g>
      ))}
      {/* Axes */}
      <line x1={ML} y1={MT} x2={ML} y2={MT + CH} stroke="#334155" strokeWidth={1} />
      <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke="#334155" strokeWidth={1} />

      {/* WHO percentile curves */}
      {PERCENTILE_LINES.map(({ p, stroke, dash }, i) => {
        const path = curvePaths[i];
        if (!path) return null;
        return (
          <path
            key={p}
            d={path}
            fill="none"
            stroke={stroke}
            strokeWidth={p === 50 ? 1.5 : 1}
            strokeOpacity={p === 50 ? 0.7 : 0.35}
            strokeDasharray={dash}
          />
        );
      })}

      {/* Baby's data points + percentile label on the latest */}
      {dataPoints.map((pt, i) => pt.inRange && (
        <g key={i}>
          <circle cx={pt.x} cy={pt.y} r={3.5} fill="#818cf8" stroke="#1e293b" strokeWidth={1.5} />
          {i === 0 && pt.p != null && (
            <text
              x={pt.x + 7}
              y={pt.y < MT + 16 ? pt.y + 13 : pt.y - 5}
              fontSize={9}
              fontWeight="bold"
              fill="#a5b4fc"
            >
              P{pt.p}
            </text>
          )}
        </g>
      ))}

      {/* Curve labels */}
      <text x={ML + CW - 2} y={MT + 8}  textAnchor="end" fontSize={6} fill="#ef4444" opacity={0.7}>P97</text>
      <text x={ML + CW - 2} y={MT + CH - 2} textAnchor="end" fontSize={6} fill="#ef4444" opacity={0.7}>P3</text>
      <text x={ML + CW / 2} y={H - 1} textAnchor="middle" fontSize={7} fill="#475569">months</text>
      <text
        x={-MT - CH / 2} y={10}
        textAnchor="middle" fontSize={7} fill="#475569"
        transform="rotate(-90)"
      >
        {metric === "weight" ? "kg" : "cm"}
      </text>
    </svg>
  );
}

// ---- Add/Edit modal ---------------------------------------------------------

interface FormProps {
  initial?: GrowthMeasurement;
  onClose: () => void;
  onSave: (m: GrowthMeasurement) => void;
}

function MeasurementModal({ initial, onClose, onSave }: FormProps) {
  const [date,   setDate]   = useState(initial?.measured_on ?? todayISO());
  const [lb,     setLb]     = useState(initial?.weight_oz != null ? String(Math.floor(initial.weight_oz / 16)) : "");
  const [oz,     setOz]     = useState(initial?.weight_oz != null ? String(initial.weight_oz % 16) : "");
  const [cm,     setCm]     = useState(initial?.height_cm != null ? String(initial.height_cm) : "");
  const [notes,  setNotes]  = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  async function handleSave() {
    setErr("");
    if (!date) { setErr("Date is required"); return; }
    const weight_oz = parseWeight(lb, oz);
    const height_cm = cm.trim() ? parseFloat(cm) : null;
    if (weight_oz === null && height_cm === null) {
      setErr("Enter at least weight or height");
      return;
    }
    if (cm.trim() && (isNaN(height_cm!) || height_cm! <= 0)) {
      setErr("Invalid height");
      return;
    }
    setSaving(true);
    try {
      const url    = initial ? `/api/baby/growth/${initial.id}` : "/api/baby/growth";
      const method = initial ? "PATCH" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ measured_on: date, weight_oz, height_cm, notes }),
      });
      if (!res.ok) { setErr("Failed to save"); return; }
      const json = await res.json();
      onSave(json.measurement);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-sm bg-slate-800 border border-slate-700/60 rounded-2xl shadow-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">
            {initial ? "Edit measurement" : "Add measurement"}
          </h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/60"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Weight (optional)</label>
            <div className="flex gap-2 items-center">
              <input
                type="number" min="0" max="30" placeholder="0"
                value={lb}
                onChange={(e) => setLb(e.target.value)}
                className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/60 text-center"
              />
              <span className="text-xs text-slate-400">lb</span>
              <input
                type="number" min="0" max="15" placeholder="0"
                value={oz}
                onChange={(e) => setOz(e.target.value)}
                className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/60 text-center"
              />
              <span className="text-xs text-slate-400">oz</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Height (optional)</label>
            <div className="flex gap-2 items-center">
              <input
                type="number" min="0" max="150" step="0.1" placeholder="0.0"
                value={cm}
                onChange={(e) => setCm(e.target.value)}
                className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/60 text-center"
              />
              <span className="text-xs text-slate-400">cm</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Notes (optional)</label>
            <input
              type="text"
              placeholder="e.g. 2-month checkup"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/60"
            />
          </div>

          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm text-slate-400 bg-slate-700/50 hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-violet-500/30 border border-violet-500/40 hover:bg-violet-500/40 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Profile setup modal ----------------------------------------------------

function ProfileModal({
  current,
  onClose,
  onSave,
}: {
  current: BabyProfile | null;
  onClose: () => void;
  onSave: (p: BabyProfile) => void;
}) {
  const [dob,    setDob]    = useState(current?.date_of_birth ?? "");
  const [sex,    setSex]    = useState<"male" | "female" | "">(current?.sex ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!dob || !sex) return;
    setSaving(true);
    try {
      const res = await fetch("/api/baby/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ date_of_birth: dob, sex }),
      });
      if (res.ok) {
        const json = await res.json();
        onSave(json.profile);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-sm bg-slate-800 border border-slate-700/60 rounded-2xl shadow-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-white">Baby profile</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">Needed for WHO percentiles. Stored shared between both parents.</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Date of birth</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500/60"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Sex</label>
            <div className="flex gap-2">
              {(["male", "female"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSex(s)}
                  className={`flex-1 py-2 rounded-xl text-sm transition-colors ${
                    sex === s
                      ? "bg-violet-500/30 border border-violet-500/50 text-violet-300"
                      : "bg-slate-700/50 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {s === "male" ? "Boy" : "Girl"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm text-slate-400 bg-slate-700/50 hover:bg-slate-700 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dob || !sex}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-violet-500/30 border border-violet-500/40 hover:bg-violet-500/40 transition-colors disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Main component ---------------------------------------------------------

export default function GrowthTracker() {
  const [measurements, setMeasurements] = useState<GrowthMeasurement[]>([]);
  const [profile,      setProfile]      = useState<BabyProfile | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [editing,      setEditing]      = useState<GrowthMeasurement | null>(null);
  const [showHistory,  setShowHistory]  = useState(false);
  const [showCurves,   setShowCurves]   = useState(false);
  const [showProfile,  setShowProfile]  = useState(false);
  const [confirmDel,   setConfirmDel]   = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [profRes, measRes] = await Promise.all([
      fetch("/api/baby/profile"),
      fetch("/api/baby/growth"),
    ]);
    const [pj, mj] = await Promise.all([profRes.json(), measRes.json()]);
    setProfile(pj.profile ?? null);
    setMeasurements(mj.measurements ?? []);
    setLoading(false);
  }

  function handleSaved(m: GrowthMeasurement) {
    if (editing) {
      setMeasurements((prev) => prev.map((x) => x.id === m.id ? m : x)
        .sort((a, b) => b.measured_on.localeCompare(a.measured_on)));
    } else {
      setMeasurements((prev) =>
        [m, ...prev].sort((a, b) => b.measured_on.localeCompare(a.measured_on)));
    }
    setShowForm(false);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/baby/growth/${id}`, { method: "DELETE" });
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
    setConfirmDel(null);
  }

  const latest = measurements[0] ?? null;
  const canShowPercentiles = SHOW_PERCENTILES && !!profile?.date_of_birth && !!profile?.sex;

  const latestPct = useMemo(() => {
    if (!canShowPercentiles || !latest) return null;
    return calcPercentiles(
      profile!.sex!,
      profile!.date_of_birth!,
      latest.measured_on,
      latest.weight_oz,
      latest.height_cm,
    );
  }, [canShowPercentiles, latest, profile]);

  // Sparkline data (chronological order for charts)
  const chronological = [...measurements].sort((a, b) => a.measured_on.localeCompare(b.measured_on));
  const weightPoints  = chronological.filter((m) => m.weight_oz != null).map((m) => m.weight_oz! * 0.0283495);
  const heightPoints  = chronological.filter((m) => m.height_cm != null).map((m) => Number(m.height_cm));

  const needsProfile = SHOW_PERCENTILES && (!profile?.date_of_birth || !profile?.sex);

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-violet-500/15 border border-violet-500/30">
              <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <h2 className="text-sm font-bold text-white">Growth</h2>
          </div>
          <div className="flex items-center gap-2">
            {SHOW_PERCENTILES && measurements.length > 0 && (
              <button
                onClick={() => setShowCurves((v) => !v)}
                className="text-[11px] text-slate-400 hover:text-violet-400 transition-colors"
              >
                {showCurves ? "Hide curves" : "Growth curves"}
              </button>
            )}
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="flex items-center gap-1 text-xs text-violet-400 bg-violet-500/15 border border-violet-500/25 px-2.5 py-1.5 rounded-xl hover:bg-violet-500/25 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>

        {/* Profile setup prompt */}
        {!loading && needsProfile && measurements.length > 0 && (
          <button
            onClick={() => setShowProfile(true)}
            className="w-full text-left text-xs text-slate-500 bg-slate-700/30 rounded-xl px-3 py-2 hover:bg-slate-700/50 transition-colors mb-3"
          >
            Set up baby profile (DOB + sex) to see WHO percentiles →
          </button>
        )}

        {/* Loading */}
        {loading && <div className="h-16 rounded-xl bg-slate-700/30 animate-pulse" />}

        {/* Empty state */}
        {!loading && measurements.length === 0 && (
          <p className="text-xs text-slate-500 text-center py-4">
            No measurements yet.{" "}
            <button onClick={() => setShowForm(true)} className="text-violet-400 hover:underline">
              Add the first one.
            </button>
          </p>
        )}

        {/* Latest measurement card */}
        {latest && (
          <div className="bg-slate-900/50 rounded-xl p-3">
            <p className="text-[10px] text-slate-500 mb-1.5">{fmtDate(latest.measured_on)}</p>
            <div className="flex gap-4 items-end flex-wrap">
              {latest.weight_oz != null && (
                <div>
                  <p className="text-xl font-extrabold text-white tabular-nums leading-none">
                    {ozToDisplay(latest.weight_oz)}
                  </p>
                  {latestPct?.weight != null && (
                    <div className="mt-0.5">
                      <PctBadge p={latestPct.weight} label="Weight" />
                    </div>
                  )}
                </div>
              )}
              {latest.height_cm != null && (
                <div>
                  <p className="text-xl font-extrabold text-slate-200 tabular-nums leading-none">
                    {Number(latest.height_cm).toFixed(1)} cm
                  </p>
                  {latestPct?.height != null && (
                    <div className="mt-0.5">
                      <PctBadge p={latestPct.height} label="Height" />
                    </div>
                  )}
                </div>
              )}
            </div>
            {latest.notes && (
              <p className="text-[10px] text-slate-500 mt-1.5 italic">{latest.notes}</p>
            )}
          </div>
        )}

        {/* Sparklines */}
        {(weightPoints.length >= 2 || heightPoints.length >= 2) && (
          <div className="flex gap-4 justify-center mt-3">
            {weightPoints.length >= 2 && (
              <GrowthSparkline values={weightPoints} color="#a78bfa" label="Weight trend" />
            )}
            {heightPoints.length >= 2 && (
              <GrowthSparkline values={heightPoints} color="#34d399" label="Height trend" />
            )}
          </div>
        )}

        {/* Growth curves */}
        {showCurves && canShowPercentiles && (
          <div className="mt-3 space-y-3">
            <p className="text-[10px] text-slate-500 text-center">
              WHO Child Growth Standards · For reference only — consult your pediatrician
            </p>
            <div>
              <p className="text-[10px] text-slate-400 mb-1 font-medium">Weight-for-age</p>
              <GrowthCurveChart
                sex={profile!.sex!}
                metric="weight"
                measurements={measurements}
                dob={profile!.date_of_birth!}
              />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-1 font-medium">Height-for-age</p>
              <GrowthCurveChart
                sex={profile!.sex!}
                metric="height"
                measurements={measurements}
                dob={profile!.date_of_birth!}
              />
            </div>
            <div className="flex gap-3 text-[9px] text-slate-600 justify-center flex-wrap">
              <span className="text-red-400/60">— P3 / P97</span>
              <span className="text-amber-400/60">— P15 / P85</span>
              <span className="text-emerald-400/70">— P50</span>
              <span><span className="text-indigo-400">●</span> Baby</span>
            </div>
          </div>
        )}

        {/* History toggle */}
        {measurements.length > 1 && (
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="w-full flex items-center justify-between mt-3 px-1 text-xs text-slate-400 hover:text-slate-300 transition-colors"
          >
            <span>History ({measurements.length})</span>
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* History list */}
        {showHistory && (
          <div className="mt-2 space-y-1">
            {measurements.map((m, i) => {
              const prev = measurements[i + 1] ?? null;
              const pct  = canShowPercentiles
                ? calcPercentiles(profile!.sex!, profile!.date_of_birth!, m.measured_on, m.weight_oz, m.height_cm)
                : null;

              return (
                <div key={m.id}>
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-700/30 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-500">{fmtDate(m.measured_on)}</p>
                      <div className="flex gap-2 items-baseline flex-wrap">
                        {m.weight_oz != null && (
                          <span className="text-xs text-white font-medium">
                            {ozToDisplay(m.weight_oz)}
                            {pct?.weight != null && (
                              <span className="text-[9px] text-slate-500 ml-1">P{pct.weight}</span>
                            )}
                          </span>
                        )}
                        {m.height_cm != null && (
                          <span className="text-xs text-slate-300">
                            {Number(m.height_cm).toFixed(1)} cm
                            {pct?.height != null && (
                              <span className="text-[9px] text-slate-500 ml-1">P{pct.height}</span>
                            )}
                          </span>
                        )}
                      </div>
                      {prev && (
                        <p className="text-[9px] text-slate-600">
                          {m.weight_oz != null && prev.weight_oz != null && weightDiff(m.weight_oz, prev.weight_oz) + " "}
                          {m.height_cm != null && prev.height_cm != null && heightDiff(Number(m.height_cm), Number(prev.height_cm))}
                          {(m.weight_oz != null && prev.weight_oz != null) || (m.height_cm != null && prev.height_cm != null)
                            ? " since last"
                            : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditing(m); setShowForm(true); }}
                        className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setConfirmDel(m.id)}
                        className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-red-400 hover:bg-slate-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {confirmDel === m.id && (
                    <div className="flex items-center justify-between px-2 py-1.5 bg-slate-700/30 rounded-lg">
                      <p className="text-xs text-red-400">Delete this measurement?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmDel(null)} className="text-xs text-slate-400 hover:text-slate-300 px-2 py-1 rounded hover:bg-slate-700">
                          Cancel
                        </button>
                        <button onClick={() => handleDelete(m.id)} className="text-xs text-red-400 bg-red-500/20 hover:bg-red-500/30 px-2 py-1 rounded">
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <MeasurementModal
          initial={editing ?? undefined}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={handleSaved}
        />
      )}
      {showProfile && (
        <ProfileModal
          current={profile}
          onClose={() => setShowProfile(false)}
          onSave={(p) => { setProfile(p); setShowProfile(false); }}
        />
      )}
    </div>
  );
}
