import { weekOfDate, weekStart } from './isoweek';
import type { IsoWeek } from './types';

/**
 * Care-seeking calendar of Germany. ARE counts doctor consultations, so every closed weekday
 * removes visits without catch-up (each closed weekday multiplies the week by about 0.81) and the
 * week between Christmas and New Year is depressed beyond what its holidays explain. Pure functions
 * of the ISO week label; estimated on national ARE before 2023-W36 only (see CLAUDE.md, protocol v2).
 */

const DAY = 86400000;

/** Easter Sunday (Gregorian), anonymous algorithm (Meeus/Jones/Butcher), as a UTC date. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const key = (d: Date) => d.toISOString().slice(0, 10);
const nationalCache = new Map<number, Map<string, number>>();

/** date (YYYY-MM-DD) -> closure weight of nationwide holidays: 1, and 0.5 for 24 and 31 December. */
function nationalHolidays(year: number): Map<string, number> {
  let m = nationalCache.get(year);
  if (m) return m;
  const e = easterSunday(year).getTime();
  m = new Map();
  const full = [
    Date.UTC(year, 0, 1), // New Year
    e - 2 * DAY, // Good Friday
    e + DAY, // Easter Monday
    Date.UTC(year, 4, 1), // 1 May
    e + 39 * DAY, // Ascension
    e + 50 * DAY, // Whit Monday
    Date.UTC(year, 9, 3), // German Unity Day
    Date.UTC(year, 11, 25),
    Date.UTC(year, 11, 26),
  ];
  for (const t of full) m.set(key(new Date(t)), 1);
  if (year === 2017) m.set('2017-10-31', 1); // one-off nationwide Reformation Day
  m.set(key(new Date(Date.UTC(year, 11, 24))), 0.5);
  m.set(key(new Date(Date.UTC(year, 11, 31))), 0.5);
  nationalCache.set(year, m);
  return m;
}

/** Approximate state populations in millions (rounded, only used as weights for the national mean). */
const POPULATION_WEIGHT: Record<string, number> = {
  'de-bw': 11.28, 'de-by': 13.37, 'de-be': 3.88, 'de-bb': 2.57, 'de-hb': 0.7, 'de-hh': 1.91, 'de-he': 6.39, 'de-mv': 1.63,
  'de-ni': 8.14, 'de-nw': 18.19, 'de-rp': 4.16, 'de-sl': 0.99, 'de-sn': 4.09, 'de-st': 2.17, 'de-sh': 2.96, 'de-th': 2.13,
};

/** State-specific public holidays as YYYY-MM-DD dates of the given year. */
function stateHolidays(year: number, region: string): string[] {
  const e = easterSunday(year).getTime();
  const d = (month: number, day: number) => key(new Date(Date.UTC(year, month - 1, day)));
  const r = region.slice(3);
  const out: string[] = [];
  if (['bw', 'by', 'st'].includes(r)) out.push(d(1, 6)); // Epiphany
  if ((r === 'be' && year >= 2019) || (r === 'mv' && year >= 2023)) out.push(d(3, 8)); // Women's Day
  if (r === 'be' && (year === 2020 || year === 2025)) out.push(d(5, 8)); // one-off anniversary
  if (['bw', 'by', 'he', 'nw', 'rp', 'sl'].includes(r)) out.push(key(new Date(e + 60 * DAY))); // Corpus Christi
  if (['sl', 'by'].includes(r)) out.push(d(8, 15)); // Assumption
  if (r === 'th' && year >= 2019) out.push(d(9, 20)); // World Children's Day
  if (['bb', 'mv', 'sn', 'st', 'th'].includes(r) || (['hb', 'hh', 'ni', 'sh'].includes(r) && year >= 2018)) out.push(d(10, 31)); // Reformation Day
  if (['bw', 'by', 'nw', 'rp', 'sl'].includes(r)) out.push(d(11, 1)); // All Saints
  if (r === 'sn') {
    // Repentance Day: the Wednesday before 23 November
    let t = Date.UTC(year, 10, 22);
    while (new Date(t).getUTCDay() !== 3) t -= DAY;
    out.push(key(new Date(t)));
  }
  return out;
}

function stateShare(week: IsoWeek, region: string): number {
  const monday = weekStart(week).getTime();
  let s = 0;
  for (let i = 0; i < 5; i++) {
    const day = new Date(monday + i * DAY);
    const y = day.getUTCFullYear();
    const k = key(day);
    const nat = nationalHolidays(y).get(k) ?? 0;
    const reg = region !== 'de' && stateHolidays(y, region).includes(k) ? 1 : 0;
    s += Math.max(nat, reg);
  }
  return s / 5;
}

const closedCache = new Map<string, number>();

/**
 * Share (0..1) of the Mon-Fri weekdays of an ISO week that are public holidays (24 and 31 December
 * count half). `region` is "de" (population-weighted mean over the 16 states) or a state id.
 */
export function closedShare(week: IsoWeek, region = 'de'): number {
  const ck = `${region}|${week}`;
  let v = closedCache.get(ck);
  if (v !== undefined) return v;
  if (region === 'de' || POPULATION_WEIGHT[region] === undefined) {
    let s = 0;
    let n = 0;
    for (const [r, p] of Object.entries(POPULATION_WEIGHT)) {
      s += p * stateShare(week, r);
      n += p;
    }
    v = s / n;
  } else v = stateShare(week, region);
  closedCache.set(ck, v);
  return v;
}

/** 1 for the ISO week that contains 28 December ("between the years"), else 0. */
export function betweenYearsWeek(week: IsoWeek): number {
  const year = Number(week.slice(0, 4));
  return weekOfDate(new Date(Date.UTC(year, 11, 28))) === week ? 1 : 0;
}

/** Fixed log effects, fitted on national ARE before 2023-W36 only (residual sd 0.10, n = 73 weeks). */
export const CALENDAR_BETA_CLOSED = -1.175;
export const CALENDAR_GAMMA_BETWEEN_YEARS = -0.356;

/** Log calendar effect of a week on ARE consultations (<= 0). */
export function calendarEffect(week: IsoWeek, region = 'de'): number {
  return CALENDAR_BETA_CLOSED * closedShare(week, region) + CALENDAR_GAMMA_BETWEEN_YEARS * betweenYearsWeek(week);
}
