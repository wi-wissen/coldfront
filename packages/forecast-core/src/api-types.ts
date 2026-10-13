import { QUANTILE_LEVELS, type Horizon, type IsoWeek, type QuantileSet } from './types';

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
