/** ISO-8601 week label, e.g. "2026-W43". */
export type IsoWeek = string;

/** Forecast horizon in weeks ahead of the origin week. */
export type Horizon = 1 | 2 | 3 | 4;
export const HORIZONS: readonly Horizon[] = [1, 2, 3, 4];

/** Quantile levels of every forecast (Hubverse-style, flat q10..q90 in JSON). */
export const QUANTILE_LEVELS = [0.1, 0.25, 0.5, 0.75, 0.9] as const;
export type QuantileLevel = (typeof QUANTILE_LEVELS)[number];

/** One forecast for one target week. Quantiles are non-decreasing. */
export interface QuantileSet {
  iso_week: IsoWeek;
  h: Horizon;
  q10: number;
  q25: number;
  q50: number;
  q75: number;
  q90: number;
}

/**
 * Dense weekly series: values[i] belongs to addWeeks(start, i).
 * null = missing / not (yet) available.
 */
export interface WeeklySeries {
  start: IsoWeek;
  values: (number | null)[];
}

/** All inputs for one region. `target` is the series that is forecast. */
export interface RegionData {
  region: string;
  /** e.g. ARE consultation incidence per 100k */
  target: WeeklySeries;
  /**
   * Optional additional signals, keyed by name. Known keys used by the regional
   * model: "wastewater_sars", "wastewater_flu", "wastewater_rsv" (normalised load),
   * "tmax", "tmin" (weekly mean of daily extremes, deg C), "holiday" (share 0..1).
   */
  signals: Record<string, WeeklySeries>;
}

/** Publication lag per signal in weeks: at origin t only weeks <= t - lag are known. */
export type AvailabilityLags = Record<string, number>;

/** A forecaster that is already fitted / needs no fitting. */
export interface Forecaster {
  readonly name: string;
  /**
   * Predict `horizons` after `origin`. Must only look at data up to `origin`
   * (series are truncated by the caller; implementations must not peek beyond).
   * Returns null when the model cannot predict (e.g. not enough history).
   */
  forecast(data: RegionData, origin: IsoWeek, horizons: readonly Horizon[]): QuantileSet[] | null;
}

/**
 * Factory for models that learn from data: called once per backtest origin with
 * all regions truncated to what was known at `origin`.
 */
export interface ForecasterFactory {
  readonly name: string;
  fit(training: RegionData[], origin: IsoWeek): Forecaster;
}

/** Row of the append-only long table (data/long/<indicator>.csv.gz). */
export interface LongRow {
  region: string;
  /** Sub series, e.g. pathogen or age group; "" when not applicable. */
  series: string;
  week: IsoWeek;
  value: number;
  /** ISO date (YYYY-MM-DD) when this value was first seen. */
  as_of: string;
}

/** Evaluation metrics of one set of forecasts. */
export interface MetricSummary {
  n: number;
  mae: number;
  wis: number;
  /** share of actuals inside the central 50 % band (q25..q75) */
  coverage50: number;
  /** share of actuals inside the central 80 % band (q10..q90) */
  coverage80: number;
}
