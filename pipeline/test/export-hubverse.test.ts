import type { ForecastFile } from '@coldfront/forecast-core';
import { describe, expect, it } from 'vitest';
import { HUBVERSE_HEADER, hubLocation, hubverseCsv, saturdayOf } from '../src/export-hubverse';

const file = (region: string): ForecastFile =>
  ({
    region,
    last_observed_week: '2026-W40',
    horizons: [1, 2].map((h) => ({ iso_week: `2026-W4${h}`, h, q10: 1, q25: 2, q50: 3, q75: 4, q90: 5, index: 1, level: 'normal' })),
  }) as unknown as ForecastFile;

describe('hubverse export', () => {
  it('uses Saturdays and ISO location codes', () => {
    expect(saturdayOf('2026-W40')).toBe('2026-10-03');
    expect(saturdayOf('2026-W41')).toBe('2026-10-10');
    expect(hubLocation('de')).toBe('DE');
    expect(hubLocation('de-sn')).toBe('DE-SN');
    expect(() => hubLocation('xx')).toThrow();
  });
  it('writes one row per horizon and quantile level', () => {
    const lines = hubverseCsv([file('de'), file('de-sn')]).trim().split('\n');
    expect(lines[0]).toBe(HUBVERSE_HEADER);
    expect(lines).toHaveLength(1 + 2 * 2 * 5);
    expect(lines[1]).toBe('2026-10-03,are_consultation_incidence_per_100k,1,2026-10-10,DE,quantile,0.1,1');
    expect(lines[10]).toBe('2026-10-03,are_consultation_incidence_per_100k,2,2026-10-17,DE,quantile,0.9,5');
    expect(lines[11]).toContain(',DE-SN,quantile,0.1,1');
  });
});
