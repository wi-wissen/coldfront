import { addWeeks, parseWeek, weeksBetween } from './isoweek';
import { seriesGet } from './series';
import type { Horizon, IsoWeek, RegionData, WeeklySeries } from './types';

/**
 * Feature groups of the regional model. "dynamics" is mandatory; the others are
 * optional and are switched on only if the backtest shows they help.
 */
export type FeatureGroup = 'dynamics' | 'season' | 'holiday' | 'weather' | 'wastewater';
export const ALL_FEATURE_GROUPS: readonly FeatureGroup[] = ['dynamics', 'season', 'holiday', 'weather', 'wastewater'];

/** Signals that are known in advance and therefore never truncated at the origin. */
export const KNOWN_AHEAD_SIGNALS: readonly string[] = ['holiday'];

export const WASTEWATER_SIGNALS = ['wastewater_sars', 'wastewater_flu', 'wastewater_rsv'] as const;

const NAMES: Record<FeatureGroup, string[]> = {
  dynamics: ['level_vs_year', 'growth_1w', 'growth_2w'],
  season: ['season_sin', 'season_cos'],
  holiday: ['holiday_target_change', 'holiday_origin'],
  weather: ['tmax', 'tmin', 'temp_trend'],
  wastewater: WASTEWATER_SIGNALS.flatMap((s) => [`${s}_level`, `${s}_growth`]),
};

export function featureNames(groups: readonly FeatureGroup[]): string[] {
  return ALL_FEATURE_GROUPS.filter((g) => groups.includes(g)).flatMap((g) => NAMES[g]);
}

function logOrNull(v: number | null): number | null {
  return v !== null && v > 0 ? Math.log(v) : null;
}

/** Natural log of the target at a week, null if missing or not positive. */
export function logTarget(data: RegionData, week: IsoWeek): number | null {
  return logOrNull(seriesGet(data.target, week));
}

function lastKnown(s: WeeklySeries | undefined, origin: IsoWeek, maxBack: number): { week: IsoWeek; value: number } | null {
  if (!s) return null;
  for (let b = 0; b <= maxBack; b++) {
    const w = addWeeks(origin, -b);
    const v = seriesGet(s, w);
    if (v !== null) return { week: w, value: v };
  }
  return null;
}

/**
 * Raw (unstandardised) feature row for predicting `origin + h`. Missing optional
 * inputs become NaN (imputed by the model); returns null if the mandatory
 * dynamics inputs are missing. Reads the signals only at weeks <= origin, except
 * the known-ahead signals.
 */
export function buildFeatureRow(
  data: RegionData,
  origin: IsoWeek,
  h: Horizon,
  groups: readonly FeatureGroup[],
): number[] | null {
  const ly0 = logTarget(data, origin);
  const ly1 = logTarget(data, addWeeks(origin, -1));
  const ly2 = logTarget(data, addWeeks(origin, -2));
  if (ly0 === null || ly1 === null || ly2 === null) return null;
  const target = addWeeks(origin, h);
  const row: number[] = [];
  for (const g of ALL_FEATURE_GROUPS) {
    if (!groups.includes(g)) continue;
    switch (g) {
      case 'dynamics': {
        const hist: number[] = [];
        for (let b = 0; b < 52; b++) {
          const v = logTarget(data, addWeeks(origin, -b));
          if (v !== null) hist.push(v);
        }
        const mean = hist.length >= 26 ? hist.reduce((a, b) => a + b, 0) / hist.length : NaN;
        row.push(ly0 - mean, ly0 - ly1, ly0 - ly2);
        break;
      }
      case 'season': {
        const { week } = parseWeek(target);
        const a = (2 * Math.PI * week) / 52.18;
        row.push(Math.sin(a), Math.cos(a));
        break;
      }
      case 'holiday': {
        const s = data.signals['holiday'];
        const ht = s ? seriesGet(s, target) : null;
        const ho = s ? seriesGet(s, origin) : null;
        row.push(ht !== null && ho !== null ? ht - ho : NaN, ho ?? NaN);
        break;
      }
      case 'weather': {
        const tmax = lastKnown(data.signals['tmax'], origin, 1)?.value ?? NaN;
        const tmin = lastKnown(data.signals['tmin'], origin, 1)?.value ?? NaN;
        const mean = (w: IsoWeek): number => {
          const a = seriesGet(data.signals['tmax'] ?? { start: origin, values: [] }, w);
          const b = seriesGet(data.signals['tmin'] ?? { start: origin, values: [] }, w);
          return a !== null && b !== null ? (a + b) / 2 : NaN;
        };
        row.push(tmax, tmin, mean(origin) - mean(addWeeks(origin, -2)));
        break;
      }
      case 'wastewater': {
        for (const name of WASTEWATER_SIGNALS) {
          const s = data.signals[name];
          const now = lastKnown(s, origin, 3);
          if (!s || !now) {
            row.push(NaN, NaN);
            continue;
          }
          const before = seriesGet(s, addWeeks(now.week, -2));
          const level = Math.log1p(Math.max(now.value, 0));
          row.push(level, before !== null ? level - Math.log1p(Math.max(before, 0)) : NaN);
        }
        break;
      }
    }
  }
  return row;
}

/** Number of weeks the origin lags behind the end of a series (diagnostics). */
export function staleness(s: WeeklySeries, origin: IsoWeek): number {
  const end = addWeeks(s.start, s.values.length - 1);
  return weeksBetween(end, origin);
}
