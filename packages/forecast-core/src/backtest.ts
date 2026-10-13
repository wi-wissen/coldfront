import { KNOWN_AHEAD_SIGNALS } from './features';
import { addWeeks, compareWeeks, seasonOf, weekRange } from './isoweek';
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
}

/** Rolling-origin evaluation. Records only origins where every model produced a forecast. */
export function runBacktest(cfg: BacktestConfig): BacktestRecord[] {
  const horizons = cfg.horizons ?? HORIZONS;
  const truthBy = new Map(cfg.truth.map((d) => [d.region, d]));
  const records: BacktestRecord[] = [];
  for (const origin of cfg.origins) {
    const known = cfg.dataAtOrigin ? cfg.dataAtOrigin(origin) : cfg.truth.map((d) => truncateRegionData(d, origin, cfg.lags));
    const fitted = cfg.models.map((m) => ('fit' in m ? m.fit(known, origin) : m));
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

