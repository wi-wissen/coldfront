import { describe, expect, it } from 'vitest';
import { appendChanges, seriesFromPoints, seriesGet, truncateSeries, snapshotAt, type LongRow } from '../src';

const row = (week: string, value: number, as_of: string): LongRow => ({ region: 'de', series: '', week, value, as_of });

describe('vintage', () => {
  const rows = [row('2026-W40', 100, '2026-10-01'), row('2026-W40', 110, '2026-10-08'), row('2026-W41', 90, '2026-10-08')];
  it('reconstructs earlier data versions', () => {
    expect(snapshotAt(rows, '2026-10-01').map((r) => r.value)).toEqual([100]);
    expect(snapshotAt(rows, '2026-10-08').map((r) => r.value)).toEqual([110, 90]);
    expect(snapshotAt(rows, '2026-09-30')).toEqual([]);
  });
  it('appends only new or changed values', () => {
    const incoming = [
      { region: 'de', series: '', week: '2026-W40', value: 110 },
      { region: 'de', series: '', week: '2026-W41', value: 95 },
      { region: 'de', series: '', week: '2026-W42', value: 80 },
    ];
    const added = appendChanges(rows, incoming, '2026-10-15');
    expect(added.map((r) => [r.week, r.value, r.as_of])).toEqual([
      ['2026-W41', 95, '2026-10-15'],
      ['2026-W42', 80, '2026-10-15'],
    ]);
  });
});

describe('series', () => {
  it('builds dense series with gaps and truncates', () => {
    const s = seriesFromPoints([
      { week: '2026-W03', value: 3 },
      { week: '2026-W01', value: 1 },
    ]);
    expect(s).toEqual({ start: '2026-W01', values: [1, null, 3] });
    expect(seriesGet(s, '2026-W02')).toBeNull();
    expect(seriesGet(s, '2026-W09')).toBeNull();
    expect(truncateSeries(s, '2026-W02').values).toEqual([1, null]);
    expect(truncateSeries(s, '2025-W50').values).toEqual([]);
  });
});

import { regionByIso2, regionByRkiId, slugify, REGIONS } from '../src';
describe('regions', () => {
  it('has 17 entries with unique ids', () => {
    expect(REGIONS).toHaveLength(17);
    expect(new Set(REGIONS.map((r) => r.id)).size).toBe(17);
  });
  it('looks up by iso2 and rki id', () => {
    expect(regionByIso2('sn')?.id).toBe('de-sn');
    expect(regionByRkiId(14)?.name_de).toBe('Sachsen');
    expect(regionByIso2('')).toBeUndefined();
  });
  it('slugifies umlauts', () => {
    expect(slugify('Würzburg Süd/Nord')).toBe('wuerzburg-sued-nord');
  });
});
