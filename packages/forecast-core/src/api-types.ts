import type { ModelComparison } from './backtest';
import { QUANTILE_LEVELS, type Horizon, type IsoWeek, type MetricSummary, type QuantileSet } from './types';

/** Traffic-light class of a forecast relative to the seasonal norm. */
export type ActivityLevel = 'normal' | 'elevated' | 'high';

/** Thresholds on the index (median forecast / seasonal norm). Start values, not validated. */
export const ACTIVITY_THRESHOLDS = { elevated: 1.25, high: 1.75 } as const;

export function activityLevel(index: number): ActivityLevel {
  return index >= ACTIVITY_THRESHOLDS.high ? 'high' : index >= ACTIVITY_THRESHOLDS.elevated ? 'elevated' : 'normal';
}

export interface ObservedPoint {
  iso_week: IsoWeek;
  value: number;
}

/** Seasonal norm for one ISO week number: quantiles over clean earlier years. */
export interface NormalPoint {
  week_number: number;
  q10: number;
  q25: number;
  q50: number;
  q75: number;
  q90: number;
}

export interface ForecastHorizon extends QuantileSet {
  /** q50 divided by the seasonal norm median of the target week. */
  index: number;
  level: ActivityLevel;
}

/** forecasts/<region>/latest.json (and archive/<date>.json). */
export interface ForecastFile {
  schema_version: 1;
  region: string;
  level: 'national' | 'bundesland';
  indicator: 'are_consultation_incidence';
  unit: 'per_100k';
  /** ISO date the forecast was issued. */
  issued: string;
  /** ISO date of the data version (as_of) used. */
  data_version: string;
  /** Last observed ISO week that went into the forecast. */
  last_observed_week: IsoWeek;
  model: string;
  /** Model actually shipped after the quality gate: the ensemble or the baseline. */
  gate: { shipped: string; reason: string };
  sources: string[];
  attribution: string;
  observed: ObservedPoint[];
  normal: NormalPoint[];
  horizons: ForecastHorizon[];
}

export interface RegionIndexEntry {
  id: string;
  level: 'national' | 'bundesland';
  name_de: string;
  name_en: string;
  /** Path relative to the forecasts root, e.g. "de-sn/latest.json". */
  file: string;
  last_observed_week: IsoWeek;
  /** h = 1..4 index and class, for the map. */
  summary: { h: Horizon; index: number; level: ActivityLevel; q10: number; q50: number; q90: number; iso_week: IsoWeek }[];
}

/** forecasts/index.json */
export interface ForecastIndex {
  schema_version: 1;
  issued: string;
  data_version: string;
  model: string;
  regions: RegionIndexEntry[];
}

/** forecasts/backtest/test.json: evaluation of the untouched test season (published on the site). */
export interface BacktestPublic {
  generated: string;
  season: string;
  model_choice: { candidate: string; groups: string[]; spread_factor: number; model_weight?: number };
  models: string[];
  overall: Record<string, MetricSummary>;
  by_region: Record<string, Record<string, MetricSummary>>;
  by_horizon: Record<string, Record<string, MetricSummary>>;
  by_phase: Record<string, Record<string, MetricSummary>>;
  comparisons: Record<string, ModelComparison | null>;
  /** Protocol v1 results have n/median/height only; v2 adds the share within one week, ambiguous seasons and a per-horizon split. */
  peak: Record<
    string,
    {
      n: number;
      median_abs_timing_weeks: number;
      mean_height_rel: number;
      within_one_week_share?: number;
      ambiguous?: number;
      by_horizon?: Record<string, { n: number; median_abs_timing_weeks: number; within_one_week_share: number }>;
    }
  >;
  /** Evaluation round: 1 = first protocol (season evaluated once, untouched), 2 = amended protocol (descriptive for that season). */
  protocol_version?: number;
  notes?: string[];
  gate: { shipped: 'ensemble' | 'baseline'; rel_wis_improvement: number | null; threshold: number; reason: string };
}

/** forecasts/backtest/tuning.json */
export interface TuningPublic {
  chosen: { candidate: string; groups: string[]; spread_factor: number; model_weight?: number };
  tuned_on: string[];
  candidates: { name: string; groups: string[]; wis_ensemble: number; wis_model: number; n: number; model_weight?: number; spread_factor?: number }[];
  baseline_wis: number;
  /** seasonal baseline without calendar alignment (protocol v1), for continuity */
  baseline_plain_wis?: number;
  persistence_wis: number;
  spread_grid: { k: number; wis: number; coverage80: number; coverage50: number }[];
}

export function validateForecastFile(f: unknown): string[] {
  const errs: string[] = [];
  const o = f as Partial<ForecastFile> | null;
  if (!o || typeof o !== 'object') return ['not an object'];
  if (o.schema_version !== 1) errs.push('schema_version must be 1');
  for (const k of ['region', 'issued', 'data_version', 'model', 'last_observed_week'] as const) {
    if (typeof o[k] !== 'string' || !o[k]) errs.push(`missing ${k}`);
  }
  if (!Array.isArray(o.sources) || o.sources.length === 0) errs.push('sources must be non-empty');
  if (!Array.isArray(o.horizons) || o.horizons.length === 0) errs.push('horizons must be non-empty');
  else {
    for (const h of o.horizons) {
      const q = QUANTILE_LEVELS.map((l) => (h as unknown as Record<string, number>)[`q${Math.round(l * 100)}`]);
      if (q.some((v) => typeof v !== 'number' || !Number.isFinite(v))) errs.push(`horizon ${h.h}: quantiles missing`);
      else if ([...q].sort((a, b) => a! - b!).some((v, i) => v !== q[i])) errs.push(`horizon ${h.h}: quantiles not ordered`);
    }
  }
  if (!Array.isArray(o.observed) || o.observed.length === 0) errs.push('observed must be non-empty');
  if (!Array.isArray(o.normal) || o.normal.length < 52) errs.push('normal must cover 52 weeks');
  return errs;
}

/** One wastewater treatment plant in forecasts/wastewater.json (/api/v1/wastewater.json). */
export interface WastewaterSiteExport {
  id: string;
  name: string;
  /** federal state region id, e.g. "de-sn" */
  region: string;
  population: number | null;
  /** null when the plant could not be located */
  lat: number | null;
  lon: number | null;
  /** how the position was found: exact name match, population-ranked match, manual, or none */
  geo_match: 'name+state' | 'name+state+population' | 'manual' | 'none';
  /** per pathogen as published by AMELAG, e.g. "SARS-CoV-2", "Influenza A+B", "RSV A+B" */
  pathogens: Record<
    string,
    {
      last_week: IsoWeek;
      /** normalised viral load of the last week */
      value: number;
      /** share (0..1) of the plant's own weekly values since the start of its record that are <= value */
      percentile: number;
      trend: 'up' | 'flat' | 'down';
      /** last 26 weekly values ending at this pathogen's own last_week (plants that stopped keep their last curve), null = missing */
      recent: (number | null)[];
    }
  >;
}

/** forecasts/wastewater.json */
export interface WastewaterExport {
  schema_version: 1;
  /** newest week with any measurement */
  last_week: IsoWeek;
  data_version: string;
  attribution: string;
  sites: WastewaterSiteExport[];
}

/** forecasts/backtest/vintage.json: today's corrected data versus the data versions known at each origin. */
export interface VintagePublic {
  generated: string;
  note: string;
  seasons: Record<
    string,
    {
      seasons: string[];
      origins_total: number;
      origins_vintage: number;
      origins_fallback: number;
      n_cells: number;
      models: Record<string, { final: MetricSummary; vintage: MetricSummary; rel_degradation: number }>;
      comparisons: { final: Record<string, ModelComparison | null>; vintage: Record<string, ModelComparison | null> };
    }
  >;
}

/** forecasts/backtest/external.json: comparison with the RESPINOW-Hub forecast archive (national level). */
export interface ExternalPublic {
  generated: string;
  source: { id: string; name: string; url: string; attribution: string; license: string; license_url: string; retrieved?: string };
  seasons: string[];
  unit_ratio: { ratio: number };
  panels: Record<
    string,
    {
      description: string;
      models: string[];
      n_cells: number;
      n_origins: number;
      cells_by_season: Record<string, number>;
      overall: Record<string, MetricSummary>;
      by_season: Record<string, Record<string, MetricSummary>>;
      by_horizon: Record<string, Record<string, MetricSummary>>;
      comparisons: Record<string, ModelComparison | null>;
    }
  >;
  notes: string[];
}
