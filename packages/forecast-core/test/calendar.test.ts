import { describe, expect, it } from 'vitest';
import { betweenYearsWeek, calendarEffect, closedShare, easterSunday } from '../src';

describe('calendar', () => {
  it('computes Easter Sunday', () => {
    expect(easterSunday(2024).toISOString().slice(0, 10)).toBe('2024-03-31');
    expect(easterSunday(2025).toISOString().slice(0, 10)).toBe('2025-04-20');
    expect(easterSunday(2026).toISOString().slice(0, 10)).toBe('2026-04-05');
    expect(easterSunday(2019).toISOString().slice(0, 10)).toBe('2019-04-21');
  });
  it('marks the week between the years (ISO week of 28 December)', () => {
    expect(betweenYearsWeek('2024-W52')).toBe(1);
    expect(betweenYearsWeek('2020-W53')).toBe(1);
    expect(betweenYearsWeek('2020-W52')).toBe(0);
    expect(betweenYearsWeek('2025-W01')).toBe(0);
  });
  it('counts closed weekdays nationwide', () => {
    // 2025-W52: Mon 22 Dec .. Fri 26 Dec -> 24 Dec half, 25 and 26 Dec full = 2.5 / 5
    expect(closedShare('2025-W52', 'de-sn')).toBeCloseTo(0.5, 10);
    // Easter 2026: Good Friday 3 Apr (W14) -> 1/5
    expect(closedShare('2026-W14', 'de-sn')).toBeCloseTo(0.2, 10);
    expect(closedShare('2026-W18', 'de-sn')).toBeCloseTo(0.2, 10); // Fri 1 May
  });
  it('adds state holidays only for the states that have them', () => {
    // Corpus Christi 2025: Thu 19 Jun (W25): holiday in NW, not in SN
    expect(closedShare('2025-W25', 'de-nw')).toBeCloseTo(0.2, 10);
    expect(closedShare('2025-W25', 'de-sn')).toBe(0);
    // Repentance Day 2024: Wed 20 Nov (W47) only in Saxony
    expect(closedShare('2024-W47', 'de-sn')).toBeCloseTo(0.2, 10);
    expect(closedShare('2024-W47', 'de-by')).toBe(0);
  });
  it('uses a population-weighted mean for the national level', () => {
    const nat = closedShare('2025-W25', 'de');
    expect(nat).toBeGreaterThan(0);
    expect(nat).toBeLessThan(0.2);
  });
  it('has a negative calendar effect that is larger for the Christmas week', () => {
    expect(calendarEffect('2025-W20', 'de-sn')).toBeCloseTo(0, 10);
    expect(calendarEffect('2025-W52', 'de-sn')).toBeLessThan(calendarEffect('2025-W14', 'de-sn'));
    expect(Math.exp(calendarEffect('2025-W52', 'de-sn'))).toBeLessThan(0.45);
  });
});
