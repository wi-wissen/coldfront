import {
  addWeeks,
  formatWeek,
  isoWeeksInYear,
  parseWeek,
  weeksBetween,
  type IsoWeek,
  type ObservedPoint,
} from '@coldfront/forecast-core';

/** First ISO week of a respiratory season (week 40 .. week 39 of the next year). */
export const SEASON_START_WEEK = 40;

export interface SeasonPoint {
  /** position on the season axis: 0 = week 40 of the season start year */
  index: number;
  iso_week: IsoWeek;
  value: number;
}

export interface Season {
  /** calendar year of week 40, e.g. 2025 for the season "2025/26" */
  startYear: number;
  /** e.g. "2025/26" */
  label: string;
  /** ascending by week */
  points: SeasonPoint[];
}

/** Season start year of an ISO week (week 40 .. 53 belong to the year itself, 1 .. 39 to the year before). */
export function seasonStartYear(w: IsoWeek): number {
  const { year, week } = parseWeek(w);
  return week >= SEASON_START_WEEK ? year : year - 1;
}

export function seasonLabel(startYear: number): string {
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** Week 40 of the season start year, the origin of the season axis. */
export function seasonStartWeek(startYear: number): IsoWeek {
  return formatWeek(startYear, SEASON_START_WEEK);
}

/** Number of weeks from week 40 to week 39 of the next year: 52 or 53. */
export function seasonLength(startYear: number): number {
  return isoWeeksInYear(startYear);
}

/** Position of an ISO week on the axis of the given season (may exceed the season length for later weeks). */
export function seasonIndex(w: IsoWeek, startYear: number = seasonStartYear(w)): number {
  return weeksBetween(seasonStartWeek(startYear), w);
}

/** Splits observed weeks into seasons, sorted by season and by week. */
export function splitSeasons(observed: readonly ObservedPoint[]): Season[] {
  const bySeason = new Map<number, SeasonPoint[]>();
  const sorted = [...observed].sort((a, b) => (a.iso_week < b.iso_week ? -1 : a.iso_week > b.iso_week ? 1 : 0));
  for (const p of sorted) {
    const startYear = seasonStartYear(p.iso_week);
    let points = bySeason.get(startYear);
    if (!points) {
      points = [];
      bySeason.set(startYear, points);
    }
    points.push({ index: seasonIndex(p.iso_week, startYear), iso_week: p.iso_week, value: p.value });
  }
  return [...bySeason.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([startYear, points]) => ({ startYear, label: seasonLabel(startYear), points }));
}

export interface SeasonAxis {
  /** season the chart is drawn for: the season of the last observed week */
  startYear: number;
  /** last x position: season end, or the last forecast week if it lies beyond it */
  maxIndex: number;
  /** x position of any ISO week in the axis frame of the current season */
  indexOf(w: IsoWeek): number;
  /** ISO week at an x position of the axis */
  weekAt(index: number): IsoWeek;
}

/**
 * Builds the x axis for the current season. Returns null without observations.
 * The axis ends at max(season end, last forecast week), so forecasts that fall into
 * the next season continue the axis.
 */
export function buildAxis(observed: readonly ObservedPoint[], forecastWeeks: readonly IsoWeek[]): SeasonAxis | null {
  if (observed.length === 0) return null;
  let last = observed[0]!.iso_week;
  for (const p of observed) if (p.iso_week > last) last = p.iso_week;
  const startYear = seasonStartYear(last);
  const origin = seasonStartWeek(startYear);
  let maxIndex = seasonLength(startYear) - 1;
  for (const w of forecastWeeks) maxIndex = Math.max(maxIndex, seasonIndex(w, startYear));
  return {
    startYear,
    maxIndex,
    indexOf: (w) => seasonIndex(w, startYear),
    weekAt: (index) => addWeeks(origin, index),
  };
}
