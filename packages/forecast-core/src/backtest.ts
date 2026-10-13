import { rescaleQuantiles } from './ensemble';
import { KNOWN_AHEAD_SIGNALS } from './features';
import { addWeeks, compareWeeks, seasonOf, weekOfDate, weekRange } from './isoweek';
import { summarize, weightedIntervalScore } from './metrics';
import { seriesGet, truncateSeries } from './series';
import type { AvailabilityLags, Forecaster, ForecasterFactory, Horizon, IsoWeek, MetricSummary, QuantileSet, RegionData } from './types';
import { HORIZONS } from './types';

/** Wave phase of the actual series around the target week. */
export type WavePhase = 'low' | 'rise' | 'peak' | 'decline';

export interface BacktestRecord {
  model: string;
  region: string;
  origin: IsoWeek;
  season: string;
  forecast: QuantileSet;
  actual: number;
  phase: WavePhase;
}

/**
 * Restrict data to what was known at `origin`: the target ends at `origin`
 * (published without lag), every signal ends at `origin - lag` (default lag 0),
 * known-ahead signals (calendar) stay complete.
 */
export function truncateRegionData(data: RegionData, origin: IsoWeek, lags: AvailabilityLags = {}): RegionData {
  const signals: RegionData['signals'] = {};
  for (const [k, s] of Object.entries(data.signals)) {
    signals[k] = KNOWN_AHEAD_SIGNALS.includes(k) ? s : truncateSeries(s, addWeeks(origin, -(lags[k] ?? 0)));
  }
  return { region: data.region, target: truncateSeries(data.target, addWeeks(origin, -(lags['target'] ?? 0))), signals };
}

export interface BacktestConfig {
  /** Final ("truth") data per region, used for actuals and (by default) as input. */
  truth: RegionData[];
  /**
   * Data as it was known at the origin. Default: `truth` truncated by lags
   * (optimistic: ignores later revisions). Supply real vintages when available.
   */
  dataAtOrigin?: (origin: IsoWeek) => RegionData[];
  lags?: AvailabilityLags;
  origins: IsoWeek[];
  horizons?: readonly Horizon[];
  models: (Forecaster | ForecasterFactory)[];
  /** Regions for which results are recorded (training uses all regions). */
  evaluateRegions: string[];
  /** Weeks excluded from evaluation (e.g. pandemic). */
  excludeWeek?: (week: IsoWeek) => boolean;
  /**
   * Refit learned models only at every n-th origin and reuse the fitted model in
   * between (coefficients then lag behind by up to n-1 weeks, but never see the
   * future). Default 1 = refit at every origin.
   */
  refitEvery?: number;
  onProgress?: (done: number, total: number) => void;
}

/** Rolling-origin evaluation. Records only origins where every model produced a forecast. */
export function runBacktest(cfg: BacktestConfig): BacktestRecord[] {
  const horizons = cfg.horizons ?? HORIZONS;
  const truthBy = new Map(cfg.truth.map((d) => [d.region, d]));
  const records: BacktestRecord[] = [];
  const every = Math.max(1, cfg.refitEvery ?? 1);
  let fitted: Forecaster[] = [];
  for (const [oi, origin] of cfg.origins.entries()) {
    cfg.onProgress?.(oi, cfg.origins.length);
    const known = cfg.dataAtOrigin ? cfg.dataAtOrigin(origin) : cfg.truth.map((d) => truncateRegionData(d, origin, cfg.lags));
    if (oi % every === 0 || fitted.length === 0) fitted = cfg.models.map((m) => ('fit' in m ? m.fit(known, origin) : m));
    for (const region of cfg.evaluateRegions) {
      const data = known.find((d) => d.region === region);
      const truth = truthBy.get(region);
      if (!data || !truth) continue;
      const perModel = fitted.map((f) => f.forecast(data, origin, horizons));
      if (perModel.some((p) => p === null)) continue;
      perModel.forEach((fc, mi) => {
        for (const f of fc!) {
          const actual = seriesGet(truth.target, f.iso_week);
          if (actual === null || cfg.excludeWeek?.(f.iso_week)) continue;
          records.push({
            model: fitted[mi]!.name,
            region,
            origin,
            season: seasonOf(f.iso_week),
            forecast: f,
            actual,
            phase: wavePhase(truth, f.iso_week),
          });
        }
      });
    }
  }
  return records;
}

/**
 * Phase of a target week from the (final) series itself: "low" below 30 % of the
 * season maximum, "peak" at >= 85 % of it, otherwise "rise" if the 3-week
 * centred mean is increasing and "decline" if not.
 */
export function wavePhase(truth: RegionData, week: IsoWeek): WavePhase {
  const season = seasonOf(week);
  const [y0] = season.split('/').map(Number) as [number, number];
  const weeks = weekRange(`${y0}-W40`, addWeeks(`${y0 + 1}-W40`, -1));
  let max = 0;
  for (const w of weeks) max = Math.max(max, seriesGet(truth.target, w) ?? 0);
  const v = seriesGet(truth.target, week) ?? 0;
  if (max > 0 && v >= 0.85 * max) return 'peak';
  if (max > 0 && v < 0.3 * max) return 'low';
  const m = (c: IsoWeek) => {
    const xs = [-1, 0, 1].map((d) => seriesGet(truth.target, addWeeks(c, d))).filter((x): x is number => x !== null);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
  };
  return m(addWeeks(week, 1)) > m(addWeeks(week, -1)) ? 'rise' : 'decline';
}

export function summarizeRecords(records: readonly BacktestRecord[]): MetricSummary | null {
  return records.length ? summarize(records) : null;
}

/** Group records and summarise each group. */
export function summarizeBy(records: readonly BacktestRecord[], key: (r: BacktestRecord) => string): Map<string, MetricSummary> {
  const groups = new Map<string, BacktestRecord[]>();
  for (const r of records) {
    const k = key(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  return new Map([...groups].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => [k, summarize(v)]));
}

/** Small deterministic PRNG (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ModelComparison {
  /** mean WIS(candidate) - mean WIS(reference); negative = candidate better */
  meanDiff: number;
  /** relative improvement 1 - WIS_candidate / WIS_reference */
  relImprovement: number;
  ci95: [number, number];
  seasonsBetter: number;
  seasonsTotal: number;
  n: number;
}

/**
 * Compare two models on identical (region, origin, horizon) cells: mean WIS
 * difference with a block bootstrap over origin weeks (blocks of consecutive
 * origins keep the serial correlation) and the number of seasons won.
 */
export function compareModels(
  records: readonly BacktestRecord[],
  candidate: string,
  reference: string,
  opts: { blockSize?: number; nBoot?: number; seed?: number } = {},
): ModelComparison | null {
  const blockSize = opts.blockSize ?? 4;
  const nBoot = opts.nBoot ?? 1000;
  const cell = (r: BacktestRecord) => `${r.region}|${r.origin}|${r.forecast.h}`;
  const ref = new Map(records.filter((r) => r.model === reference).map((r) => [cell(r), r]));
  const pairs = records
    .filter((r) => r.model === candidate && ref.has(cell(r)))
    .map((r) => ({ origin: r.origin, season: r.season, d: weightedIntervalScore(r.forecast, r.actual) - weightedIntervalScore(ref.get(cell(r))!.forecast, r.actual), base: weightedIntervalScore(ref.get(cell(r))!.forecast, r.actual) }));
  if (pairs.length === 0) return null;
  const byOrigin = new Map<IsoWeek, { sum: number; n: number }>();
  for (const p of pairs) {
    const e = byOrigin.get(p.origin) ?? { sum: 0, n: 0 };
    e.sum += p.d;
    e.n += 1;
    byOrigin.set(p.origin, e);
  }
  const origins = [...byOrigin.keys()].sort(compareWeeks);
  const sums = origins.map((o) => byOrigin.get(o)!);
  const mean = pairs.reduce((a, p) => a + p.d, 0) / pairs.length;
  const baseMean = pairs.reduce((a, p) => a + p.base, 0) / pairs.length;
  const rng = makeRng(opts.seed ?? 20261013);
  const boots: number[] = [];
  const nBlocks = Math.max(1, Math.ceil(origins.length / blockSize));
  for (let b = 0; b < nBoot; b++) {
    let s = 0;
    let n = 0;
    for (let k = 0; k < nBlocks; k++) {
      const st = Math.floor(rng() * origins.length);
      for (let j = 0; j < blockSize; j++) {
        const e = sums[(st + j) % origins.length]!;
        s += e.sum;
        n += e.n;
      }
    }
    boots.push(s / n);
  }
  boots.sort((a, b) => a - b);
  const seasons = new Map<string, number>();
  for (const p of pairs) seasons.set(p.season, (seasons.get(p.season) ?? 0) + p.d);
  return {
    meanDiff: mean,
    relImprovement: baseMean > 0 ? -mean / baseMean : 0,
    ci95: [boots[Math.floor(0.025 * nBoot)]!, boots[Math.min(nBoot - 1, Math.floor(0.975 * nBoot))]!],
    seasonsBetter: [...seasons.values()].filter((v) => v < 0).length,
    seasonsTotal: seasons.size,
    n: pairs.length,
  };
}

export interface PeakError {
  model: string;
  region: string;
  season: string;
  h: Horizon;
  /** forecast peak week minus actual peak week, in weeks */
  timingWeeks: number;
  /** (forecast peak median - actual peak) / actual peak */
  heightRel: number;
}

/**
 * Peak timing/height error per model, region, season and horizon: the peak of the
 * median forecast series (over target weeks) versus the actual peak. Only seasons
 * with at least 20 forecast target weeks are scored.
 */
export function peakErrors(records: readonly BacktestRecord[]): PeakError[] {
  const groups = new Map<string, BacktestRecord[]>();
  for (const r of records) {
    const k = `${r.model}\u0000${r.region}\u0000${r.season}\u0000${r.forecast.h}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  const out: PeakError[] = [];
  for (const rs of groups.values()) {
    if (rs.length < 20) continue;
    const bestF = rs.reduce((a, b) => (b.forecast.q50 > a.forecast.q50 ? b : a));
    const bestA = rs.reduce((a, b) => (b.actual > a.actual ? b : a));
    const first = rs[0]!;
    out.push({
      model: first.model,
      region: first.region,
      season: first.season,
      h: first.forecast.h,
      timingWeeks: weeksDiff(bestA.forecast.iso_week, bestF.forecast.iso_week),
      heightRel: (bestF.forecast.q50 - bestA.actual) / bestA.actual,
    });
  }
  return out.sort((a, b) => a.model.localeCompare(b.model) || a.region.localeCompare(b.region) || a.season.localeCompare(b.season) || a.h - b.h);
}

function weeksDiff(a: IsoWeek, b: IsoWeek): number {
  // b - a in weeks, using lexicographic helpers only for ordering
  let n = 0;
  let w = a;
  const dir = compareWeeks(a, b) <= 0 ? 1 : -1;
  while (w !== b) {
    w = addWeeks(w, dir);
    n += dir;
  }
  return n;
}


/** Copy of the records of `model` with the band spread rescaled by k, under a new model name. */
export function rescaleRecords(records: readonly BacktestRecord[], model: string, k: number, newName: string): BacktestRecord[] {
  return records.filter((r) => r.model === model).map((r) => ({ ...r, model: newName, forecast: rescaleQuantiles(r.forecast, k) }));
}

/**
 * Quantile-average two models' records cell by cell: weight `wB` for model B, 1 - wB for model A
 * (exactly what `ensemble()` does at forecast time, but without refitting). Only cells present in both.
 */
export function blendRecords(records: readonly BacktestRecord[], modelA: string, modelB: string, wB: number, newName: string): BacktestRecord[] {
  const cell = (r: BacktestRecord) => `${r.region}|${r.origin}|${r.forecast.h}`;
  const a = new Map(records.filter((r) => r.model === modelA).map((r) => [cell(r), r]));
  const out: BacktestRecord[] = [];
  for (const rb of records) {
    if (rb.model !== modelB) continue;
    const ra = a.get(cell(rb));
    if (!ra) continue;
    const mix = (k: 'q10' | 'q25' | 'q50' | 'q75' | 'q90') => (1 - wB) * ra.forecast[k] + wB * rb.forecast[k];
    out.push({ ...rb, model: newName, forecast: { iso_week: rb.forecast.iso_week, h: rb.forecast.h, q10: mix('q10'), q25: mix('q25'), q50: mix('q50'), q75: mix('q75'), q90: mix('q90') } });
  }
  return out;
}

export interface PeakTimingSummary {
  /** number of region-season groups scored */
  n: number;
  median_abs_timing_weeks: number;
  within_one_week_share: number;
  /** mean relative error of the predicted peak height versus the actual peak height (smoothed curves) */
  mean_height_rel: number;
  /** region-seasons whose actual curve has a second peak >= 90 % of the maximum (timing is ambiguous there) */
  ambiguous: number;
}

const WINDOW_START = 45; // ISO week numbers W45..W53 and W01..W15 form the winter window
const WINDOW_END = 15;

function inWinterWindow(week: IsoWeek): boolean {
  const n = Number(week.slice(6));
  return n >= WINDOW_START || n <= WINDOW_END;
}

/** ISO week containing 28 December (week "between the years") and the week after it. */
function betweenYearsWeeks(week: IsoWeek): boolean {
  const y = Number(week.slice(0, 4));
  // The week after the week between the years lies in the next ISO year, so check this year and the one before.
  for (const year of [y, y - 1]) {
    const x = weekOfDate(new Date(Date.UTC(year, 11, 28)));
    if (week === x || week === addWeeks(x, 1)) return true;
  }
  return false;
}

/** Centred 3-week mean over the weeks that are present; the series is a map week -> value. */
function smooth3(m: Map<IsoWeek, number>): Map<IsoWeek, number> {
  const out = new Map<IsoWeek, number>();
  for (const w of m.keys()) {
    const vals = [-1, 0, 1].map((d) => m.get(addWeeks(w, d))).filter((v): v is number => v !== undefined);
    if (vals.length >= 2) out.set(w, vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  return out;
}

function argmaxWeek(m: Map<IsoWeek, number>): IsoWeek | null {
  let best: IsoWeek | null = null;
  let bv = -Infinity;
  for (const [w, v] of [...m].sort((a, b) => compareWeeks(a[0], b[0]))) {
    if (v > bv) {
      bv = v;
      best = w;
    }
  }
  return best;
}

/** True when the curve has a local maximum >= 90 % of the global maximum at least 3 weeks away from it. */
function hasSecondPeak(m: Map<IsoWeek, number>, peak: IsoWeek): boolean {
  const max = m.get(peak) ?? 0;
  for (const [w, v] of m) {
    if (Math.abs(weeksBetweenLocal(peak, w)) < 3 || v < 0.9 * max) continue;
    const l = m.get(addWeeks(w, -1));
    const r = m.get(addWeeks(w, 1));
    if ((l === undefined || v >= l) && (r === undefined || v >= r)) return true;
  }
  return false;
}

function weeksBetweenLocal(a: IsoWeek, b: IsoWeek): number {
  let n = 0;
  let w = a;
  const dir = compareWeeks(a, b) <= 0 ? 1 : -1;
  while (w !== b && Math.abs(n) < 200) {
    w = addWeeks(w, dir);
    n += dir;
  }
  return n;
}

/**
 * Peak timing per model and horizon (never pooled over horizons). For each region, season and
 * horizon: the week of the maximum of the centred 3-week mean of the median forecast versus the
 * same for the actual values, restricted to the winter window W45..W15 with the week between the
 * years and the week after it removed from both curves. Persistence scores about h weeks by
 * construction (it lags), which is the reference to compare with. Groups need >= 12 weeks.
 */
export function peakTiming(records: readonly BacktestRecord[]): Record<string, Record<string, PeakTimingSummary>> {
  type Key = string;
  const groups = new Map<Key, BacktestRecord[]>();
  for (const r of records) {
    if (!inWinterWindow(r.forecast.iso_week) || betweenYearsWeeks(r.forecast.iso_week)) continue;
    const k = `${r.model}\u0000${r.region}\u0000${r.season}\u0000${r.forecast.h}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  const errs = new Map<string, { abs: number[]; within: number; n: number; height: number[]; amb: number }>();
  for (const [k, rs] of groups) {
    if (rs.length < 12) continue;
    const [model, , , h] = k.split('\u0000') as [string, string, string, string];
    const actual = smooth3(new Map(rs.map((r) => [r.forecast.iso_week, r.actual])));
    const pred = smooth3(new Map(rs.map((r) => [r.forecast.iso_week, r.forecast.q50])));
    const pa = argmaxWeek(actual);
    const pp = argmaxWeek(pred);
    if (!pa || !pp) continue;
    const e = weeksBetweenLocal(pa, pp);
    for (const key of [`${model}\u0000all`, `${model}\u0000h${h}`]) {
      const s = errs.get(key) ?? { abs: [], within: 0, n: 0, height: [], amb: 0 };
      s.abs.push(Math.abs(e));
      s.within += Math.abs(e) <= 1 ? 1 : 0;
      s.n += 1;
      s.height.push(((pred.get(pp) ?? 0) - (actual.get(pa) ?? 1)) / (actual.get(pa) ?? 1));
      s.amb += hasSecondPeak(actual, pa) ? 1 : 0;
      errs.set(key, s);
    }
  }
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN;
  };
  const out: Record<string, Record<string, PeakTimingSummary>> = {};
  for (const [key, s] of errs) {
    const [model, scope] = key.split('\u0000') as [string, string];
    (out[model] ??= {})[scope] = {
      n: s.n,
      median_abs_timing_weeks: median(s.abs),
      within_one_week_share: s.within / s.n,
      mean_height_rel: s.height.reduce((a, b) => a + b, 0) / s.height.length,
      ambiguous: s.amb,
    };
  }
  return out;
}
