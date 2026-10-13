import type { MetricSummary, QuantileSet } from './types';

/** Make quantiles non-decreasing by sorting (fixes quantile crossing). */
export function sortQuantiles(f: QuantileSet): QuantileSet {
  const [q10, q25, q50, q75, q90] = [f.q10, f.q25, f.q50, f.q75, f.q90].sort((a, b) => a - b);
  return { ...f, q10: q10!, q25: q25!, q50: q50!, q75: q75!, q90: q90! };
}

/** Absolute error of the median forecast. */
export function absoluteError(f: QuantileSet, actual: number): number {
  return Math.abs(f.q50 - actual);
}

/** Interval score for the central interval [l, u] at level alpha. */
function intervalScore(l: number, u: number, alpha: number, y: number): number {
  return (u - l) + (2 / alpha) * Math.max(l - y, 0) + (2 / alpha) * Math.max(y - u, 0);
}

/**
 * Weighted Interval Score (Bracher et al. 2021) over the intervals
 * (q10,q90) with alpha=0.2 and (q25,q75) with alpha=0.5 plus the median:
 * WIS = (0.5*|y-m| + sum_k (alpha_k/2) * IS_alpha_k) / (K + 0.5), K=2,
 * IS_alpha = (u-l) + (2/alpha)*max(l-y,0) + (2/alpha)*max(y-u,0).
 */
export function weightedIntervalScore(f: QuantileSet, actual: number): number {
  const K = 2;
  const is20 = intervalScore(f.q10, f.q90, 0.2, actual);
  const is50 = intervalScore(f.q25, f.q75, 0.5, actual);
  return (0.5 * Math.abs(actual - f.q50) + (0.2 / 2) * is20 + (0.5 / 2) * is50) / (K + 0.5);
}

export interface ScoredForecast {
  forecast: QuantileSet;
  actual: number;
}

/** Mean of the metrics over all pairs. Throws on an empty list. */
export function summarize(pairs: readonly ScoredForecast[]): MetricSummary {
  if (pairs.length === 0) throw new Error('summarize: no forecasts');
  let mae = 0;
  let wis = 0;
  let in50 = 0;
  let in80 = 0;
  for (const { forecast: f, actual } of pairs) {
    mae += absoluteError(f, actual);
    wis += weightedIntervalScore(f, actual);
    if (actual >= f.q25 && actual <= f.q75) in50++;
    if (actual >= f.q10 && actual <= f.q90) in80++;
  }
  const n = pairs.length;
  return { n, mae: mae / n, wis: wis / n, coverage50: in50 / n, coverage80: in80 / n };
}
