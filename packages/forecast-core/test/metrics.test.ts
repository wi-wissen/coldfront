import { describe, expect, it } from 'vitest';
import { absoluteError, sortQuantiles, summarize, weightedIntervalScore, type QuantileSet } from '../src';

const f: QuantileSet = { iso_week: '2026-W43', h: 1, q10: 2, q25: 4, q50: 5, q75: 6, q90: 8 };

describe('metrics', () => {
  it('absolute error uses the median', () => {
    expect(absoluteError(f, 8)).toBe(3);
    expect(absoluteError(f, 5)).toBe(0);
  });
  it('WIS inside the bands', () => {
    // (0.5*0 + 0.1*6 + 0.25*2) / 2.5
    expect(weightedIntervalScore(f, 5)).toBeCloseTo(0.44, 10);
  });
  it('WIS above the bands penalises both intervals', () => {
    // IS.2 = 6 + 10*2 = 26, IS.5 = 2 + 4*4 = 18 -> (2.5 + 2.6 + 4.5)/2.5
    expect(weightedIntervalScore(f, 10)).toBeCloseTo(3.84, 10);
  });
  it('WIS is symmetric for a point forecast (reduces to MAE-like)', () => {
    const p: QuantileSet = { ...f, q10: 5, q25: 5, q50: 5, q75: 5, q90: 5 };
    // 0.5*|y-m| + 0.1*(0+10*|y-5|) + 0.25*(0+4*|y-5|) all /2.5, y=7 -> (1+2+2)/2.5
    expect(weightedIntervalScore(p, 7)).toBeCloseTo(2, 10);
  });
  it('fixes quantile crossing by sorting', () => {
    const bad: QuantileSet = { ...f, q10: 6, q25: 4, q50: 5, q75: 3, q90: 8 };
    const g = sortQuantiles(bad);
    expect([g.q10, g.q25, g.q50, g.q75, g.q90]).toEqual([3, 4, 5, 6, 8]);
    expect(g.iso_week).toBe('2026-W43');
  });
  it('summarises mean error and coverage', () => {
    const s = summarize([
      { forecast: f, actual: 5 }, // inside 50 and 80
      { forecast: f, actual: 7 }, // outside 50, inside 80
      { forecast: f, actual: 9 }, // outside both
      { forecast: f, actual: 4.5 }, // inside both
    ]);
    expect(s.n).toBe(4);
    expect(s.coverage50).toBeCloseTo(0.5, 10);
    expect(s.coverage80).toBeCloseTo(0.75, 10);
    expect(s.mae).toBeCloseTo((0 + 2 + 4 + 0.5) / 4, 10);
    expect(() => summarize([])).toThrow();
  });
});
