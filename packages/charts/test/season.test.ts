import { describe, expect, it } from 'vitest';
import { buildAxis, seasonIndex, seasonLength, seasonStartYear, splitSeasons } from '../src/season';
import { syntheticObserved } from './fixtures';

describe('season helpers', () => {
  it('assigns weeks 40..53 to their own year and weeks 1..39 to the year before', () => {
    expect(seasonStartYear('2025-W40')).toBe(2025);
    expect(seasonStartYear('2025-W39')).toBe(2024);
    expect(seasonStartYear('2026-W01')).toBe(2025);
  });

  it('uses 52 or 53 points per season depending on the ISO year', () => {
    expect(seasonLength(2025)).toBe(52);
    expect(seasonLength(2020)).toBe(53);
    expect(seasonIndex('2025-W40', 2025)).toBe(0);
    expect(seasonIndex('2026-W39', 2025)).toBe(51);
  });

  it('splits a 53-week season (2020/21) completely into 53 points', () => {
    const observed = syntheticObserved('2020-W40', 53);
    const seasons = splitSeasons(observed);
    expect(seasons).toHaveLength(1);
    const [s] = seasons;
    expect(s!.label).toBe('2020/21');
    expect(s!.points).toHaveLength(53);
    expect(s!.points[0]!.index).toBe(0);
    expect(s!.points[52]!.index).toBe(52);
    expect(s!.points[52]!.iso_week).toBe('2021-W39');
  });

  it('handles the rollover from one season to the next', () => {
    const observed = syntheticObserved('2025-W38', 5); // W38, W39 | W40, W41, W42
    const seasons = splitSeasons(observed);
    expect(seasons.map((s) => s.label)).toEqual(['2024/25', '2025/26']);
    expect(seasons[0]!.points.map((p) => p.iso_week)).toEqual(['2025-W38', '2025-W39']);
    expect(seasons[1]!.points[0]).toMatchObject({ index: 0, iso_week: '2025-W40' });
  });

  it('builds an axis that ends at season end without forecasts beyond it', () => {
    const axis = buildAxis(syntheticObserved('2025-W40', 10), ['2025-W51', '2025-W52']);
    expect(axis).not.toBeNull();
    expect(axis!.startYear).toBe(2025);
    expect(axis!.maxIndex).toBe(51);
    expect(axis!.indexOf('2025-W50')).toBe(10);
    expect(axis!.weekAt(0)).toBe('2025-W40');
  });

  it('extends the axis when a forecast week falls into the next season', () => {
    // 2026 has 53 ISO weeks; 2027-W40 is index 53 on the 2026 season axis.
    const observed = syntheticObserved('2026-W30', 12); // last: 2026-W41
    const axis = buildAxis(observed, ['2026-W42', '2027-W40']);
    expect(axis!.startYear).toBe(2026);
    expect(axis!.maxIndex).toBe(53);
    expect(axis!.indexOf('2027-W40')).toBe(53);
  });

  it('returns no axis and no seasons for empty observations', () => {
    expect(buildAxis([], ['2026-W43'])).toBeNull();
    expect(splitSeasons([])).toEqual([]);
  });
});
