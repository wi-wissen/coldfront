import { describe, expect, it } from 'vitest';
import {
  addWeeks, compareModels, ensemble, persistence, regionalQuantileModel, runBacktest, seasonalBaseline,
  summarizeBy, truncateRegionData, wavePhase, peakErrors, type RegionData,
} from '../src';
import { syntheticRegion } from './helpers';

const START = '2022-W40';
const regions = (): RegionData[] => ['de', 'de-sn', 'de-by'].map((r, i) => syntheticRegion(r, START, 52 * 4, 100 + i, 800 + 300 * i));
const cfg = { name: 'rqm', featureGroups: ['dynamics', 'season', 'holiday'] as const, ridge: 1, minTrainRows: 100, maxIter: 40 };

describe('truncateRegionData', () => {
  it('cuts the target at the origin and signals by their lag, keeps calendar signals', () => {
    const d = regions()[0]!;
    d.signals['wastewater_sars'] = { ...d.target };
    const t = truncateRegionData(d, '2023-W10', { wastewater_sars: 2 });
    expect(addWeeks(t.target.start, t.target.values.length - 1)).toBe('2023-W10');
    const ws = t.signals['wastewater_sars']!;
    expect(addWeeks(ws.start, ws.values.length - 1)).toBe('2023-W08');
    expect(t.signals['holiday']!.values.length).toBe(d.signals['holiday']!.values.length);
  });
});

describe('regionalQuantileModel', () => {
  const origin = '2025-W20';
  const train = regions().map((d) => truncateRegionData(d, origin));

  it('returns ordered, positive quantiles for all horizons', () => {
    const f = regionalQuantileModel(cfg).fit(train, origin).forecast(train[1]!, origin, [1, 2, 3, 4])!;
    expect(f).toHaveLength(4);
    f.forEach((x, i) => {
      expect(x.iso_week).toBe(addWeeks(origin, i + 1));
      const q = [x.q10, x.q25, x.q50, x.q75, x.q90];
      expect(q[0]).toBeGreaterThan(0);
      expect([...q].sort((a, b) => a - b)).toEqual(q);
    });
  });
  it('is deterministic', () => {
    const a = regionalQuantileModel(cfg).fit(train, origin).forecast(train[1]!, origin, [1, 4]);
    const b = regionalQuantileModel(cfg).fit(train, origin).forecast(train[1]!, origin, [1, 4]);
    expect(a).toEqual(b);
  });
  it('does not use data after the origin', () => {
    const full = regions();
    const poisoned = full.map((d) => ({ ...d, target: { ...d.target, values: d.target.values.map((v, i) => (i > 150 ? (v ?? 0) * 50 : v)) } }));
    const f = (data: RegionData[]) => {
      const tr = data.map((d) => truncateRegionData(d, origin));
      return regionalQuantileModel(cfg).fit(tr, origin).forecast(tr[0]!, origin, [2]);
    };
    // index 150 corresponds to 2025-W38 > origin 2025-W20
    expect(f(poisoned)).toEqual(f(full));
  });
  it('returns null when there is not enough training data', () => {
    const early = regions().map((d) => truncateRegionData(d, '2022-W50'));
    expect(regionalQuantileModel(cfg).fit(early, '2022-W50').forecast(early[0]!, '2022-W50', [1])).toBeNull();
  });
  it('beats persistence on a clean seasonal signal (sanity)', () => {
    const origins = Array.from({ length: 20 }, (_, i) => addWeeks('2025-W40', i));
    const rec = runBacktest({
      truth: regions(), origins, evaluateRegions: ['de-sn'], horizons: [2],
      models: [regionalQuantileModel(cfg), persistence()],
    });
    const s = summarizeBy(rec, (r) => r.model);
    expect(s.get('rqm')!.n).toBe(s.get('persistence')!.n);
    expect(s.get('rqm')!.wis).toBeLessThan(s.get('persistence')!.wis);
  });
});

describe('ensemble', () => {
  it('averages quantiles and falls back to the available member', () => {
    const d = regions()[0]!;
    const t = truncateRegionData(d, '2025-W10');
    const base = seasonalBaseline();
    const pers = persistence();
    const e = ensemble('e', [{ member: base, weight: 1 }, { member: pers, weight: 1 }]).forecast(t, '2025-W10', [1])!;
    const a = base.forecast(t, '2025-W10', [1])![0]!;
    const b = pers.forecast(t, '2025-W10', [1])![0]!;
    expect(e[0]!.q50).toBeCloseTo((a.q50 + b.q50) / 2, 8);
    const none = { name: 'none', forecast: () => null };
    expect(ensemble('e2', [{ member: none, weight: 1 }, { member: base, weight: 3 }]).forecast(t, '2025-W10', [1])![0]!.q50).toBeCloseTo(a.q50, 8);
    expect(ensemble('e3', [{ member: none, weight: 1 }]).forecast(t, '2025-W10', [1])).toBeNull();
  });
});

describe('backtest evaluation', () => {
  const origins = Array.from({ length: 30 }, (_, i) => addWeeks('2024-W40', i));
  const rec = runBacktest({
    truth: regions(), origins, evaluateRegions: ['de'], models: [seasonalBaseline(), persistence()], horizons: [1, 2],
  });
  it('only scores weeks with known actuals and common cells', () => {
    expect(rec.length).toBeGreaterThan(0);
    const bm = rec.filter((r) => r.model === 'baseline-seasonal').length;
    expect(rec.filter((r) => r.model === 'persistence').length).toBe(bm);
    for (const r of rec) expect(Number.isFinite(r.actual)).toBe(true);
  });
  it('compares models with a bootstrap CI', () => {
    const c = compareModels(rec, 'baseline-seasonal', 'persistence', { nBoot: 200 })!;
    expect(c.n).toBeGreaterThan(10);
    expect(c.ci95[0]).toBeLessThanOrEqual(c.meanDiff + 1e-9);
    expect(c.ci95[1]).toBeGreaterThanOrEqual(c.meanDiff - 1e-9);
    expect(c.seasonsTotal).toBeGreaterThanOrEqual(1);
    const again = compareModels(rec, 'baseline-seasonal', 'persistence', { nBoot: 200 })!;
    expect(again).toEqual(c);
  });
  it('classifies wave phases', () => {
    const d = regions()[0]!;
    const phases = new Set(Array.from({ length: 52 }, (_, i) => wavePhase(d, addWeeks('2024-W40', i))));
    expect(phases.has('peak')).toBe(true);
    expect(phases.has('low')).toBe(true);
  });
  it('computes peak errors only for complete seasons', () => {
    expect(peakErrors(rec.filter((r) => r.origin < '2025-W05'))).toEqual([]);
    expect(peakErrors(rec).length).toBeGreaterThan(0);
  });
});
