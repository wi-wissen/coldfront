import { describe, expect, it } from 'vitest';
import { addWeeks, regionDataFromExport, runTest, type EvalConfig, type RegionData, type SeriesExport } from '../src';
import { syntheticRegion } from './helpers';

const cfg: EvalConfig = {
  pandemic_exclusion: { from: '2020-W10', to: '2022-W39' },
  horizons: [1, 2, 3, 4],
  seasons: { tuning: ['2023/24'], test: '2024/25' },
  availability_lags_weeks: { target: 0 },
  models: {
    baseline: { name: 'baseline-seasonal', window_weeks: 1, min_samples: 2 },
    persistence: { name: 'persistence', min_samples: 20 },
    regional: { ridge: 1, min_train_rows: 100, max_iter: 30 },
    ensemble: { model_weight: 0.5, baseline_weight: 0.5 },
    feature_candidates: [{ name: 'dyn-season', groups: ['dynamics', 'season'] }],
    spread_factor_grid: [1, 1.5],
  },
  gate: { reference: 'baseline-seasonal', min_rel_wis_improvement: 0.1 },
  bootstrap: { block_weeks: 4, n: 100, seed: 1 },
};
const data = (): RegionData[] => ['de', 'de-sn', 'de-by'].map((r, i) => syntheticRegion(r, '2022-W40', 52 * 4, 7 + i, 900 + 200 * i));

describe('runTest (shared by pipeline and browser self-check)', () => {
  const choice = { candidate: 'dyn-season', groups: ['dynamics', 'season'] as const, spread_factor: 1.2 };
  it('evaluates one region with progress reporting and sparse refits', () => {
    const calls: number[] = [];
    const res = runTest(data(), cfg, { ...choice, groups: [...choice.groups] }, { evaluateRegions: ['de-sn'], refitEvery: 6, onProgress: (d) => calls.push(d) });
    expect(res.models).toEqual(['baseline-seasonal', 'persistence', 'regional-model', 'ensemble']);
    expect(Object.keys(res.by_region)).toEqual(['de-sn']);
    expect(res.overall['ensemble']!.n).toBeGreaterThan(40);
    expect(res.gate.shipped === 'ensemble' || res.gate.shipped === 'baseline').toBe(true);
    expect(calls.length).toBeGreaterThan(10);
    expect(res.comparisons['ensemble vs baseline-seasonal']).not.toBeNull();
  });
  it('is deterministic', () => {
    const o = { evaluateRegions: ['de'], refitEvery: 8 };
    const c = { ...choice, groups: [...choice.groups] };
    expect(runTest(data(), cfg, c, o)).toEqual(runTest(data(), cfg, c, o));
  });
});

describe('regionDataFromExport', () => {
  it('trims target and signals and keeps the calendar signal long', () => {
    const x: SeriesExport = {
      schema_version: 1,
      start: '2026-W01',
      columns: ['are', 'tmax', 'holiday'],
      regions: { de: { are: [null, 5, 6, null, null], tmax: [1, 2, 3, 4, null], holiday: [0, 0, 1, 1, 1] } },
    };
    const [d] = regionDataFromExport(x);
    expect(d!.target).toEqual({ start: '2026-W02', values: [5, 6] });
    expect(d!.signals['tmax']!.values).toEqual([1, 2, 3, 4]);
    expect(d!.signals['holiday']!.values).toHaveLength(5);
    expect(addWeeks(d!.signals['tmax']!.start, 3)).toBe('2026-W04');
  });
});

describe('runTest onRecords', () => {
  it('hands the scored records to the caller', () => {
    let recs: { model: string }[] = [];
    runTest(data(), cfg, { candidate: 'dyn-season', groups: ['dynamics', 'season'], spread_factor: 1 }, { evaluateRegions: ['de'], refitEvery: 10, onRecords: (r) => (recs = r) });
    expect(new Set(recs.map((r) => r.model))).toEqual(new Set(['baseline-seasonal', 'persistence', 'regional-model', 'ensemble']));
  });
});
