import type { BacktestPublic, TuningPublic } from './api-types';
import { peakErrors, compareModels, rescaleRecords, runBacktest, summarizeBy, type BacktestRecord } from './backtest';
import { persistence, seasonalBaseline } from './baseline';
import { ensembleFactory } from './ensemble';
import type { FeatureGroup } from './features';
import { addWeeks, seasonOf, weekRange } from './isoweek';
import { summarize } from './metrics';
import { regionalQuantileModel } from './regional-model';
import { HORIZONS, type AvailabilityLags, type ForecasterFactory, type IsoWeek, type MetricSummary, type RegionData } from './types';

// Evaluation protocol: pure functions, shared by the pipeline (Node) and the in-browser self-check.

export interface EvalConfig {
  pandemic_exclusion: { from: IsoWeek; to: IsoWeek };
  horizons: number[];
  seasons: { tuning: string[]; test: string };
  availability_lags_weeks: AvailabilityLags;
  models: {
    baseline: { name: string; window_weeks: number; min_samples: number };
    persistence: { name: string; min_samples: number };
    regional: { ridge: number; min_train_rows: number; max_iter: number };
    ensemble: { model_weight: number; baseline_weight: number };
    feature_candidates: { name: string; groups: FeatureGroup[] }[];
    spread_factor_grid: number[];
  };
  gate: { reference: string; min_rel_wis_improvement: number };
  bootstrap: { block_weeks: number; n: number; seed: number };
}

export const isPandemicWeek = (cfg: EvalConfig) => (w: IsoWeek) => w >= cfg.pandemic_exclusion.from && w <= cfg.pandemic_exclusion.to;

export function seasonWeeks(season: string): IsoWeek[] {
  const y = Number(season.slice(0, 4));
  return weekRange(`${y}-W40`, addWeeks(`${y + 1}-W40`, -1));
}

export interface ModelChoice {
  candidate: string;
  groups: FeatureGroup[];
  spread_factor: number;
}

export function buildBaseline(cfg: EvalConfig) {
  return seasonalBaseline({ excludeWeek: isPandemicWeek(cfg), windowWeeks: cfg.models.baseline.window_weeks, minSamples: cfg.models.baseline.min_samples });
}
export function buildPersistence(cfg: EvalConfig) {
  return persistence({ excludeWeek: isPandemicWeek(cfg), minSamples: cfg.models.persistence.min_samples });
}
export function buildRegional(cfg: EvalConfig, name: string, groups: FeatureGroup[]): ForecasterFactory {
  const r = cfg.models.regional;
  return regionalQuantileModel({ name, featureGroups: groups, ridge: r.ridge, minTrainRows: r.min_train_rows, maxIter: r.max_iter, excludeWeek: isPandemicWeek(cfg) });
}
export function buildEnsemble(cfg: EvalConfig, name: string, groups: FeatureGroup[]): ForecasterFactory {
  const e = cfg.models.ensemble;
  return ensembleFactory(name, [
    { factory: buildBaseline(cfg), weight: e.baseline_weight },
    { factory: buildRegional(cfg, `rqm-${name}`, groups), weight: e.model_weight },
  ]);
}

/** Origins whose forecasts can reach into the given seasons. */
function originsFor(seasons: string[]): IsoWeek[] {
  const all = seasons.flatMap(seasonWeeks).sort();
  return weekRange(addWeeks(all[0]!, -4), all[all.length - 1]!);
}

export interface RunOptions {
  /** Regions that are scored (training always uses all regions). Default: all. */
  evaluateRegions?: string[];
  /** Refit the learned model only every n-th origin (speed for the browser). Default 1. */
  refitEvery?: number;
  onProgress?: (done: number, total: number) => void;
  /** Receives the scored per-week records (models: baseline, persistence, regional-model, ensemble) for charts. */
  onRecords?: (records: BacktestRecord[]) => void;
}

function run(cfg: EvalConfig, data: RegionData[], seasons: string[], models: (ForecasterFactory | ReturnType<typeof buildBaseline>)[], opts: RunOptions = {}): BacktestRecord[] {
  const set = new Set(seasons);
  const recs = runBacktest({
    truth: data,
    lags: cfg.availability_lags_weeks,
    origins: originsFor(seasons),
    horizons: HORIZONS,
    models,
    evaluateRegions: opts.evaluateRegions ?? data.map((d) => d.region),
    excludeWeek: isPandemicWeek(cfg),
    refitEvery: opts.refitEvery,
    onProgress: opts.onProgress,
  });
  return recs.filter((r) => set.has(seasonOf(r.forecast.iso_week)));
}

export type TuningResult = Omit<TuningPublic, 'chosen'> & { chosen: ModelChoice };

export function runTuning(data: RegionData[], cfg: EvalConfig, log: (m: string) => void = () => {}): TuningResult {
  const seasons = cfg.seasons.tuning;
  const candidates: TuningResult['candidates'] = [];
  let bestName = '';
  let bestWis = Infinity;
  let bestRecords: BacktestRecord[] = [];
  let baseWis = NaN;
  let persWis = NaN;
  for (const c of cfg.models.feature_candidates) {
    const t0 = Date.now();
    const ensName = `ens-${c.name}`;
    const recs = run(cfg, data, seasons, [buildBaseline(cfg), buildPersistence(cfg), buildRegional(cfg, `rqm-${c.name}`, c.groups), buildEnsemble(cfg, ensName, c.groups)]);
    const by = summarizeBy(recs, (r) => r.model);
    const ens = by.get(ensName)!;
    const mod = by.get(`rqm-${c.name}`)!;
    candidates.push({ name: c.name, groups: c.groups, wis_ensemble: ens.wis, wis_model: mod.wis, n: ens.n });
    baseWis = by.get(cfg.models.baseline.name)!.wis;
    persWis = by.get(cfg.models.persistence.name)!.wis;
    log(`tune ${c.name}: ens WIS ${ens.wis.toFixed(2)} model ${mod.wis.toFixed(2)} baseline ${baseWis.toFixed(2)} (n=${ens.n}, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    if (ens.wis < bestWis) {
      bestWis = ens.wis;
      bestName = c.name;
      bestRecords = recs.filter((r) => r.model === ensName);
    }
  }
  const spread_grid = cfg.models.spread_factor_grid.map((k) => {
    const s = summarize(rescaleRecords(bestRecords, `ens-${bestName}`, k, 'x'));
    return { k, wis: s.wis, coverage80: s.coverage80, coverage50: s.coverage50 };
  });
  const bestK = spread_grid.reduce((a, b) => (b.wis < a.wis - 1e-9 ? b : a)).k;
  const groups = cfg.models.feature_candidates.find((c) => c.name === bestName)!.groups;
  return { chosen: { candidate: bestName, groups, spread_factor: bestK }, tuned_on: seasons, candidates, baseline_wis: baseWis, persistence_wis: persWis, spread_grid };
}

export type TestResult = Omit<BacktestPublic, 'generated'>;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN;
};

export function runTest(data: RegionData[], cfg: EvalConfig, choice: ModelChoice, opts: RunOptions & { season?: string } = {}): TestResult {
  const season = opts.season ?? cfg.seasons.test;
  const ensName = `ens-${choice.candidate}`;
  const recs0 = run(cfg, data, [season], [buildBaseline(cfg), buildPersistence(cfg), buildRegional(cfg, 'regional-model', choice.groups), buildEnsemble(cfg, ensName, choice.groups)], opts);
  const recs = [...recs0.filter((r) => r.model !== ensName), ...rescaleRecords(recs0, ensName, choice.spread_factor, 'ensemble')];
  opts.onRecords?.(recs);
  const models = [cfg.models.baseline.name, cfg.models.persistence.name, 'regional-model', 'ensemble'];
  const grouped = (key: (r: BacktestRecord) => string) => {
    const out: Record<string, Record<string, MetricSummary>> = {};
    for (const m of models) {
      for (const [k, v] of summarizeBy(recs.filter((r) => r.model === m), key)) (out[k] ??= {})[m] = v;
    }
    return out;
  };
  const overall = Object.fromEntries([...summarizeBy(recs, (r) => r.model)]);
  const bs = { blockSize: cfg.bootstrap.block_weeks, nBoot: cfg.bootstrap.n, seed: cfg.bootstrap.seed };
  const comparisons: TestResult['comparisons'] = {
    'ensemble vs baseline-seasonal': compareModels(recs, 'ensemble', cfg.gate.reference, bs),
    'ensemble vs persistence': compareModels(recs, 'ensemble', cfg.models.persistence.name, bs),
    'regional-model vs baseline-seasonal': compareModels(recs, 'regional-model', cfg.gate.reference, bs),
  };
  const peaks = peakErrors(recs);
  const peak: TestResult['peak'] = {};
  for (const m of models) {
    const p = peaks.filter((x) => x.model === m);
    peak[m] = { n: p.length, median_abs_timing_weeks: median(p.map((x) => Math.abs(x.timingWeeks))), mean_height_rel: p.length ? p.reduce((a, x) => a + x.heightRel, 0) / p.length : NaN };
  }
  const cmp = comparisons['ensemble vs baseline-seasonal'];
  const rel = cmp ? cmp.relImprovement : null;
  const pass = rel !== null && rel >= cfg.gate.min_rel_wis_improvement;
  return {
    season,
    model_choice: choice,
    models,
    overall,
    by_region: grouped((r) => r.region),
    by_horizon: grouped((r) => `h${r.forecast.h}`),
    by_phase: grouped((r) => r.phase),
    comparisons,
    peak,
    gate: {
      shipped: pass ? 'ensemble' : 'baseline',
      rel_wis_improvement: rel,
      threshold: cfg.gate.min_rel_wis_improvement,
      reason: pass
        ? `Ensemble WIS is ${(rel! * 100).toFixed(1)} % below the seasonal baseline on the untouched test season (threshold ${(cfg.gate.min_rel_wis_improvement * 100).toFixed(0)} %).`
        : `Ensemble improvement over the seasonal baseline is ${rel === null ? 'not available' : (rel * 100).toFixed(1) + ' %'}, below the ${(cfg.gate.min_rel_wis_improvement * 100).toFixed(0)} % threshold; the baseline is shipped.`,
    },
  };
}

