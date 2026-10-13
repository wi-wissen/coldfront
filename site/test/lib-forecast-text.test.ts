import { describe, expect, it } from 'vitest';
import { formatCount, formatIndex, formatPercent, isAboutUsual, isStale, isoWeekNumber, levelSymbol, roundForDisplay } from '../src/lib/forecast-text';

describe('roundForDisplay', () => {
  it('rounds to 10 from 1,000 up and to 5 below', () => {
    expect(roundForDisplay(1228.15)).toBe(1230);
    expect(roundForDisplay(1842.45)).toBe(1840);
    expect(roundForDisplay(899.79)).toBe(900);
    expect(roundForDisplay(846.18)).toBe(845);
    expect(roundForDisplay(4.9)).toBe(5);
  });
});

describe('number formatting', () => {
  it('uses the locale separators', () => {
    expect(formatCount(1228.15, 'de')).toBe('1.230');
    expect(formatCount(1228.15, 'en')).toBe('1,230');
    expect(formatIndex(1.03, 'de')).toBe('1,03');
    expect(formatIndex(1.25, 'en')).toBe('1.25');
  });
  it('formats fractions as percent with optional digits', () => {
    expect(formatPercent(0.23608, 'de')).toBe('23,6 %');
    expect(formatPercent(0.1, 'de', 0)).toBe('10 %');
    expect(formatPercent(0.236, 'en')).toBe('23.6 %');
  });
});

describe('weeks and levels', () => {
  it('reads the ISO week number', () => {
    expect(isoWeekNumber('2026-W41')).toBe(41);
    expect(isoWeekNumber('2026-W01')).toBe(1);
    expect(() => isoWeekNumber('2026-41')).toThrow();
  });
  it('gives each level a distinct text-safe symbol', () => {
    expect(levelSymbol('normal')).toBe('●');
    expect(levelSymbol('elevated')).toBe('▲');
    expect(levelSymbol('high')).toBe('⬆');
  });
  it('describes an index within 0.1 of 1 as usual', () => {
    expect(isAboutUsual(1.03)).toBe(true);
    expect(isAboutUsual(0.91)).toBe(true);
    expect(isAboutUsual(1.1)).toBe(false);
    expect(isAboutUsual(1.25)).toBe(false);
  });
});

describe('isStale', () => {
  it('is stale only after more than nine days', () => {
    expect(isStale('2026-10-13', '2026-10-22')).toBe(false);
    expect(isStale('2026-10-13', '2026-10-23')).toBe(true);
    expect(isStale('2026-10-13', '2026-10-13')).toBe(false);
  });
});
