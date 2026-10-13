import { describe, expect, it } from 'vitest';
import {
  addWeeks, blendRecords, calendarEffect, peakTiming, regionalQuantileModel, runBacktest, seasonalBaseline, truncateRegionData, weekRange,
  type BacktestRecord, type RegionData,
} from '../src';
import { syntheticRegion } from './helpers';

/** Synthetic series whose values carry the care-seeking calendar effect, so a calendar-aware model can explain it. */
function withCalendar(region: string, seed: number): RegionData {
  const d = syntheticRegion(region, '2022-W40', 52 * 4, seed, 900);
  const start = d.target.start;
  const values = d.target.values.map((v, i) => (v === null ? null : v * Math.exp(calendarEffect(addWeeks(start, i), region))));
  return { ...d, target: { start, values } };
}

describe('calendar-aware seasonal baseline', () => {
  it('lowers a Christmas-week forecast relative to the plain baseline', () => {
    const d = syntheticRegion('de-sn', '2022-W40', 52 * 4, 3, 1000);
    const known = truncateRegionData(d, '2025-W49');
    const plain = seasonalBaseline({ windowWeeks: 1 }).forecast(known, '2025-W49', [3])![0]!; // target 2025-W52
    const aligned = seasonalBaseline({ windowWeeks: 1, calendarAlign: true }).forecast(known, '2025-W49', [3])![0]!;
    expect(aligned.iso_week).toBe('2025-W52');
    expect(aligned.q50).toBeLessThan(plain.q50);
  });
  it('does not change forecasts for ordinary weeks', () => {
    const d = syntheticRegion('de-sn', '2022-W40', 52 * 4, 3, 1000);
    // target 2025-W35: no holidays in W34..W36 of any year
    const known = truncateRegionData(d, '2025-W34');
    const plain = seasonalBaseline().forecast(known, '2025-W34', [1])![0]!;
    const aligned = seasonalBaseline({ calendarAlign: true }).forecast(known, '2025-W34', [1])![0]!;
    expect(aligned.q50).toBeCloseTo(plain.q50, 6);
  });
});

describe('calendar-adjusted regional model', () => {
  const truth = ['de', 'de-sn', 'de-by'].map((r, i) => withCalendar(r, 30 + i));
  const cfg = { featureGroups: ['dynamics', 'season'] as ('dynamics' | 'season')[], ridge: 1, minTrainRows: 100, maxIter: 40 };
  it('predicts the between-the-years dip better than the unadjusted model', () => {
    const origins = weekRange('2024-W47', '2024-W51'); // targets reach 2024-W52
    const recs = runBacktest({
      truth,
      origins,
      horizons: [1, 2, 3, 4],
      models: [regionalQuantileModel({ ...cfg, name: 'adj', calendarAdjust: true }), regionalQuantileModel({ ...cfg, name: 'plain' })],
      evaluateRegions: ['de-sn'],
    }).filter((r) => r.forecast.iso_week === '2024-W52');
    expect(recs.length).toBeGreaterThanOrEqual(8);
    const err = (m: string) => {
      const xs = recs.filter((r) => r.model === m).map((r) => Math.abs(Math.log(r.forecast.q50 / r.actual)));
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    expect(err('adj')).toBeLessThan(err('plain'));
  });
});

const rec = (model: string, week: string, h: 1 | 2 | 3 | 4, actual: number, q50: number): BacktestRecord => ({
  model,
  region: 'de',
  origin: addWeeks(week, -h),
  season: '2024/25',
  forecast: { iso_week: week, h, q10: q50 * 0.8, q25: q50 * 0.9, q50, q75: q50 * 1.1, q90: q50 * 1.2 },
  actual,
  phase: 'rise',
});

describe('blendRecords', () => {
  it('quantile-averages two models cell by cell', () => {
    const a = rec('A', '2025-W10', 1, 100, 100);
    const b = rec('B', '2025-W10', 1, 100, 200);
    const [m] = blendRecords([a, b], 'A', 'B', 0.25, 'mix');
    expect(m!.model).toBe('mix');
    expect(m!.forecast.q50).toBeCloseTo(125, 8);
    expect(m!.forecast.q10).toBeCloseTo(0.75 * 80 + 0.25 * 160, 8);
    expect(blendRecords([a], 'A', 'B', 0.5, 'x')).toEqual([]);
  });
});

describe('peakTiming', () => {
  // actual winter curve peaks in 2025-W02; the forecast median lags by `lag` weeks
  const weeks = [...weekRange('2024-W45', '2024-W52'), ...weekRange('2025-W01', '2025-W15')];
  const curve = (peakIdx: number) => weeks.map((_, i) => 1000 - 60 * Math.abs(i - peakIdx));
  const peakAt = weeks.indexOf('2025-W02');
  const mk = (model: string, lag: number) => weeks.map((w, i) => rec(model, w, 1, curve(peakAt)[i]!, curve(peakAt + lag)[i]!));
  it('measures the lag in weeks and the share within one week', () => {
    const t = peakTiming([...mk('lag0', 0), ...mk('lag3', 3)]);
    expect(t['lag0']!['all']!.median_abs_timing_weeks).toBe(0);
    expect(t['lag0']!['all']!.within_one_week_share).toBe(1);
    expect(t['lag3']!['all']!.median_abs_timing_weeks).toBe(3);
    expect(t['lag3']!['all']!.within_one_week_share).toBe(0);
    expect(t['lag3']!['h1']!.n).toBe(1);
  });
  it('ignores the week between the years when locating the peak', () => {
    // a one-week dip at 2024-W52 must not shift the argmax of the smoothed curve
    const spike = weeks.map((w, i) => rec('s', w, 1, w === '2024-W52' ? 5000 : curve(peakAt)[i]!, curve(peakAt)[i]!));
    expect(peakTiming(spike)['s']!['all']!.median_abs_timing_weeks).toBe(0);
  });
  it('needs at least 12 weeks per group', () => {
    expect(peakTiming(mk('x', 0).slice(0, 5))).toEqual({});
  });
});
