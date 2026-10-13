import { describe, expect, it } from 'vitest';
import { addWeeks, empiricalQuantile, persistence, seasonalBaseline, type RegionData, type WeeklySeries } from '../src';

/** Series from 2022-W01 with value = 100 + yearIndex*10 + weekNumber */
function yearly(): WeeklySeries {
  const values: number[] = [];
  let w = '2022-W01';
  for (let i = 0; i < 52 * 4; i++) {
    const [y, wk] = w.split('-W').map(Number) as [number, number];
    values.push(100 + (y - 2022) * 10 + wk);
    w = addWeeks(w, 1);
  }
  return { start: '2022-W01', values };
}
const data = (target: WeeklySeries): RegionData => ({ region: 'de', target, signals: {} });

describe('empiricalQuantile', () => {
  it('interpolates linearly (type 7)', () => {
    expect(empiricalQuantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(empiricalQuantile([1, 2, 3, 4, 5], 0.1)).toBeCloseTo(1.4, 10);
    expect(empiricalQuantile([10], 0.9)).toBe(10);
  });
});

describe('seasonalBaseline', () => {
  const s = yearly();
  // origin 2025-W10: weeks up to 2025-W10 are known
  const known = { ...s, values: s.values.slice(0, 52 * 3 + 10) };
  it('uses same calendar week of earlier years only', () => {
    const f = seasonalBaseline({ windowWeeks: 0 }).forecast(data(known), '2025-W10', [1])!;
    expect(f).toHaveLength(1);
    expect(f[0]!.iso_week).toBe('2025-W11');
    // samples for W11 in 2022,2023,2024: 111,121,131 -> median 121
    expect(f[0]!.q50).toBeCloseTo(121, 6);
    expect(f[0]!.q10).toBeLessThan(f[0]!.q90);
  });
  it('respects the exclusion mask and minSamples', () => {
    const b = seasonalBaseline({ windowWeeks: 0, excludeWeek: (w) => w.startsWith('2022') || w.startsWith('2023') });
    expect(b.forecast(data(known), '2025-W10', [1])).toBeNull();
    const b2 = seasonalBaseline({ windowWeeks: 0, excludeWeek: (w) => w.startsWith('2022'), minSamples: 2 });
    expect(b2.forecast(data(known), '2025-W10', [2])![0]!.q50).toBeCloseTo(127, 6);
  });
  it('never uses information after the origin', () => {
    const a = seasonalBaseline().forecast(data(known), '2025-W10', [1, 2, 3, 4])!;
    const poisoned = { ...known, values: [...known.values.slice(0, 52 * 3 + 5), ...known.values.slice(52 * 3 + 5).map(() => 99999)] };
    const b = seasonalBaseline().forecast(data(poisoned), '2025-W05', [1, 2, 3, 4])!;
    expect(b.every((x) => x.q90 < 99999)).toBe(true);
    expect(a).toHaveLength(4);
  });
  it('returns quantiles in non-decreasing order for all horizons', () => {
    const f = seasonalBaseline().forecast(data(known), '2025-W10', [1, 2, 3, 4])!;
    for (const x of f) expect([x.q10, x.q25, x.q50, x.q75, x.q90]).toEqual([...[x.q10, x.q25, x.q50, x.q75, x.q90]].sort((p, q) => p - q));
  });
});

describe('persistence', () => {
  it('centres on the last value', () => {
    const values = Array.from({ length: 80 }, (_, i) => 100 * Math.exp(0.1 * Math.sin(i / 3)));
    const t: WeeklySeries = { start: '2025-W01', values };
    const f = persistence({ minSamples: 20 }).forecast(data(t), addWeeks('2025-W01', 79), [1, 2])!;
    expect(f).toHaveLength(2);
    const last = values[79]!;
    expect(f[0]!.q10).toBeLessThan(last * 1.3);
    expect(f[0]!.q90).toBeGreaterThan(f[0]!.q10);
    expect(f[1]!.iso_week).toBe(addWeeks('2025-W01', 81));
  });
  it('returns null with too little history', () => {
    const t: WeeklySeries = { start: '2025-W01', values: [1, 2, 3, 4, 5] };
    expect(persistence().forecast(data(t), '2025-W05', [1])).toBeNull();
  });
});
