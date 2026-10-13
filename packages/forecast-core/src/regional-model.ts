import { buildFeatureRow, featureNames, logTarget, type FeatureGroup } from './features';
import { addWeeks, compareWeeks, weeksBetween } from './isoweek';
import { fitQuantileRegression, predictLinear } from './quantile-regression';
import { QUANTILE_LEVELS, HORIZONS, type Forecaster, type ForecasterFactory, type Horizon, type IsoWeek, type QuantileSet, type RegionData } from './types';

export interface RegionalModelConfig {
  name: string;
  featureGroups: readonly FeatureGroup[];
  /** Ridge penalty on standardised features. Start value 1 (no evidence). */
  ridge: number;
  /** Minimum number of training rows per horizon, else the model cannot predict. */
  minTrainRows: number;
  /** Weeks whose target/origin must not enter training (e.g. pandemic period). */
  excludeWeek?: (week: IsoWeek) => boolean;
  /** Max IRLS iterations (speed vs. precision in the backtest). */
  maxIter?: number;
  /** Multiplies the spread around the median. Calibrated on tuning seasons only. */
  spreadFactor?: number;
}

interface Fitted {
  mean: number[];
  sd: number[];
  /** coef[h][qIndex] over [1, standardised features...] */
  coef: Map<Horizon, number[][]>;
}

function standardise(row: number[], mean: number[], sd: number[]): number[] {
  return [1, ...row.map((v, j) => (Number.isFinite(v) ? (v - mean[j]!) / sd[j]! : 0))];
}

/**
 * Pooled (all regions) linear quantile regression of the h-week log growth of the
 * target. One model per horizon and quantile level; features standardised with the
 * training mean/sd, missing optional features imputed with the training mean.
 */
export function regionalQuantileModel(cfg: RegionalModelConfig): ForecasterFactory {
  const groups = cfg.featureGroups;
  const nFeat = featureNames(groups).length;
  return {
    name: cfg.name,
    fit(training: RegionData[], origin: IsoWeek): Forecaster {
      const fitted = trainAll(training, origin, cfg, groups, nFeat);
      return {
        name: cfg.name,
        forecast(data, o, horizons): QuantileSet[] | null {
          if (!fitted) return null;
          const ly0 = logTarget(data, o);
          if (ly0 === null) return null;
          const out: QuantileSet[] = [];
          for (const h of horizons) {
            const coefs = fitted.coef.get(h);
            const row = buildFeatureRow(data, o, h, groups);
            if (!coefs || !row) return null;
            const x = standardise(row, fitted.mean, fitted.sd);
            const z = coefs.map((c) => predictLinear(c, x)).sort((a, b) => a - b);
            const med = z[2]!;
            const k = cfg.spreadFactor ?? 1;
            const v = z.map((q) => Math.exp(ly0 + med + (q - med) * k));
            out.push({ iso_week: addWeeks(o, h), h, q10: v[0]!, q25: v[1]!, q50: v[2]!, q75: v[3]!, q90: v[4]! });
          }
          return out;
        },
      };
    },
  };
}

function trainAll(
  training: RegionData[],
  origin: IsoWeek,
  cfg: RegionalModelConfig,
  groups: readonly FeatureGroup[],
  nFeat: number,
): Fitted | null {
  const perH = new Map<Horizon, { rows: number[][]; y: number[] }>();
  for (const h of HORIZONS) perH.set(h, { rows: [], y: [] });
  for (const data of training) {
    const start = addWeeks(data.target.start, 2);
    const n = weeksBetween(start, origin);
    for (let i = 0; i <= n; i++) {
      const s = addWeeks(start, i);
      if (cfg.excludeWeek?.(s)) continue;
      const view = viewUntil(data, s);
      for (const h of HORIZONS) {
        const t = addWeeks(s, h);
        if (compareWeeks(t, origin) > 0 || cfg.excludeWeek?.(t)) continue;
        const ly0 = logTarget(data, s);
        const lyT = logTarget(data, t);
        if (ly0 === null || lyT === null) continue;
        // Features must only see data up to s: the caller truncated at `origin`,
        // so build the row on a view that ends at s.
        const row = buildFeatureRow(view, s, h, groups);
        if (!row) continue;
        const b = perH.get(h)!;
        b.rows.push(row);
        b.y.push(lyT - ly0);
      }
    }
  }
  const all = perH.get(1)!.rows;
  if (all.length < cfg.minTrainRows) return null;
  // Standardisation statistics from horizon 1 rows (same features across horizons except season/holiday).
  const mean = new Array<number>(nFeat).fill(0);
  const sd = new Array<number>(nFeat).fill(1);
  for (let j = 0; j < nFeat; j++) {
    const vals = all.map((r) => r[j]!).filter(Number.isFinite);
    if (vals.length === 0) continue;
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    const v = vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length;
    mean[j] = m;
    sd[j] = Math.sqrt(v) > 1e-9 ? Math.sqrt(v) : 1;
  }
  const coef = new Map<Horizon, number[][]>();
  for (const h of HORIZONS) {
    const b = perH.get(h)!;
    if (b.rows.length < cfg.minTrainRows) return null;
    const X = b.rows.map((r) => standardise(r, mean, sd));
    coef.set(
      h,
      QUANTILE_LEVELS.map((tau) => fitQuantileRegression(X, b.y, tau, { ridge: cfg.ridge, maxIter: cfg.maxIter ?? 60, tol: 1e-7 })),
    );
  }
  return { mean, sd, coef };
}

/** View of the data in which no series extends beyond `week` (known-ahead signals stay). */
function viewUntil(data: RegionData, week: IsoWeek): RegionData {
  const cut = (s: { start: IsoWeek; values: (number | null)[] }) => {
    const n = weeksBetween(s.start, week) + 1;
    return { start: s.start, values: n <= 0 ? [] : s.values.slice(0, n) };
  };
  const signals: RegionData['signals'] = {};
  for (const [k, s] of Object.entries(data.signals)) signals[k] = k === 'holiday' ? s : cut(s);
  return { region: data.region, target: cut(data.target), signals };
}
