import type { IsoWeek } from './types';

const RE = /^(\d{4})-W(\d{2})$/;

export function parseWeek(w: IsoWeek): { year: number; week: number } {
  const m = RE.exec(w);
  if (!m) throw new Error(`Invalid ISO week: ${w}`);
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > isoWeeksInYear(year)) throw new Error(`Invalid ISO week: ${w}`);
  return { year, week };
}

export function formatWeek(year: number, week: number): IsoWeek {
  return `${String(year).padStart(4, '0')}-W${String(week).padStart(2, '0')}`;
}

/** Number of ISO weeks (52 or 53) in an ISO year. */
export function isoWeeksInYear(year: number): number {
  // A year has 53 weeks if 1 Jan is a Thursday, or a leap year and 1 Jan is a Wednesday.
  const jan1 = new Date(Date.UTC(year, 0, 1)).getUTCDay();
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return jan1 === 4 || (leap && jan1 === 3) ? 53 : 52;
}

/** Monday of the given ISO week as UTC date. */
export function weekStart(w: IsoWeek): Date {
  const { year, week } = parseWeek(w);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const monday = new Date(jan4.getTime() - (dow - 1) * 86400000);
  return new Date(monday.getTime() + (week - 1) * 7 * 86400000);
}

/** ISO week containing the given date (UTC interpretation). */
export function weekOfDate(d: Date): IsoWeek {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow); // Thursday of this week decides the year
  const year = t.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7);
  return formatWeek(year, week);
}

const WEEK_MS = 7 * 86400000;
// Mondays are 3 days before the Thursday epoch week boundary; shift so ordinals are integers.
const ORDINAL_SHIFT_MS = 3 * 86400000;
const ordinalCache = new Map<string, number>();
const labelCache = new Map<number, IsoWeek>();

/** Consecutive integer per ISO week (cached; the hot path of the backtest). */
function ordinal(w: IsoWeek): number {
  let o = ordinalCache.get(w);
  if (o === undefined) {
    o = Math.round((weekStart(w).getTime() + ORDINAL_SHIFT_MS) / WEEK_MS);
    ordinalCache.set(w, o);
  }
  return o;
}

function labelOf(o: number): IsoWeek {
  let w = labelCache.get(o);
  if (w === undefined) {
    w = weekOfDate(new Date(o * WEEK_MS - ORDINAL_SHIFT_MS));
    labelCache.set(o, w);
  }
  return w;
}

/** Number of weeks from a to b (b - a); negative if b is earlier. */
export function weeksBetween(a: IsoWeek, b: IsoWeek): number {
  return ordinal(b) - ordinal(a);
}

export function addWeeks(w: IsoWeek, n: number): IsoWeek {
  return labelOf(ordinal(w) + n);
}

export function compareWeeks(a: IsoWeek, b: IsoWeek): number {
  // Lexicographic order equals chronological order for zero-padded labels.
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Inclusive list of weeks from..to. */
export function weekRange(from: IsoWeek, to: IsoWeek): IsoWeek[] {
  const n = weeksBetween(from, to);
  const out: IsoWeek[] = [];
  for (let i = 0; i <= n; i++) out.push(addWeeks(from, i));
  return out;
}

/** Week number within the ISO year (1..53). */
export function weekNumber(w: IsoWeek): number {
  return parseWeek(w).week;
}

/**
 * Season label for the respiratory season starting in week 40, e.g. "2025/26"
 * for 2025-W40 .. 2026-W39.
 */
export function seasonOf(w: IsoWeek): string {
  const { year, week } = parseWeek(w);
  const start = week >= 40 ? year : year - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`;
}
