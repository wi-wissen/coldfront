import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { WastewaterExport, WastewaterSiteExport } from '@coldfront/forecast-core';
import {
  WASTEWATER_STALE_WEEKS,
  isCurrent,
  levelFromPercentile,
  pathogenEntries,
  pathogenRecord,
  percentPoints,
  pointLevel,
  sparkline,
  topByPercentile,
  trendSymbol,
} from '../src/lib/wastewater';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const wastewater = JSON.parse(readFileSync(resolve(REPO, 'forecasts/wastewater.json'), 'utf8')) as WastewaterExport;

type Record = WastewaterSiteExport['pathogens'][string];

function record(last: string, percentile: number, trend: Record['trend'] = 'flat', recent: (number | null)[] = []): Record {
  return { last_week: last as Record['last_week'], value: 100, percentile, trend, recent };
}

function site(id: string, name: string, pathogens: WastewaterSiteExport['pathogens'], region = 'de-sn'): WastewaterSiteExport {
  return { id, name, region, population: null, lat: 51, lon: 13, geo_match: 'name+state', pathogens };
}

describe('levelFromPercentile', () => {
  it('uses low below 0.5, medium from 0.5 to 0.8 inclusive, high above 0.8', () => {
    expect(levelFromPercentile(0)).toBe('low');
    expect(levelFromPercentile(0.499)).toBe('low');
    expect(levelFromPercentile(0.5)).toBe('medium');
    expect(levelFromPercentile(0.8)).toBe('medium');
    expect(levelFromPercentile(0.801)).toBe('high');
    expect(levelFromPercentile(1)).toBe('high');
  });
});

describe('pathogenRecord', () => {
  it('prefers RSV A+B and falls back to RSV A/B per plant', () => {
    const both = site('a', 'A', { 'RSV A+B': record('2026-W40', 0.9), 'RSV A/B': record('2026-W40', 0.1) });
    const onlyAb = site('b', 'B', { 'RSV A/B': record('2026-W40', 0.3) });
    const none = site('c', 'C', { 'SARS-CoV-2': record('2026-W40', 0.2) });
    expect(pathogenRecord(both, 'rsv')?.percentile).toBe(0.9);
    expect(pathogenRecord(onlyAb, 'rsv')?.percentile).toBe(0.3);
    expect(pathogenRecord(none, 'rsv')).toBeNull();
  });

  it('maps SARS-CoV-2 and influenza to their AMELAG names', () => {
    const s = site('a', 'A', { 'SARS-CoV-2': record('2026-W40', 0.4), 'Influenza A+B': record('2026-W40', 0.6) });
    expect(pathogenRecord(s, 'sars')?.percentile).toBe(0.4);
    expect(pathogenRecord(s, 'flu')?.percentile).toBe(0.6);
  });
});

describe('currency and point level', () => {
  it('counts a record as current up to four weeks behind the export week', () => {
    expect(WASTEWATER_STALE_WEEKS).toBe(4);
    expect(isCurrent(record('2026-W36', 0.5), '2026-W40')).toBe(true);
    expect(isCurrent(record('2026-W35', 0.5), '2026-W40')).toBe(false);
    expect(isCurrent(record('2026-W40', 0.5), '2026-W40')).toBe(true);
  });

  it('gives level none for stale records and the percentile level otherwise', () => {
    expect(pointLevel(record('2026-W34', 0.99), '2026-W40')).toBe('none');
    expect(pointLevel(record('2026-W40', 0.99), '2026-W40')).toBe('high');
    expect(pointLevel(record('2026-W40', 0.2), '2026-W40')).toBe('low');
  });
});

describe('topByPercentile and entries', () => {
  const sites = [
    site('x', 'Xanten', { 'SARS-CoV-2': record('2026-W40', 0.7) }),
    site('y', 'Yerlen', { 'SARS-CoV-2': record('2026-W40', 0.9) }),
    site('z', 'Zell', { 'SARS-CoV-2': record('2026-W30', 0.99) }), // stale, must not rank
    site('a', 'Aalen', { 'SARS-CoV-2': record('2026-W40', 0.7) }), // tie with Xanten, name decides
    site('n', 'Nowhere', { 'Influenza A+B': record('2026-W40', 0.5) }),
  ];

  it('ranks current entries by percentile, ties by name, and drops stale ones', () => {
    const entries = pathogenEntries(sites, 'sars', '2026-W40');
    expect(entries.map((e) => e.site.name)).toEqual(['Xanten', 'Yerlen', 'Zell', 'Aalen']);
    const top = topByPercentile(entries, 10);
    expect(top.map((e) => e.site.name)).toEqual(['Yerlen', 'Aalen', 'Xanten']);
  });

  it('limits the result to n', () => {
    const top = topByPercentile(pathogenEntries(sites, 'sars', '2026-W40'), 2);
    expect(top.map((e) => e.site.name)).toEqual(['Yerlen', 'Aalen']);
  });

  it('ranks the real export: top SARS-CoV-2 plant is current and sorted', () => {
    const top = topByPercentile(pathogenEntries(wastewater.sites, 'sars', wastewater.last_week), 10);
    expect(top).toHaveLength(10);
    expect(top[0]!.site.name).toBe('Berchtesgaden');
    expect(percentPoints(top[0]!.record.percentile)).toBe(81);
    for (let i = 1; i < top.length; i += 1) {
      expect(top[i]!.record.percentile).toBeLessThanOrEqual(top[i - 1]!.record.percentile);
      expect(top[i]!.current).toBe(true);
    }
  });
});

describe('trendSymbol and percentPoints', () => {
  it('maps trends to arrows and rounds percentiles to whole percent', () => {
    expect(trendSymbol('up')).toBe('▲');
    expect(trendSymbol('down')).toBe('▼');
    expect(trendSymbol('flat')).toBe('▬');
    expect(percentPoints(0.876)).toBe(88);
    expect(percentPoints(0.062)).toBe(6);
  });
});

describe('sparkline', () => {
  it('returns null without any value', () => {
    expect(sparkline([null, null], 80, 20)).toBeNull();
    expect(sparkline([], 80, 20)).toBeNull();
  });

  it('draws one subpath per run of values and ends at the last value', () => {
    const s = sparkline([1, 2, null, 3, 4, null, null], 80, 20);
    expect(s).not.toBeNull();
    expect(s!.d.match(/M/g)).toHaveLength(2);
    expect(s!.d.match(/L/g)).toHaveLength(2);
    // 7 values, step 76 / 6; last non-null is index 4 (value 4 = max, top padding)
    expect(s!.end).toEqual({ x: 52.67, y: 2 });
  });

  it('keeps the first value at the left edge and the maximum at the top padding', () => {
    const s = sparkline([0, 10], 80, 20);
    expect(s!.d).toBe('M2 18L78 2');
    expect(s!.end).toEqual({ x: 78, y: 2 });
  });

  it('handles a single value without dividing by zero', () => {
    const s = sparkline([5], 80, 20);
    expect(s!.d).toMatch(/^M\d/);
    expect(Number.isFinite(s!.end!.y)).toBe(true);
  });
});
