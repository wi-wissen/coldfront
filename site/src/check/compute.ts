import {
  runTest,
  summarizeBy,
  type BacktestRecord,
  type EvalConfig,
  type Horizon,
  type MetricSummary,
  type ModelChoice,
  type SeriesExport,
  regionDataFromExport,
} from '@coldfront/forecast-core';
import type { BacktestChartPoint } from '@coldfront/charts';

/** Refit interval of the learned model in the browser (origins between refits). */
export const REFIT_EVERY = 4;

export const SHIPPED_MODEL = 'ensemble';
export const BASELINE_MODEL = 'baseline-seasonal';

export interface CheckResult {
  region: string;
  season: string;
  horizon: Horizon;
  /** model names in the order of the protocol */
  models: string[];
  /** metrics per model for the selected region and horizon */
  metrics: Record<string, MetricSummary>;
  /** 1 - WIS(ensemble) / WIS(baseline); positive = ensemble better; null if not computable */
  improvementVsBaseline: number | null;
  /** per scored target week of the shipped model (ensemble) */
  chart: BacktestChartPoint[];
  /** wall-clock time of the computation in milliseconds (not deterministic) */
  computeMs: number;
  refitEvery: number;
}

/**
 * Recomputes the rolling-origin evaluation of one region and season with the shared
 * protocol code (`runTest`), then keeps the scored records of one horizon.
 * Pure apart from the optional progress callback and the timer.
 */
export function computeCheck(
  series: SeriesExport,
  cfg: EvalConfig,
  choice: ModelChoice,
  region: string,
  season: string,
  horizon: Horizon,
  onProgress?: (done: number, total: number) => void,
  refitEvery: number = REFIT_EVERY,
): CheckResult {
  const t0 = performance.now();
  let records: BacktestRecord[] = [];
  const result = runTest(regionDataFromExport(series), cfg, choice, {
    season,
    evaluateRegions: [region],
    refitEvery,
    onProgress,
    onRecords: (recs) => {
      records = recs;
    },
  });
  const rows = records.filter((r) => r.region === region && r.forecast.h === horizon);
  const byModel = summarizeBy(rows, (r) => r.model);
  const metrics: Record<string, MetricSummary> = {};
  for (const [model, summary] of byModel) metrics[model] = summary;
  const ens = metrics[SHIPPED_MODEL];
  const base = metrics[BASELINE_MODEL];
  const improvement = ens && base && base.wis > 0 ? 1 - ens.wis / base.wis : null;
  const chart: BacktestChartPoint[] = rows
    .filter((r) => r.model === SHIPPED_MODEL)
    .sort((a, b) => (a.forecast.iso_week < b.forecast.iso_week ? -1 : a.forecast.iso_week > b.forecast.iso_week ? 1 : 0))
    .map((r) => ({
      iso_week: r.forecast.iso_week,
      actual: r.actual,
      q10: r.forecast.q10,
      q25: r.forecast.q25,
      q50: r.forecast.q50,
      q75: r.forecast.q75,
      q90: r.forecast.q90,
    }));
  return {
    region,
    season,
    horizon,
    models: result.models,
    metrics,
    improvementVsBaseline: improvement,
    chart,
    computeMs: performance.now() - t0,
    refitEvery,
  };
}
