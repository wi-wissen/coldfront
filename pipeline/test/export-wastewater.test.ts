import { describe, expect, it } from 'vitest';
import { addWeeks, type LongRow } from '@coldfront/forecast-core';
import type { WastewaterSite } from '../src/ingest/amelag';
import { buildWastewaterExport, trendOf, WASTEWATER_ATTRIBUTION } from '../src/export-wastewater';

const row = (region: string, series: string, week: string, value: number): LongRow => ({
  region, series, week, value, as_of: '2026-10-13',
});

const site = (id: string, pathogens: string[], last = '2026-W40'): WastewaterSite => ({
  id, name: id.slice(3), region: 'de-sn', population: 1000, first_week: '2026-W01', last_week: last, pathogens,
});

describe('trendOf', () => {
  it('compares the last two against the previous two within +-10 %', () => {
    expect(trendOf([10, 10, 10, 10])).toBe('flat');
    expect(trendOf([10, 10, 10.9, 10.9])).toBe('flat');
    expect(trendOf([10, 10, 12, 12])).toBe('up');
    expect(trendOf([10, 10, 8, 8])).toBe('down');
    expect(trendOf([1, 99, 10, 10, 10, 10])).toBe('flat');
  });
  it('handles three values, few values and zeros', () => {
    expect(trendOf([10, 10, 20])).toBe('up');
    expect(trendOf([10, 20])).toBe('flat');
    expect(trendOf([])).toBe('flat');
    expect(trendOf([0, 0, 0, 0])).toBe('flat');
    expect(trendOf([0, 0, 1, 1])).toBe('up');
    expect(trendOf([5, 5, 0, 0])).toBe('down');
  });
});

describe('buildWastewaterExport', () => {
  const weeks = Array.from({ length: 30 }, (_, i) => addWeeks('2026-W40', i - 29));
  const rows: LongRow[] = [
    ...weeks.map((w, i) => row('ww-a', 'SARS-CoV-2', w, 100 + i)),
    row('ww-a', 'Influenza A+B', '2026-W40', 5.126),
    row('ww-a', 'Influenza A', '2026-W40', 3), // sub-type: not exported
    // plant b stopped two weeks earlier, has a gap
    row('ww-b', 'SARS-CoV-2', '2026-W36', 10),
    row('ww-b', 'SARS-CoV-2', '2026-W37', 30),
    row('ww-b', 'SARS-CoV-2', '2026-W38', 20),
    row('de-sn', 'ww|SARS-CoV-2', '2026-W41', 999), // state-level row: ignored
  ];
  const sites = [
    site('ww-b', ['SARS-CoV-2'], '2026-W38'),
    site('ww-a', ['Influenza A', 'Influenza A+B', 'SARS-CoV-2']),
    site('ww-none', ['SARS-CoV-2']),
  ];
  const geo = { 'ww-a': { lat: 51.1, lon: 13.2, geo_match: 'name+state' as const } };
  const exp = buildWastewaterExport(rows, sites, geo, 'v1');

  it('has the contract header', () => {
    expect(exp.schema_version).toBe(1);
    expect(exp.last_week).toBe('2026-W40');
    expect(exp.data_version).toBe('v1');
    expect(exp.attribution).toBe(WASTEWATER_ATTRIBUTION);
    expect(exp.attribution).toContain('GeoNames (CC BY 4.0)');
  });

  it('sorts sites, drops sites without values, keeps unlocated ones with null coordinates', () => {
    expect(exp.sites.map((s) => s.id)).toEqual(['ww-a', 'ww-b']);
    expect(exp.sites[1]).toMatchObject({ lat: null, lon: null, geo_match: 'none' });
    expect(exp.sites[0]).toMatchObject({ lat: 51.1, lon: 13.2, geo_match: 'name+state' });
  });

  it('exports only measured main pathogens', () => {
    expect(Object.keys(exp.sites[0]!.pathogens).sort()).toEqual(['Influenza A+B', 'SARS-CoV-2']);
  });

  it('computes value, percentile, trend and the aligned 26-week window', () => {
    const p = exp.sites[0]!.pathogens['SARS-CoV-2']!;
    expect(p.last_week).toBe('2026-W40');
    expect(p.value).toBe(129);
    expect(p.percentile).toBe(1);
    expect(p.trend).toBe('flat'); // +1.6 % over the last weeks
    expect(p.recent).toHaveLength(26);
    expect(p.recent[25]).toBe(129);
    expect(p.recent[0]).toBe(104);
    const flu = exp.sites[0]!.pathogens['Influenza A+B']!;
    expect(flu.value).toBe(5.13);
    expect(flu.trend).toBe('flat');
    expect(flu.recent.filter((x) => x === null)).toHaveLength(25);
  });

  it('ends the window of plants that stopped early at their own last week', () => {
    const p = exp.sites[1]!.pathogens['SARS-CoV-2']!;
    expect(p.last_week).toBe('2026-W38');
    expect(p.value).toBe(20);
    expect(p.percentile).toBe(0.667);
    expect(p.recent).toHaveLength(26);
    expect(p.recent.slice(-3)).toEqual([10, 30, 20]);
  });

  it('is JSON-serialisable and stays small', () => {
    expect(JSON.stringify(exp).length).toBeLessThan(20000);
  });

  it('throws without measurements', () => {
    expect(() => buildWastewaterExport([], sites, geo, 'v')).toThrow(/no measurements/);
  });
});
