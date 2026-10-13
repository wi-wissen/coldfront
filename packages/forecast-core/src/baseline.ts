import { addWeeks, formatWeek, isoWeeksInYear, parseWeek, weeksBetween } from './isoweek';
import { seriesGet } from './series';
import type { Forecaster, Horizon, IsoWeek, QuantileSet, RegionData } from './types';

export interface BaselineOptions {
  /**
   * Weeks for which values must not be used as a sample (e.g. pandemic period).
   * Default: none.
   */
  excludeWeek?: (week: IsoWeek) => boolean;
  /** Also sample the +-windowWeeks neighbouring calendar weeks. Default 1. */
  windowWeeks?: number;
  /** Minimum number of samples; fewer -> forecast returns null. Default 2. */
  minSamples?: number;
}

/**
 * Seasonal baseline: for target week w the sample consists of the target series at
 * the same ISO week number (+- windowWeeks) of every EARLIER year, restricted to
 * weeks <= origin, non-null and not excluded. Week 53 is mapped to week 52.
 * Quantiles are empirical quantiles of the sample (linear interpolation, "type 7").
 * Name: "baseline-seasonal".
 */
export function seasonalBaseline(opts: BaselineOptions = {}): Forecaster {
  const windowWeeks = opts.windowWeeks ?? 1;
  const minSamples = opts.minSamples ?? 2;
  return {
    name: 'baseline-seasonal',
    forecast(data: RegionData, origin: IsoWeek, horizons: readonly Horizon[]): QuantileSet[] | null {
      const firstYear = parseWeek(data.target.start).year;
      const out: QuantileSet[] = [];
      for (const h of horizons) {
        const target = addWeeks(origin, h);
        const targetYear = parseWeek(target).year;
        const weekNo = Math.min(parseWeek(target).week, 52);
        const sample: number[] = [];
        for (let y = firstYear; y < targetYear; y++) {
          for (let wk = weekNo - windowWeeks; wk <= weekNo + windowWeeks; wk++) {
            if (wk < 1 || wk > isoWeeksInYear(y)) continue;
            const w = formatWeek(y, wk);
            if (weeksBetween(w, origin) < 0) continue; // never use weeks after the origin
            if (opts.excludeWeek?.(w)) continue;
            const v = seriesGet(data.target, w);
            if (v !== null) sample.push(v);
          }
        }
        if (sample.length < minSamples) return null;
        sample.sort((a, b) => a - b);
        out.push(toQuantileSet(target, h, (p) => empiricalQuantile(sample, p)));
      }
      return out;
    },
  };
}

export interface PersistenceOptions {
  excludeWeek?: (week: IsoWeek) => boolean;
  /** Minimum number of historical h-step changes; fewer -> null. Default 20. */
  minSamples?: number;
}

/**
 * Persistence ("carry the current level forward"): median-ish forecast is the last
 * observed value y_t, spread from the empirical distribution of historical
 * h-step log ratios log(y_{s+h}/y_s) over all s with s+h <= origin (both weeks
 * non-null, > 0, not excluded). Quantile = y_t * exp(empirical quantile of ratios).
 * Name: "persistence".
 */
export function persistence(opts: PersistenceOptions = {}): Forecaster {
  const minSamples = opts.minSamples ?? 20;
  return {
    name: 'persistence',
    forecast(data: RegionData, origin: IsoWeek, horizons: readonly Horizon[]): QuantileSet[] | null {
      const last = seriesGet(data.target, origin);
      if (last === null || last <= 0) return null;
      const originIdx = weeksBetween(data.target.start, origin);
      const values = data.target.values;
      const out: QuantileSet[] = [];
      for (const h of horizons) {
        const ratios: number[] = [];
        for (let s = 0; s + h <= originIdx; s++) {
          const a = values[s] ?? null;
          const b = values[s + h] ?? null;
          if (a === null || b === null || a <= 0 || b <= 0) continue;
          if (opts.excludeWeek?.(addWeeks(data.target.start, s))) continue;
          if (opts.excludeWeek?.(addWeeks(data.target.start, s + h))) continue;
          ratios.push(Math.log(b / a));
        }
        if (ratios.length < minSamples) return null;
        ratios.sort((p, q) => p - q);
        out.push(toQuantileSet(addWeeks(origin, h), h, (p) => last * Math.exp(empiricalQuantile(ratios, p))));
      }
      return out;
    },
  };
}

/** Empirical quantile, linear interpolation between order statistics ("type 7"). */
export function empiricalQuantile(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) throw new Error('empiricalQuantile: empty sample');
  const pos = p * (n - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, n - 1);
  return sorted[lo]! + (pos - lo) * (sorted[hi]! - sorted[lo]!);
}

/** Build a QuantileSet at the standard levels from a quantile function. */
function toQuantileSet(iso_week: IsoWeek, h: Horizon, q: (p: number) => number): QuantileSet {
  return { iso_week, h, q10: q(0.1), q25: q(0.25), q50: q(0.5), q75: q(0.75), q90: q(0.9) };
}
