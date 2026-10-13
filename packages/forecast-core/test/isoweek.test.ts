import { describe, expect, it } from 'vitest';
import { addWeeks, isoWeeksInYear, parseWeek, seasonOf, weekOfDate, weekRange, weekStart, weeksBetween } from '../src';

describe('isoweek', () => {
  it('knows 53-week years', () => {
    expect(isoWeeksInYear(2020)).toBe(53);
    expect(isoWeeksInYear(2026)).toBe(53);
    expect(isoWeeksInYear(2025)).toBe(52);
    expect(isoWeeksInYear(2024)).toBe(52);
  });
  it('rejects invalid labels', () => {
    expect(() => parseWeek('2025-W53')).toThrow();
    expect(() => parseWeek('2025-5')).toThrow();
    expect(() => parseWeek('2025-W00')).toThrow();
  });
  it('maps dates to weeks around the year boundary', () => {
    expect(weekOfDate(new Date(Date.UTC(2021, 0, 3)))).toBe('2020-W53');
    expect(weekOfDate(new Date(Date.UTC(2021, 0, 4)))).toBe('2021-W01');
    expect(weekOfDate(new Date(Date.UTC(2024, 11, 30)))).toBe('2025-W01');
    expect(weekOfDate(new Date(Date.UTC(2026, 9, 13)))).toBe('2026-W42');
  });
  it('computes week start (Monday)', () => {
    expect(weekStart('2026-W42').toISOString().slice(0, 10)).toBe('2026-10-12');
    expect(weekStart('2021-W01').toISOString().slice(0, 10)).toBe('2021-01-04');
  });
  it('adds and subtracts weeks across years', () => {
    expect(addWeeks('2020-W52', 1)).toBe('2020-W53');
    expect(addWeeks('2020-W53', 1)).toBe('2021-W01');
    expect(addWeeks('2021-W01', -1)).toBe('2020-W53');
    expect(addWeeks('2025-W52', 1)).toBe('2026-W01');
    expect(weeksBetween('2025-W40', '2026-W40')).toBe(52);
    expect(weeksBetween('2026-W40', '2027-W40')).toBe(53);
  });
  it('lists inclusive ranges', () => {
    expect(weekRange('2025-W51', '2026-W02')).toEqual(['2025-W51', '2025-W52', '2026-W01', '2026-W02']);
  });
  it('derives respiratory seasons starting in week 40', () => {
    expect(seasonOf('2025-W40')).toBe('2025/26');
    expect(seasonOf('2026-W39')).toBe('2025/26');
    expect(seasonOf('2026-W40')).toBe('2026/27');
    expect(seasonOf('2099-W45')).toBe('2099/00');
  });
});
