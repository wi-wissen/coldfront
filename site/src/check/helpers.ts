import { HORIZONS, REGIONS, type Horizon } from '@coldfront/forecast-core';

/** Seasons offered on the page: the tuning seasons and the untouched test season. */
export const SEASON_OPTIONS = ['2023/24', '2024/25', '2025/26'] as const;

export interface Selection {
  region: string;
  season: string;
  horizon: number;
}

export type SelectionField = 'region' | 'season' | 'horizon';

/** Returns the invalid fields of a selection (empty = valid). */
export function validateSelection(s: Selection): SelectionField[] {
  const errors: SelectionField[] = [];
  if (!REGIONS.some((r) => r.id === s.region)) errors.push('region');
  if (!(SEASON_OPTIONS as readonly string[]).includes(s.season)) errors.push('season');
  if (!(HORIZONS as readonly number[]).includes(s.horizon)) errors.push('horizon');
  return errors;
}

/** Verdict class and absolute percentage from the relative WIS improvement (null = not computable). */
export function verdictOf(rel: number | null): { kind: 'better' | 'worse' | 'none'; pct: number } {
  if (rel === null || !Number.isFinite(rel)) return { kind: 'none', pct: 0 };
  return { kind: rel >= 0 ? 'better' : 'worse', pct: Math.abs(rel) * 100 };
}

export function isHorizon(v: number): v is Horizon {
  return (HORIZONS as readonly number[]).includes(v);
}

/** Message key suffix of a protocol model name, or null for unknown names. */
export function modelKey(model: string): 'baseline' | 'persistence' | 'regional' | 'ensemble' | null {
  switch (model) {
    case 'baseline-seasonal':
      return 'baseline';
    case 'persistence':
      return 'persistence';
    case 'regional-model':
      return 'regional';
    case 'ensemble':
      return 'ensemble';
    default:
      return null;
  }
}
