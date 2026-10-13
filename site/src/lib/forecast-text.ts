import { type ActivityLevel, type IsoWeek } from '@coldfront/forecast-core';
import { formatNumber } from '../api';
import type { Locale } from '../types';

const LEVEL_SYMBOLS: Record<ActivityLevel, string> = { normal: '●', elevated: '▲', high: '⬆' };

/** Index values within this distance of 1 are described as "about as usual" (start value). */
export const USUAL_BAND = 0.1;

/** Days after which the data version counts as stale on the start page (start value). */
export const STALE_AFTER_DAYS = 9;

/** Display rounding: nearest 10 from 1,000 up, nearest 5 below. Keeps the uncertainty honest. */
export function roundForDisplay(value: number): number {
  const step = Math.abs(value) >= 1000 ? 10 : 5;
  return Math.round(value / step) * step;
}

export function formatCount(value: number, locale: Locale): string {
  return formatNumber(roundForDisplay(value), locale, 0);
}

export function formatIndex(value: number, locale: Locale): string {
  return formatNumber(value, locale, 2);
}

/** Fraction (0.236) to percent text ("23,6 %"; digits defaults to one decimal). */
export function formatPercent(fraction: number, locale: Locale, digits = 1): string {
  return `${formatNumber(fraction * 100, locale, digits)} %`;
}

/** ISO week number of "2026-W41" is 41. Throws on malformed input. */
export function isoWeekNumber(week: IsoWeek): number {
  const m = /^\d{4}-W(\d{2})$/.exec(week);
  if (!m) throw new Error(`invalid ISO week: ${week}`);
  return Number(m[1]);
}

/** Text-safe symbol for an activity level; colour is never the only signal. */
export function levelSymbol(level: ActivityLevel): string {
  return LEVEL_SYMBOLS[level];
}

/** True when the index is close enough to the seasonal norm to read as "as usual". */
export function isAboutUsual(index: number): boolean {
  return Math.abs(index - 1) < USUAL_BAND;
}

/** Whole days from one ISO date (YYYY-MM-DD) to another, UTC based. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** True when the data version is more than `maxDays` days older than `today`. */
export function isStale(dataVersion: string, today: string, maxDays = STALE_AFTER_DAYS): boolean {
  return daysBetween(dataVersion, today) > maxDays;
}
