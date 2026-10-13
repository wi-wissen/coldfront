import { addWeeks, snapshotAt, truncateRegionData, weekRange, type BacktestRecord, type EvalConfig, type LongRow, type RegionData } from '@coldfront/forecast-core';
import { describe, expect, it } from 'vitest';
import { rebuildLongRows } from '../src/backfill';
import { loadEvalConfig } from '../src/evaluation';
import { availabilityDate, compareFinalVsVintage, makeDataAtOrigin, originsForSeasons, runVintageComparison } from '../src/vintage-eval';

const cfg = loadEvalConfig();
const W = (i: number) => addWeeks('2026-W01', i);
const date = (i: number) => new Date(Date.UTC(2026, 0, 7 + 7 * i)).toISOString().slice(0, 10);

/** Version i (published on date(i)) contains weeks 0..i+2; the newest two weeks are later raised by 10 %/5 %. */
function makeVersions(extra = 0) {
  return Array.from({ length: 6 }, (_, i) => ({
    asOf: date(i),
    rows: weekRange(W(0), W(i + 2)).flatMap((w, j, all) => {
      const age = all.length - 1 - j;
      const base = 100 + j;
      const v = age === 0 ? base * 0.8 : age === 1 ? base * 0.9 : base;
      return ['de', 'de-sn'].map((region) => ({ region, series: '00+', week: w, value: v + (i === 5 ? extra : 0) }));
    }),
  }));
}
const finalData = (rows: LongRow[]): RegionData[] =>
  ['de', 'de-sn'].map((region) => {
    const s = snapshotAt(rows, '9999-12-31').filter((r) => r.region === region);
    return { region, target: { start: s[0]!.week, values: s.map((r) => r.value) }, signals: { tmax: { start: W(0), values: s.map((_, i) => i) }, wastewater_flu: { start: W(0), values: s.map((_, i) => 10 + i) } } };
  });

describe('availabilityDate', () => {
  const rows = rebuildLongRows(makeVersions());
  it('is the first as_of at which the week exists', () => {
    expect(availabilityDate(rows, 'de', '00+', W(0))).toBe(date(0));
    expect(availabilityDate(rows, 'de', '00+', W(2))).toBe(date(0));
    expect(availabilityDate(rows, 'de', '00+', W(3))).toBe(date(1));
    expect(availabilityDate(rows, 'de', '00+', W(7))).toBe(date(5));
  });
  it('is null for weeks never seen', () => {
    expect(availabilityDate(rows, 'de', '00+', W(8))).toBeNull();
    expect(availabilityDate(rows, 'xx', '00+', W(0))).toBeNull();
  });
});

describe('makeDataAtOrigin', () => {
  const rows = rebuildLongRows(makeVersions());
  const fin = finalData(rows);
  const at = makeDataAtOrigin(rows, fin, cfg);
  it('uses the snapshot at the availability date of the origin week', () => {
    const origin = W(4); // first seen in version 2 (date(2))
    expect(at.info(origin)).toEqual({ kind: 'vintage', asOf: date(2) });
    const de = at(origin).find((d) => d.region === 'de')!;
    const snap = snapshotAt(rows, date(2)).filter((r) => r.region === 'de');
    expect(de.target.values).toEqual(snap.map((r) => r.value));
    // newest week is still the unrevised (low) first publication, final differs
    expect(de.target.values.at(-1)).not.toBe(fin[0]!.target.values[4]);
    expect(de.target.values.at(-1)).toBeCloseTo(104 * 0.8);
  });
  it('takes signals from the final data, truncated with the lags', () => {
    const d = at(W(4)).find((x) => x.region === 'de')!;
    const t = truncateRegionData(fin[0]!, W(4), cfg.availability_lags_weeks);
    expect(d.signals).toEqual(t.signals);
    expect(d.signals['wastewater_flu']!.values).toHaveLength(4); // lag 1
  });
  it('falls back to truncated final data for origins that were never seen', () => {
    const early = addWeeks(W(0), -3);
    expect(at.info(early)).toEqual({ kind: 'fallback', asOf: null });
    expect(at(early)).toEqual(fin.map((d) => truncateRegionData(d, early, cfg.availability_lags_weeks)));
  });
  it('does not leak later versions into earlier origins', () => {
    const changed = rebuildLongRows(makeVersions(7));
    const at2 = makeDataAtOrigin(changed, finalData(changed), cfg);
    for (const o of [W(2), W(3), W(4), W(5)]) {
      expect(at2.info(o)).toEqual(at.info(o));
      expect(at2(o).map((d) => d.target)).toEqual(at(o).map((d) => d.target));
    }
    // the changed (last) version is visible only at the origin that first appears in it
    expect(at2(W(7)).map((d) => d.target)).not.toEqual(at(W(7)).map((d) => d.target));
  });
});

describe('compareFinalVsVintage', () => {
  const rec = (model: string, origin: string, h: 1 | 2 | 3 | 4, mid: number, half: number, actual: number): BacktestRecord => ({
    model, region: 'de', origin, season: '2025/26', actual, phase: 'rise',
    forecast: { iso_week: addWeeks(origin, h), h, q10: mid - 2 * half, q25: mid - half, q50: mid, q75: mid + half, q90: mid + 2 * half },
  });
  it('computes rel_degradation = vintage.wis / final.wis - 1 on common cells only', () => {
    const origins = ['2026-W01', '2026-W02', '2026-W03'];
    const mk = (mid: number) => origins.flatMap((o) => [rec('baseline-seasonal', o, 1, mid, 5, 100), rec('persistence', o, 1, mid, 5, 100), rec('ensemble', o, 1, mid, 5, 100)]);
    const fin = mk(100);
    const vin = [...mk(110), rec('ensemble', '2026-W09', 1, 0, 1, 100)]; // extra cell only in vintage mode
    const out = compareFinalVsVintage(fin, vin, cfg, { baseline: 'baseline-seasonal', persistence: 'persistence', ensemble: 'ensemble' });
    expect(out.n_cells).toBe(3);
    const m = out.models['ensemble']!;
    expect(m.final.n).toBe(3);
    expect(m.vintage.n).toBe(3);
    expect(m.rel_degradation).toBeCloseTo(m.vintage.wis / m.final.wis - 1, 12);
    expect(m.rel_degradation).toBeGreaterThan(0);
    // identical forecasts in both modes -> identical comparison
    expect(out.comparisons.final['ensemble vs baseline']!.meanDiff).toBeCloseTo(0, 12);
    const same = compareFinalVsVintage(fin, fin, cfg, { baseline: 'baseline-seasonal', persistence: 'persistence', ensemble: 'ensemble' });
    expect(same.models['baseline-seasonal']!.rel_degradation).toBe(0);
  });
});

describe('runVintageComparison', () => {
  it('counts fallback origins and runs end to end on a synthetic series', () => {
    // 3 years of a seasonal signal; versions only cover the last season so earlier origins fall back
    const seasonal = (w: string, rev: number) => 100 + 80 * Math.sin((Number(w.slice(-2)) / 52) * 2 * Math.PI) ** 2 + rev;
    const weeks = weekRange('2022-W40', '2025-W20');
    const small: EvalConfig = { ...cfg, pandemic_exclusion: { from: '2000-W01', to: '2000-W02' }, seasons: { ...cfg.seasons, tuning: ['2024/25'] } };
    const versions = Array.from({ length: 4 }, (_, i) => ({
      asOf: `2025-0${i + 1}-15`,
      rows: weeks.map((w) => ({ region: 'de', series: '00+', week: w, value: seasonal(w, 0) })),
    }));
    // make the vintage knowledge start at 2025-W01: drop later weeks from early versions
    const trimmed = versions.map((v, i) => ({ ...v, rows: v.rows.filter((r) => r.week <= `2025-W0${i + 3}`).map((r) => (r.week >= `2025-W0${i + 2}` ? { ...r, value: r.value * 0.9 } : r)) }));
    const rows = rebuildLongRows(trimmed);
    const data: RegionData[] = [{ region: 'de', target: { start: weeks[0]!, values: weeks.map((w) => seasonal(w, 0)) }, signals: {} }];
    const choice = { candidate: 'dyn', groups: ['dynamics' as const], spread_factor: 1.2 };
    const res = runVintageComparison(data, small, choice, { areRows: rows, seasons: ['2024/25'], refitEvery: 4 });
    expect(res.origins_total).toBe(originsForSeasons(['2024/25']).length);
    expect(res.origins_vintage + res.origins_fallback).toBe(res.origins_total);
    expect(res.origins_vintage).toBeGreaterThan(0);
    expect(res.origins_vintage).toBeLessThan(res.origins_total);
    expect(Object.keys(res.models).sort()).toEqual(['baseline-seasonal', 'ensemble', 'persistence']);
    expect(res.n_cells).toBeGreaterThan(0);
    for (const m of Object.values(res.models)) expect(m.rel_degradation).toBeCloseTo(m.vintage.wis / m.final.wis - 1, 12);
  });
});
