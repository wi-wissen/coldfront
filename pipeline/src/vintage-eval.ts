import {
  addWeeks, buildBaseline, buildChosenEnsemble, buildPersistence, compareModels, compareWeeks, isPandemicWeek, rescaleRecords, runBacktest,
  seasonOf, seasonWeeks, summarizeBy, truncateRegionData, weekRange, weeksBetween, HORIZONS,
  type BacktestRecord, type EvalConfig, type IsoWeek, type LongRow, type MetricSummary, type ModelChoice, type ModelComparison,
  type RegionData, type WeeklySeries,
} from '@coldfront/forecast-core';

/** Target series of the ARE table. */
export const ARE_TARGET_SERIES = '00+';

const keyOf = (region: string, series: string, week: IsoWeek) => `${region}\u0000${series}\u0000${week}`;

/** First as_of at which the (region, series, week) value exists, or null if it never appears. */
export function availabilityDate(rows: readonly LongRow[], region: string, series: string, week: IsoWeek): string | null {
  let best: string | null = null;
  for (const r of rows) {
    if (r.region === region && r.series === series && r.week === week && (best === null || r.as_of < best)) best = r.as_of;
  }
  return best;
}

/** Per-key list of value versions sorted by as_of, for fast "value at date" lookups. */
export class VintageIndex {
  private readonly byKey = new Map<string, { as_of: string; value: number }[]>();
  constructor(rows: readonly LongRow[]) {
    for (const r of rows) {
      const k = keyOf(r.region, r.series, r.week);
      let list = this.byKey.get(k);
      if (!list) this.byKey.set(k, (list = []));
      list.push({ as_of: r.as_of, value: r.value });
    }
    // Stable sort: rows sharing an as_of keep file order, the last one wins in valueAt (like snapshotAt).
    for (const list of this.byKey.values()) list.sort((a, b) => (a.as_of < b.as_of ? -1 : a.as_of > b.as_of ? 1 : 0));
  }
  /** Value as known at `asOf` (latest as_of <= asOf), or null. Equivalent to snapshotAt for one key. */
  valueAt(region: string, series: string, week: IsoWeek, asOf: string): number | null {
    const list = this.byKey.get(keyOf(region, series, week));
    if (!list) return null;
    let v: number | null = null;
    for (const e of list) {
      if (e.as_of > asOf) break;
      v = e.value;
    }
    return v;
  }
  /** First as_of of the key, or null. */
  firstSeen(region: string, series: string, week: IsoWeek): string | null {
    return this.byKey.get(keyOf(region, series, week))?.[0]?.as_of ?? null;
  }
}

/**
 * Data of one region as known on `asOf`: the target series is rebuilt from the
 * ARE versions (weeks up to `origin - targetLag`); every signal is taken from the
 * final data, truncated with the configured availability lags.
 * Wastewater (and weather) revisions are NOT reproduced: those signals come from
 * today's corrected tables. Returns null if the region has no target value at asOf.
 */
export function regionDataAtOrigin(index: VintageIndex, finalData: RegionData, asOf: string, origin: IsoWeek, cfg: EvalConfig): RegionData | null {
  const truncated = truncateRegionData(finalData, origin, cfg.availability_lags_weeks);
  const last = addWeeks(origin, -(cfg.availability_lags_weeks['target'] ?? 0));
  const start = finalData.target.start;
  const n = weeksBetween(start, last) + 1;
  if (n <= 0) return null;
  const values: (number | null)[] = [];
  for (let i = 0; i < n; i++) values.push(index.valueAt(finalData.region, ARE_TARGET_SERIES, addWeeks(start, i), asOf));
  while (values.length > 0 && values[values.length - 1] === null) values.pop();
  if (values.every((v) => v === null)) return null;
  const target: WeeklySeries = { start, values };
  return { region: finalData.region, target, signals: truncated.signals };
}

/** Provider of the data known at an origin; `info` tells whether a real vintage or the fallback was used. */
export interface DataAtOrigin {
  (origin: IsoWeek): RegionData[];
  info(origin: IsoWeek): { kind: 'vintage' | 'fallback'; asOf: string | null };
}

/**
 * Build `dataAtOrigin` for `runBacktest`. For an origin week the as_of date is
 * the availability date of ('de','00+',origin), i.e. the first version in which
 * the week existed; the target series of every region is then the ARE snapshot at
 * that date. If the origin week was never seen (origin before the first version,
 * or beyond the last) the final data truncated with the configured lags is used
 * and the origin counts as 'fallback' (see `info`). Only versions with
 * as_of <= asOf are ever read (no look-ahead).
 */
export function makeDataAtOrigin(areRows: readonly LongRow[], finalData: RegionData[], cfg: EvalConfig): DataAtOrigin {
  const index = new VintageIndex(areRows);
  const info = (origin: IsoWeek) => {
    const asOf = index.firstSeen('de', ARE_TARGET_SERIES, origin);
    return { kind: (asOf === null ? 'fallback' : 'vintage') as 'vintage' | 'fallback', asOf };
  };
  const fn = ((origin: IsoWeek): RegionData[] => {
    const { kind, asOf } = info(origin);
    if (kind === 'fallback') return finalData.map((d) => truncateRegionData(d, origin, cfg.availability_lags_weeks));
    return finalData.flatMap((d) => {
      const r = regionDataAtOrigin(index, d, asOf!, origin, cfg);
      return r ? [r] : [];
    });
  }) as DataAtOrigin;
  fn.info = info;
  return fn;
}

export interface VintageOptions {
  /** Complete ARE long table (with real as_of history). */
  areRows: readonly LongRow[];
  /** Seasons whose target weeks are scored, e.g. ["2023/24","2024/25"]. */
  seasons: string[];
  evaluateRegions?: string[];
  refitEvery?: number;
  onProgress?: (done: number, total: number) => void;
}

export interface ModelDegradation {
  final: MetricSummary;
  vintage: MetricSummary;
  /** vintage.wis / final.wis - 1 (positive = worse with real data versions) */
  rel_degradation: number;
}

export interface VintageComparison {
  seasons: string[];
  origins_total: number;
  origins_vintage: number;
  origins_fallback: number;
  /** Number of identical (model, region, origin, horizon) cells scored in both modes. */
  n_cells: number;
  models: Record<string, ModelDegradation>;
  comparisons: {
    final: Record<string, ModelComparison | null>;
    vintage: Record<string, ModelComparison | null>;
  };
}

/** Origins whose forecasts can reach into the given seasons (same rule as the evaluation protocol). */
export function originsForSeasons(seasons: string[]): IsoWeek[] {
  const all = seasons.flatMap(seasonWeeks).sort(compareWeeks);
  return weekRange(addWeeks(all[0]!, -4), all[all.length - 1]!);
}

const cellKey = (r: BacktestRecord) => `${r.model}|${r.region}|${r.origin}|${r.forecast.h}`;

/**
 * Pure part: given the records of both modes (same model names), keep the
 * cells present in both, summarise per model and compute degradation and the
 * ensemble-vs-baseline comparisons. Actuals in the records are whatever the
 * caller used (the final values in `runVintageComparison`).
 */
export function compareFinalVsVintage(
  finalRecords: readonly BacktestRecord[],
  vintageRecords: readonly BacktestRecord[],
  cfg: EvalConfig,
  names: { baseline: string; persistence: string; ensemble: string },
): Pick<VintageComparison, 'n_cells' | 'models' | 'comparisons'> {
  const vk = new Set(vintageRecords.map(cellKey));
  const fk = new Set(finalRecords.map(cellKey));
  const f = finalRecords.filter((r) => vk.has(cellKey(r)));
  const v = vintageRecords.filter((r) => fk.has(cellKey(r)));
  const fs = summarizeBy(f, (r) => r.model);
  const vs = summarizeBy(v, (r) => r.model);
  const models: Record<string, ModelDegradation> = {};
  for (const [m, fin] of fs) {
    const vin = vs.get(m);
    if (vin) models[m] = { final: fin, vintage: vin, rel_degradation: vin.wis / fin.wis - 1 };
  }
  const bs = { blockSize: cfg.bootstrap.block_weeks, nBoot: cfg.bootstrap.n, seed: cfg.bootstrap.seed };
  const cmp = (recs: readonly BacktestRecord[]) => ({
    'ensemble vs baseline': compareModels(recs, names.ensemble, names.baseline, bs),
    'ensemble vs persistence': compareModels(recs, names.ensemble, names.persistence, bs),
  });
  return { n_cells: f.filter((r) => r.model === names.baseline).length, models, comparisons: { final: cmp(f), vintage: cmp(v) } };
}

/**
 * Backtest the baseline, persistence and the chosen ensemble twice on the same
 * origins and cells: once with the final (corrected) data as input (existing
 * behaviour) and once with the data as it was published at each origin.
 * Only origins with a real vintage are used; targets are restricted to `seasons`.
 * Actuals are the FINAL values in both modes (today's corrected numbers); the
 * first-published value is not used as the actual.
 */
export function runVintageComparison(data: RegionData[], cfg: EvalConfig, choice: ModelChoice, opts: VintageOptions): VintageComparison {
  const dataAtOrigin = makeDataAtOrigin(opts.areRows, data, cfg);
  const all = originsForSeasons(opts.seasons);
  const origins = all.filter((o) => dataAtOrigin.info(o).kind === 'vintage');
  const ensName = `ens-${choice.candidate}`;
  const seasons = new Set(opts.seasons);
  const models = () => [buildBaseline(cfg), buildPersistence(cfg), buildChosenEnsemble(cfg, choice, ensName)];
  const runMode = (vintage: boolean): BacktestRecord[] => {
    const recs = runBacktest({
      truth: data,
      lags: cfg.availability_lags_weeks,
      dataAtOrigin: vintage ? dataAtOrigin : undefined,
      origins,
      horizons: HORIZONS,
      models: models(),
      evaluateRegions: opts.evaluateRegions ?? data.map((d) => d.region),
      excludeWeek: isPandemicWeek(cfg),
      refitEvery: opts.refitEvery,
      onProgress: opts.onProgress,
    }).filter((r) => seasons.has(seasonOf(r.forecast.iso_week)));
    return [...recs.filter((r) => r.model !== ensName), ...rescaleRecords(recs, ensName, choice.spread_factor, 'ensemble')];
  };
  const finalRecs = runMode(false);
  const vintageRecs = runMode(true);
  const res = compareFinalVsVintage(finalRecs, vintageRecs, cfg, { baseline: cfg.models.baseline.name, persistence: cfg.models.persistence.name, ensemble: 'ensemble' });
  return { seasons: opts.seasons, origins_total: all.length, origins_vintage: origins.length, origins_fallback: all.length - origins.length, ...res };
}
