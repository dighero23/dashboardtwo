import weightBoysData from "./weight-boys.json";
import weightGirlsData from "./weight-girls.json";
import heightBoysData from "./height-boys.json";
import heightGirlsData from "./height-girls.json";

interface LMSRow { m: number; L: number; M: number; S: number }

const tables = {
  "male-weight":   weightBoysData  as LMSRow[],
  "female-weight": weightGirlsData as LMSRow[],
  "male-height":   heightBoysData  as LMSRow[],
  "female-height": heightGirlsData as LMSRow[],
};

export function ageInMonths(dob: string, measDate: string): number {
  const d1 = new Date(dob);
  const d2 = new Date(measDate);
  const months =
    (d2.getFullYear() - d1.getFullYear()) * 12 +
    (d2.getMonth() - d1.getMonth());
  const dayOffset = d2.getDate() >= d1.getDate() ? 0 : -1;
  return Math.max(0, Math.min(60, months + dayOffset));
}

function lmsAt(table: LMSRow[], month: number): LMSRow | null {
  const clamped = Math.max(0, Math.min(60, Math.round(month)));
  return table.find((r) => r.m === clamped) ?? null;
}

function zscore(X: number, L: number, M: number, S: number): number {
  if (Math.abs(L) < 1e-4) return Math.log(X / M) / S;
  return (Math.pow(X / M, L) - 1) / (L * S);
}

// Abramowitz & Stegun approximation — max error 1.5e-7
function normCDF(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly =
    t * (0.254829592 +
    t * (-0.284496736 +
    t * (1.421413741 +
    t * (-1.453152027 +
    t * 1.061405429))));
  return 0.5 * (1 + sign * (1 - poly * Math.exp(-x * x)));
}

// Inverse: value at percentile p (0-100) given LMS params
export function lmsPercentileValue(L: number, M: number, S: number, p: number): number {
  // z for the given percentile via inverse normal
  const z = inverseNorm(p / 100);
  if (Math.abs(L) < 1e-4) return M * Math.exp(S * z);
  return M * Math.pow(1 + L * S * z, 1 / L);
}

// Rational approximation of inverse normal (Beasley-Springer-Moro)
function inverseNorm(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p < 0.5) return -rationalApprox(Math.sqrt(-2 * Math.log(p)));
  return rationalApprox(Math.sqrt(-2 * Math.log(1 - p)));
}

function rationalApprox(t: number): number {
  const c = [2.515517, 0.802853, 0.010328];
  const d = [1.432788, 0.189269, 0.001308];
  return t - (c[0] + c[1] * t + c[2] * t * t) / (1 + d[0] * t + d[1] * t * t + d[2] * t * t * t);
}

export interface PercentileResult {
  weight: number | null;
  height: number | null;
}

export function calcPercentiles(
  sex: "male" | "female",
  dob: string,
  measDate: string,
  weightOz: number | null,
  heightCm: number | null,
): PercentileResult {
  const months = ageInMonths(dob, measDate);
  let weight: number | null = null;
  let height: number | null = null;

  if (weightOz != null) {
    const row = lmsAt(tables[`${sex}-weight`], months);
    if (row) {
      const kg = weightOz * 0.0283495;
      const z = zscore(kg, row.L, row.M, row.S);
      weight = Math.max(1, Math.min(99, Math.round(normCDF(z) * 100)));
    }
  }

  if (heightCm != null) {
    const row = lmsAt(tables[`${sex}-height`], months);
    if (row) {
      const z = zscore(heightCm, row.L, row.M, row.S);
      height = Math.max(1, Math.min(99, Math.round(normCDF(z) * 100)));
    }
  }

  return { weight, height };
}

// Get the M value (median) at a given month and metric for curves
export function whoMedian(
  sex: "male" | "female",
  metric: "weight" | "height",
  month: number,
): number | null {
  return lmsAt(tables[`${sex}-${metric}`], month)?.M ?? null;
}

// Compute the curve value (Y) for a given percentile at a specific month
export function whoCurvePoint(
  sex: "male" | "female",
  metric: "weight" | "height",
  month: number,
  percentile: number,
): number | null {
  const row = lmsAt(tables[`${sex}-${metric}`], month);
  if (!row) return null;
  return lmsPercentileValue(row.L, row.M, row.S, percentile);
}
