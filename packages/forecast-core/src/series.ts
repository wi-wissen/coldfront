import { addWeeks, weeksBetween } from './isoweek';
import type { IsoWeek, WeeklySeries } from './types';

export function seriesEnd(s: WeeklySeries): IsoWeek {
  return addWeeks(s.start, s.values.length - 1);
}

export function seriesGet(s: WeeklySeries, week: IsoWeek): number | null {
  const i = weeksBetween(s.start, week);
  if (i < 0 || i >= s.values.length) return null;
  return s.values[i] ?? null;
}

/** Build a dense series from sparse points; gaps become null. */
export function seriesFromPoints(points: { week: IsoWeek; value: number }[]): WeeklySeries {
  if (points.length === 0) throw new Error('seriesFromPoints: no points');
  const sorted = [...points].sort((a, b) => (a.week < b.week ? -1 : a.week > b.week ? 1 : 0));
  const start = sorted[0]!.week;
  const n = weeksBetween(start, sorted[sorted.length - 1]!.week) + 1;
  const values: (number | null)[] = new Array(n).fill(null);
  for (const p of sorted) values[weeksBetween(start, p.week)] = p.value;
  return { start, values };
}

/** Series restricted to weeks <= lastWeek (never extends the series). */
export function truncateSeries(s: WeeklySeries, lastWeek: IsoWeek): WeeklySeries {
  const n = weeksBetween(s.start, lastWeek) + 1;
  if (n <= 0) return { start: s.start, values: [] };
  return { start: s.start, values: s.values.slice(0, n) };
}
