import { describe, expect, it } from 'vitest';
import { activityLevel, validateForecastFile } from '../src';

describe('api types', () => {
  it('classifies the index', () => {
    expect(activityLevel(1)).toBe('normal');
    expect(activityLevel(1.25)).toBe('elevated');
    expect(activityLevel(2)).toBe('high');
  });
  it('validates a forecast file', () => {
    expect(validateForecastFile(null)).toEqual(['not an object']);
    const normal = Array.from({ length: 52 }, (_, i) => ({ week_number: i + 1, q10: 1, q25: 2, q50: 3, q75: 4, q90: 5 }));
    const ok = {
      schema_version: 1, region: 'de', issued: '2026-10-13', data_version: '2026-10-09', model: 'm', last_observed_week: '2026-W40',
      sources: ['x'], observed: [{ iso_week: '2026-W40', value: 1 }], normal,
      horizons: [{ iso_week: '2026-W41', h: 1, q10: 1, q25: 2, q50: 3, q75: 4, q90: 5, index: 1, level: 'normal' }],
    };
    expect(validateForecastFile(ok)).toEqual([]);
    const bad = { ...ok, horizons: [{ ...ok.horizons[0]!, q25: 9 }] };
    expect(validateForecastFile(bad)).toContain('horizon 1: quantiles not ordered');
  });
});
