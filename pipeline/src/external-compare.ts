import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  addWeeks, compareModels, formatWeek, rescaleRecords, runBacktest, seasonOf, seriesGet, sortQuantiles, summarizeBy, weekOfDate, weeksBetween,
  wavePhase, type BacktestRecord, type EvalConfig, type Horizon, type IsoWeek, type MetricSummary, type ModelChoice, type ModelComparison,
  type QuantileSet, type RegionData,
} from '@coldfront/forecast-core';
import { buildBaseline, buildEnsemble, buildPersistence, isPandemicWeek } from '@coldfront/forecast-core';
import type { SourceMeta } from './types';

// External comparison of Coldfront's national ARE forecasts with the public RESPINOW-Hub forecast archive
// (https://github.com/KITmetricslab/RESPINOW-Hub, MIT licence, copyright KITmetricslab). Only DE / 00+ is used.
// RESPINOW publishes absolute weekly counts of ARE consultations; Coldfront uses RKI's incidence per 100,000.
// Their quantiles are converted to per 100k (never ours scaled up) with the median weekly count/incidence ratio.

export const SOURCE: Omit<SourceMeta, 'retrieved' | 'sha256'> = {
  id: 'respinow-hub',
  name: 'RESPINOW-Hub forecast archive (KITmetricslab)',
  url: 'https://github.com/KITmetricslab/RESPINOW-Hub',
  attribution: 'RESPINOW-Hub, KITmetricslab (MIT licence); Prognosen der Teams KIT-*, MPIDS-*',
  license: 'MIT',
  license_url: 'https://github.com/KITmetricslab/RESPINOW-Hub/blob/main/LICENSE',
  doi: '',
};

export const RESPINOW_PREFIX = 'respinow:';
const REQUIRED_LEVELS = [0.1, 0.25, 0.5, 0.75, 0.9] as const;
export const DEFAULT_SEASONS = ['2024/25', '2025/26'];

/** One quantile forecast (all levels of one forecast date x horizon) from a RESPINOW submission file. */
export interface RespinowForecast {
  model: string;
  forecastDate: string;
  horizon: number;
  targetEndDate: string;
  quantiles: Record<number, number>;
}

const unquote = (s: string) => s.trim().replace(/^"(.*)"$/, '$1');

/**
 * Parse one submission CSV (columns location,age_group,forecast_date,target_end_date,horizon,type,quantile,value;
 * quoted or unquoted). Keeps only location "DE", age group "00+" and type "quantile". Horizons <= 0 (nowcasts)
 * are kept so that callers can see them; the comparison uses horizons >= 1. The model name is not part of the
 * file, it comes from the directory name and is passed in.
 */
export function parseRespinowSubmission(csv: string, model = ''): RespinowForecast[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const header = lines[0]!.split(',').map(unquote);
  const col = (n: string) => {
    const i = header.indexOf(n);
    if (i < 0) throw new Error(`RESPINOW submission: missing column ${n}`);
    return i;
  };
  const [iLoc, iAge, iFd, iTe, iH, iType, iQ, iV] = ['location', 'age_group', 'forecast_date', 'target_end_date', 'horizon', 'type', 'quantile', 'value'].map(col) as [number, number, number, number, number, number, number, number];
  const groups = new Map<string, RespinowForecast>();
  for (const line of lines.slice(1)) {
    const c = line.split(',').map(unquote);
    if (c[iLoc] !== 'DE' || c[iAge] !== '00+' || c[iType] !== 'quantile') continue;
    const level = Number(c[iQ]);
    const value = Number(c[iV]);
    const horizon = Number(c[iH]);
    if (c[iQ] === '' || c[iQ] === 'NA' || !Number.isFinite(level) || !Number.isFinite(value) || !Number.isInteger(horizon)) continue;
    const key = `${c[iFd]}|${c[iTe]}|${horizon}`;
    let g = groups.get(key);
    if (!g) {
      g = { model, forecastDate: c[iFd]!, horizon, targetEndDate: c[iTe]!, quantiles: {} };
      groups.set(key, g);
    }
    g.quantiles[level] = value;
  }
  return [...groups.values()].sort((a, b) => a.forecastDate.localeCompare(b.forecastDate) || a.horizon - b.horizon);
}

/** Truth file (date,year,week,location,age_group,value): weekly absolute ARE counts of DE / 00+. */
export function parseRespinowTruth(csv: string): { counts: Map<IsoWeek, number>; labelMismatches: number } {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = lines[0]!.split(',').map(unquote);
  const idx = (n: string) => header.indexOf(n);
  const [iD, iY, iW, iL, iA, iV] = ['date', 'year', 'week', 'location', 'age_group', 'value'].map(idx) as [number, number, number, number, number, number];
  const counts = new Map<IsoWeek, number>();
  let labelMismatches = 0;
  for (const line of lines.slice(1)) {
    const c = line.split(',').map(unquote);
    if (c[iL] !== 'DE' || c[iA] !== '00+') continue;
    const w = toIsoWeek(c[iD]!);
    if (w !== formatWeek(Number(c[iY]), Number(c[iW]))) labelMismatches++;
    counts.set(w, Number(c[iV]));
  }
  return { counts, labelMismatches };
}

/** ISO week of a calendar date (YYYY-MM-DD); a Sunday target_end_date belongs to the week it ends. */
export function toIsoWeek(date: string): IsoWeek {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid date: ${date}`);
  return weekOfDate(new Date(`${date}T00:00:00Z`));
}

/**
 * Our QuantileSet from RESPINOW levels 0.1/0.25/0.5/0.75/0.9, counts divided by `countsPer100k`
 * (count / incidence). Levels 0.025/0.975 are ignored on purpose: both sides are scored with the same
 * WIS definition (`weightedIntervalScore`). Returns null if a required level is missing.
 */
export function toQuantileSet(isoWeek: IsoWeek, h: Horizon, quantiles: Record<number, number>, countsPer100k: number): QuantileSet | null {
  const v = REQUIRED_LEVELS.map((l) => quantiles[l]);
  if (v.some((x) => x === undefined || !Number.isFinite(x))) return null;
  const [q10, q25, q50, q75, q90] = v.map((x) => x! / countsPer100k) as [number, number, number, number, number];
  return sortQuantiles({ iso_week: isoWeek, h, q10, q25, q50, q75, q90 });
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN;
};

export interface UnitRatio {
  /** Median of count/incidence over the last `windowWeeks` overlapping weeks: the factor used for the conversion. */
  ratio: number;
  window: { from: IsoWeek; to: IsoWeek; n: number };
  min: number;
  max: number;
  /** (max - min) / median within the window */
  rel_range: number;
  /** standard deviation / mean within the window */
  cv: number;
  /** weeks in the window deviating more than 2 % from the median */
  n_dev_gt_2pct: number;
  /** same statistic over all overlapping weeks (population drift over the years) */
  all_weeks: { from: IsoWeek; to: IsoWeek; n: number; median: number; min: number; max: number };
}

/** Weekly ratio RESPINOW count / Coldfront incidence on weeks present in both series. */
export function unitRatio(counts: Map<IsoWeek, number>, ours: RegionData, windowWeeks = 52): UnitRatio {
  const rows: { w: IsoWeek; r: number }[] = [];
  for (const [w, c] of counts) {
    const v = seriesGet(ours.target, w);
    if (v !== null && v > 0 && c > 0) rows.push({ w, r: c / v });
  }
  rows.sort((a, b) => a.w.localeCompare(b.w));
  if (rows.length === 0) throw new Error('unitRatio: no overlapping weeks');
  const win = rows.slice(-windowWeeks);
  const rs = win.map((x) => x.r);
  const med = median(rs);
  const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
  const sd = Math.sqrt(rs.reduce((a, b) => a + (b - mean) ** 2, 0) / rs.length);
  const allR = rows.map((x) => x.r);
  return {
    ratio: med,
    window: { from: win[0]!.w, to: win[win.length - 1]!.w, n: win.length },
    min: Math.min(...rs),
    max: Math.max(...rs),
    rel_range: (Math.max(...rs) - Math.min(...rs)) / med,
    cv: sd / mean,
    n_dev_gt_2pct: rs.filter((x) => Math.abs(x / med - 1) > 0.02).length,
    all_weeks: { from: rows[0]!.w, to: rows[rows.length - 1]!.w, n: rows.length, median: median(allR), min: Math.min(...allR), max: Math.max(...allR) },
  };
}

/** Origins (forecast week - 1) of all RESPINOW forecast dates whose horizon 1..4 targets reach into the seasons. */
export function externalOrigins(submissions: Record<string, RespinowForecast[]>, seasons: string[]): IsoWeek[] {
  const set = new Set<IsoWeek>();
  const ss = new Set(seasons);
  for (const fcs of Object.values(submissions)) {
    for (const f of fcs) {
      if (f.horizon < 1 || f.horizon > 4) continue;
      if (ss.has(seasonOf(toIsoWeek(f.targetEndDate)))) set.add(addWeeks(toIsoWeek(f.forecastDate), -1));
    }
  }
  return [...set].sort();
}

export interface ExternalMeta {
  /** ISO date this result was generated (passed in, never read from the clock). */
  generated: string;
  /** ISO date the RESPINOW clone was retrieved. */
  retrieved?: string;
  commit?: string;
  truth_sha256?: string;
}

export interface PanelResult {
  description: string;
  models: string[];
  n_cells: number;
  n_origins: number;
  cells_by_season: Record<string, number>;
  overall: Record<string, MetricSummary>;
  by_season: Record<string, Record<string, MetricSummary>>;
  by_horizon: Record<string, Record<string, MetricSummary>>;
  comparisons: Record<string, ModelComparison | null>;
  comparisons_by_season: Record<string, Record<string, ModelComparison | null>>;
  /** Same cells scored against RESPINOW's own truth converted with the same ratio. */
  respinow_truth: { n_cells: number; overall: Record<string, MetricSummary>; comparisons: Record<string, ModelComparison | null> };
}

export interface ExternalComparison {
  generated: string;
  source: Omit<SourceMeta, 'retrieved' | 'sha256'> & { retrieved?: string; commit?: string; truth_sha256?: string };
  target: { region: 'de'; unit: 'per_100k'; actuals: string };
  seasons: string[];
  unit_ratio: UnitRatio;
  alignment: AlignmentCheck;
  coverage: Record<string, CoverageEntry>;
  coldfront_models: string[];
  panels: Record<string, PanelResult>;
  notes: string[];
}

export interface AlignmentCheck {
  rows_checked: number;
  /** forecast_date is a Thursday */
  forecast_date_thursday: number;
  /** target_end_date is a Sunday */
  target_end_sunday: number;
  /** iso week of target_end_date == ISO week of forecast_date + horizon - 1 (i.e. our origin + horizon) */
  horizon_aligned: number;
  /** horizon 0 rows (nowcasts): target week == forecast week - 1 */
  nowcast_rows: number;
  nowcast_aligned: number;
  truth_label_mismatches: number;
}

export interface CoverageEntry {
  /** files/forecast dates with at least one horizon 1..4 forecast */
  forecast_dates: number;
  first: string | null;
  last: string | null;
  /** horizon 1..4 forecasts inside the selected seasons with an actual, before intersecting with other models */
  cells: number;
  cells_by_season: Record<string, number>;
  cells_common_with_coldfront: number;
  note?: string;
}

export interface ExternalInput {
  submissions: Record<string, RespinowForecast[]>;
  respinowTruth: Map<IsoWeek, number>;
  truthLabelMismatches?: number;
  /** Region `de`; its target (per 100k) provides the actuals, the ratio and the wave phase. */
  deData: RegionData;
  /** Records of baseline, persistence and 'ensemble' (rescaled) for region de, from runBacktest. */
  ourRecords: BacktestRecord[];
  cfg: EvalConfig;
  seasons?: string[];
  meta: ExternalMeta;
}

const OURS_ORDER = ['baseline-seasonal', 'persistence', 'ensemble'];
const cellKey = (r: BacktestRecord) => `${r.origin}|${r.forecast.h}`;
const isThursday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay() === 4;
const isSunday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay() === 0;

/** Pure core: score Coldfront and all RESPINOW models on identical cells and compare them. */
export function buildExternalComparison(input: ExternalInput): ExternalComparison {
  const { cfg, deData, meta } = input;
  const seasons = input.seasons ?? DEFAULT_SEASONS;
  const seasonSet = new Set(seasons);
  const ratio = unitRatio(input.respinowTruth, deData);

  // alignment of horizon / dates
  const al: AlignmentCheck = { rows_checked: 0, forecast_date_thursday: 0, target_end_sunday: 0, horizon_aligned: 0, nowcast_rows: 0, nowcast_aligned: 0, truth_label_mismatches: input.truthLabelMismatches ?? 0 };
  for (const fcs of Object.values(input.submissions)) {
    for (const f of fcs) {
      const fw = toIsoWeek(f.forecastDate);
      const tw = toIsoWeek(f.targetEndDate);
      if (f.horizon >= 1 && f.horizon <= 4) {
        al.rows_checked++;
        if (isThursday(f.forecastDate)) al.forecast_date_thursday++;
        if (isSunday(f.targetEndDate)) al.target_end_sunday++;
        if (tw === addWeeks(addWeeks(fw, -1), f.horizon)) al.horizon_aligned++;
      } else if (f.horizon === 0) {
        al.nowcast_rows++;
        if (tw === addWeeks(fw, -1)) al.nowcast_aligned++;
      }
    }
  }

  // Coldfront records (final-data mode, origin = RESPINOW forecast week - 1)
  const ours = new Map<string, Map<string, BacktestRecord>>();
  for (const r of input.ourRecords) {
    if (!seasonSet.has(r.season) || r.region !== 'de') continue;
    if (!ours.has(r.model)) ours.set(r.model, new Map());
    ours.get(r.model)!.set(cellKey(r), r);
  }
  const oursModels = OURS_ORDER.filter((m) => ours.has(m));

  // RESPINOW records (converted to per 100k, scored against Coldfront's final series)
  const theirs = new Map<string, Map<string, BacktestRecord>>();
  const coverage: Record<string, CoverageEntry> = {};
  for (const model of Object.keys(input.submissions).sort()) {
    const name = RESPINOW_PREFIX + model;
    const fcs = input.submissions[model]!.filter((f) => f.horizon >= 1 && f.horizon <= 4);
    const dates = new Set(fcs.map((f) => f.forecastDate));
    const cells = new Map<string, BacktestRecord>();
    for (const f of fcs) {
      const week = toIsoWeek(f.targetEndDate);
      const origin = addWeeks(toIsoWeek(f.forecastDate), -1);
      if (!seasonSet.has(seasonOf(week)) || weeksBetween(origin, week) !== f.horizon) continue;
      const actual = seriesGet(deData.target, week);
      if (actual === null || isPandemicWeek(cfg)(week)) continue;
      const q = toQuantileSet(week, f.horizon as Horizon, f.quantiles, ratio.ratio);
      if (!q) continue;
      const rec: BacktestRecord = { model: name, region: 'de', origin, season: seasonOf(week), forecast: q, actual, phase: wavePhase(deData, week) };
      cells.set(cellKey(rec), rec);
    }
    theirs.set(name, cells);
    const sorted = [...dates].sort();
    const bySeason: Record<string, number> = {};
    for (const r of cells.values()) bySeason[r.season] = (bySeason[r.season] ?? 0) + 1;
    const ref = ours.get('ensemble') ?? new Map();
    coverage[name] = {
      forecast_dates: dates.size,
      first: sorted[0] ?? null,
      last: sorted[sorted.length - 1] ?? null,
      cells: cells.size,
      cells_by_season: bySeason,
      cells_common_with_coldfront: [...cells.keys()].filter((k) => ref.has(k)).length,
      ...(fcs.length === 0 ? { note: 'No horizon 1..4 forecasts (nowcast-only submission); excluded from the comparison.' } : {}),
    };
  }
  const respModels = [...theirs.keys()].filter((m) => theirs.get(m)!.size > 0);
  const all = new Map<string, Map<string, BacktestRecord>>([...ours, ...theirs]);
  const bs = { blockSize: cfg.bootstrap.block_weeks, nBoot: cfg.bootstrap.n, seed: cfg.bootstrap.seed };

  const panelFor = (description: string, models: string[]): PanelResult | null => {
    const keySets = models.map((m) => new Set(all.get(m)?.keys() ?? []));
    const keys = [...keySets[0] ?? []].filter((k) => keySets.every((s) => s.has(k))).sort();
    if (keys.length === 0) return null;
    const recs = models.flatMap((m) => keys.map((k) => all.get(m)!.get(k)!));
    const sample = models[0]!;
    const cellsBySeason: Record<string, number> = {};
    for (const k of keys) {
      const s = all.get(sample)!.get(k)!.season;
      cellsBySeason[s] = (cellsBySeason[s] ?? 0) + 1;
    }
    const grouped = (rs: BacktestRecord[], key: (r: BacktestRecord) => string) => {
      const out: Record<string, Record<string, MetricSummary>> = {};
      for (const m of models) for (const [k, v] of summarizeBy(rs.filter((r) => r.model === m), key)) (out[k] ??= {})[m] = v;
      return out;
    };
    const compare = (rs: BacktestRecord[]) => {
      const out: Record<string, ModelComparison | null> = {};
      for (const m of models.filter((x) => x.startsWith(RESPINOW_PREFIX))) out[`ensemble vs ${m}`] = compareModels(rs, 'ensemble', m, bs);
      out[`ensemble vs ${cfg.models.baseline.name}`] = compareModels(rs, 'ensemble', cfg.models.baseline.name, bs);
      return out;
    };
    const comparisonsBySeason: Record<string, Record<string, ModelComparison | null>> = {};
    for (const s of Object.keys(cellsBySeason)) comparisonsBySeason[s] = compare(recs.filter((r) => r.season === s));
    // variant B: RESPINOW's own truth (converted with the same ratio) as actuals, only cells where it exists
    const truthKeys = new Set(keys.filter((k) => input.respinowTruth.has(all.get(sample)!.get(k)!.forecast.iso_week)));
    const recsB = recs.filter((r) => truthKeys.has(cellKey(r))).map((r) => ({ ...r, actual: input.respinowTruth.get(r.forecast.iso_week)! / ratio.ratio }));
    return {
      description,
      models,
      n_cells: keys.length,
      n_origins: new Set(keys.map((k) => k.split('|')[0])).size,
      cells_by_season: cellsBySeason,
      overall: Object.fromEntries(models.map((m) => [m, summarizeBy(recs.filter((r) => r.model === m), () => 'x').get('x')!])),
      by_season: grouped(recs, (r) => r.season),
      by_horizon: grouped(recs, (r) => `h${r.forecast.h}`),
      comparisons: compare(recs),
      comparisons_by_season: comparisonsBySeason,
      respinow_truth: {
        n_cells: truthKeys.size,
        overall: recsB.length ? Object.fromEntries(models.map((m) => [m, summarizeBy(recsB.filter((r) => r.model === m), () => 'x').get('x')!])) : {},
        comparisons: recsB.length ? compare(recsB) : {},
      },
    };
  };

  const panels: Record<string, PanelResult> = {};
  const add = (id: string, description: string, models: string[]) => {
    const p = panelFor(description, models);
    if (p) panels[id] = p;
  };
  add('all', 'Cells where Coldfront and every RESPINOW model with horizon 1..4 forecasts have a forecast (strict intersection).', [...oursModels, ...respModels]);
  const seasonsWithData = seasons.filter((s) => respModels.some((m) => (coverage[m]?.cells_by_season[s] ?? 0) > 0));
  const core = respModels.filter((m) => seasonsWithData.every((s) => (coverage[m]!.cells_by_season[s] ?? 0) > 0));
  if (core.length > 0 && core.length < respModels.length) {
    add('core', `Cells where Coldfront and the RESPINOW models covering every season with RESPINOW data (${seasonsWithData.join(', ')}) have a forecast.`, [...oursModels, ...core]);
  }
  for (const m of respModels) add(`vs:${m}`, `Head to head: Coldfront and ${m} on all cells where both have a forecast.`, [...oursModels, m]);

  const nAll = panels['all']?.n_cells ?? 0;
  const allSeasons = Object.keys(panels['all']?.cells_by_season ?? {});
  const hasCore = 'core' in panels;
  const notes = [
    'Descriptive comparison, not a fair contest. RESPINOW forecasts were produced in real time from vintage data (the most recent data week was still incomplete and reporting delays had to be handled by the models); Coldfront forecasts here use today\'s corrected data for all inputs and for the origin week (final-data backtest), which flatters Coldfront. A vintage-based variant is being built separately.',
    `Season 2025/26 was already used once as the untouched test season of Coldfront's own pre-registered protocol (forecasts/backtest/test.json); the model choice and spread factor were tuned on 2023/24 and 2024/25, so 2024/25 is in-sample for the choice of features and spread. These results were not used to change anything.`,
    `Alignment of horizon (verified against the files, see alignment): forecast_date is a Thursday in ISO week F; horizon 1 has target_end_date = Sunday of week F, i.e. the week after the last published data week F-1 (the reporting triangle of the clone ends with week F-1 at delay 0). RESPINOW horizon h therefore equals Coldfront horizon h for origin F-1. ${al.horizon_aligned} of ${al.rows_checked} rows satisfy this; horizon 0 rows (nowcast of week F-1) are not scored.`,
    `Unit conversion: RESPINOW counts / ${ratio.ratio.toFixed(2)} (median of weekly count/incidence over ${ratio.window.n} weeks ${ratio.window.from}..${ratio.window.to}; within the window min ${ratio.min.toFixed(2)}, max ${ratio.max.toFixed(2)}, relative range ${(ratio.rel_range * 100).toFixed(1)} %). Over all ${ratio.all_weeks.n} overlapping weeks the ratio ranges ${ratio.all_weeks.min.toFixed(1)}..${ratio.all_weeks.max.toFixed(1)}. Coldfront values are not scaled.${ratio.rel_range < 0.001 ? ' The ratio is practically constant, i.e. RESPINOW\'s counts are the RKI incidence multiplied by a fixed population (about ' + (ratio.ratio * 100000 / 1e6).toFixed(2) + ' million), so the conversion adds no uncertainty.' : ''}`,
    'Only quantile levels 0.1/0.25/0.5/0.75/0.9 of RESPINOW are used (0.025/0.975 are ignored) so that all models are scored with the same WIS definition as Coldfront (K=2 intervals plus median). This is not the WIS of the RESPINOW-Hub dashboard (7 levels).',
    `Coverage of cells: every model is scored on exactly the same (origin, horizon) cells within a panel. The RESPINOW archive has gaps (summer, weeks between seasons, single missing weeks) and models differ in how long they were submitted, so the strict intersection (panel "all") has ${nAll} cells in season(s) ${allSeasons.join(', ') || 'none'}${hasCore ? '; panel "core" drops the models that do not cover every season' : ''}; the head-to-head panels "vs:<model>" use all cells shared with one model. KIT-simple_nowcast contains nowcasts only (horizons <= 0) and is not compared.`,
    `Bootstrap: confidence intervals (ci95) are for the mean WIS difference ensemble minus the other model, in units of incidence per 100k (negative = ensemble better), from a block bootstrap over origin weeks (blocks of ${cfg.bootstrap.block_weeks}, ${cfg.bootstrap.n} draws, fixed seed). With so few cells they are wide, horizons of one origin are strongly dependent, and the bootstrap cannot account for the choice of panel; seasonsBetter counts at most two seasons.`,
    'Actuals: Coldfront\'s final ARE incidence per 100k (RKI). The variant "respinow_truth" re-scores the same cells against RESPINOW\'s latest truth divided by the same ratio; it differs only through the ratio and data revisions.',
  ];

  return {
    generated: meta.generated,
    source: { ...SOURCE, ...(meta.retrieved ? { retrieved: meta.retrieved } : {}), ...(meta.commit ? { commit: meta.commit } : {}), ...(meta.truth_sha256 ? { truth_sha256: meta.truth_sha256 } : {}) },
    target: { region: 'de', unit: 'per_100k', actuals: 'Coldfront final ARE series (RKI ARE-Konsultationsinzidenz), data/clean/de/series.csv' },
    seasons,
    unit_ratio: ratio,
    alignment: al,
    coverage,
    coldfront_models: oursModels,
    panels,
    notes,
  };
}

export interface RunExternalOptions {
  /** Path of the RESPINOW-Hub clone. */
  respinowDir: string;
  data: RegionData[];
  cfg: EvalConfig;
  choice: ModelChoice;
  seasons?: string[];
  generated: string;
  retrieved?: string;
  commit?: string;
  onProgress?: (done: number, total: number) => void;
}

/** Read all national 00+ submissions and the truth from a RESPINOW-Hub clone. */
export function loadRespinow(respinowDir: string): { submissions: Record<string, RespinowForecast[]>; truth: ReturnType<typeof parseRespinowTruth>; truthSha256: string } {
  const base = resolve(respinowDir, 'submissions/agi/are');
  const submissions: Record<string, RespinowForecast[]> = {};
  for (const dir of readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    const files = readdirSync(resolve(base, dir)).filter((f) => /^\d{4}-\d{2}-\d{2}-agi-are-.+\.csv$/.test(f)).sort();
    submissions[dir] = files.flatMap((f) => parseRespinowSubmission(readFileSync(resolve(base, dir, f), 'utf8'), dir));
  }
  const truthFile = resolve(respinowDir, 'data/agi/are/latest_data-agi-are.csv');
  if (!existsSync(truthFile)) throw new Error(`RESPINOW truth not found: ${truthFile}`);
  const bytes = readFileSync(truthFile);
  return { submissions, truth: parseRespinowTruth(bytes.toString('utf8')), truthSha256: createHash('sha256').update(bytes).digest('hex') };
}

/** Run Coldfront's models at origins matching the RESPINOW forecast dates and build the comparison. */
export function runExternalComparison(opts: RunExternalOptions): ExternalComparison {
  const { cfg, choice } = opts;
  const seasons = opts.seasons ?? DEFAULT_SEASONS;
  const { submissions, truth, truthSha256 } = loadRespinow(opts.respinowDir);
  const deData = opts.data.find((d) => d.region === 'de');
  if (!deData) throw new Error('region de missing in data');
  const ensName = `ens-${choice.candidate}`;
  const raw = runBacktest({
    truth: opts.data,
    lags: cfg.availability_lags_weeks,
    origins: externalOrigins(submissions, seasons),
    horizons: [1, 2, 3, 4],
    models: [buildBaseline(cfg), buildPersistence(cfg), buildEnsemble(cfg, ensName, choice.groups)],
    evaluateRegions: ['de'],
    excludeWeek: isPandemicWeek(cfg),
    onProgress: opts.onProgress,
  });
  const ourRecords = [...raw.filter((r) => r.model !== ensName), ...rescaleRecords(raw, ensName, choice.spread_factor, 'ensemble')];
  return buildExternalComparison({
    submissions,
    respinowTruth: truth.counts,
    truthLabelMismatches: truth.labelMismatches,
    deData,
    ourRecords,
    cfg,
    seasons,
    meta: { generated: opts.generated, retrieved: opts.retrieved, commit: opts.commit, truth_sha256: truthSha256 },
  });
}
