// Fixtures respinow-*.csv are excerpts (national, total age group, one forecast date) of the RESPINOW-Hub
// forecast archive: RESPINOW-Hub, KITmetricslab (MIT licence), https://github.com/KITmetricslab/RESPINOW-Hub
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { addWeeks, seasonOf, type BacktestRecord, type QuantileSet, type RegionData } from '@coldfront/forecast-core';
import { describe, expect, it } from 'vitest';
import { loadEvalConfig } from '../src/evaluation';
import {
  SOURCE, buildExternalComparison, externalOrigins, parseRespinowSubmission, parseRespinowTruth, toIsoWeek, toQuantileSet, unitRatio,
  type RespinowForecast,
} from '../src/external-compare';

const fx = (n: string) => readFileSync(resolve(__dirname, 'fixtures', n), 'utf8');
const cfg = loadEvalConfig();

describe('SOURCE', () => {
  it('describes the RESPINOW-Hub archive', () => {
    expect(SOURCE.id).toBe('respinow-hub');
    expect(SOURCE.license).toBe('MIT');
    expect(SOURCE.url).toBe('https://github.com/KITmetricslab/RESPINOW-Hub');
    expect(SOURCE.doi).toBe('');
  });
});

describe('parseRespinowSubmission', () => {
  it('keeps national 00+ quantile rows, grouped per horizon (unquoted file with other strata)', () => {
    const f = parseRespinowSubmission(fx('respinow-submission-ensemble.csv'), 'KIT-MeanEnsemble');
    expect(f).toHaveLength(4);
    expect(f.map((x) => x.horizon)).toEqual([1, 2, 3, 4]);
    expect(f[0]).toMatchObject({ model: 'KIT-MeanEnsemble', forecastDate: '2025-01-16', targetEndDate: '2025-01-19' });
    expect(Object.keys(f[0]!.quantiles).map(Number)).toEqual([0.025, 0.1, 0.25, 0.5, 0.75, 0.9, 0.975]);
    expect(f[0]!.quantiles[0.5]).toBeCloseTo(1413617.5036, 3);
  });
  it('handles quoted files and ignores "mean" rows', () => {
    const f = parseRespinowSubmission(fx('respinow-submission-hhh4.csv'), 'KIT-hhh4');
    expect(f).toHaveLength(4);
    expect(f.every((x) => Object.keys(x.quantiles).length === 7)).toBe(true);
    expect(f[0]!.quantiles[0.1]).toBe(946500);
  });
  it('keeps nowcast horizons <= 0 separate from forecasts', () => {
    const f = parseRespinowSubmission(fx('respinow-submission-nowcast.csv'), 'KIT-simple_nowcast');
    expect(f.map((x) => x.horizon).sort((a, b) => a - b)).toEqual([-3, -2, -1, 0]);
    expect(f.some((x) => x.horizon >= 1)).toBe(false);
  });
  it('rejects a file without the required columns', () => {
    expect(() => parseRespinowSubmission('a,b\n1,2\n')).toThrow(/missing column/);
    expect(parseRespinowSubmission('')).toEqual([]);
  });
});

describe('week alignment', () => {
  it('maps Sundays to the ISO week they end', () => {
    expect(toIsoWeek('2025-01-19')).toBe('2025-W03');
    expect(toIsoWeek('2024-12-29')).toBe('2024-W52');
    expect(toIsoWeek('2026-01-04')).toBe('2026-W01');
    expect(toIsoWeek('2021-01-03')).toBe('2020-W53');
    expect(() => toIsoWeek('19.01.2025')).toThrow();
  });
  it('horizon 1 of a Thursday forecast date is the Sunday of the same week = our origin (week - 1) + 1', () => {
    for (const f of parseRespinowSubmission(fx('respinow-submission-ensemble.csv'), 'm')) {
      const week = toIsoWeek(f.forecastDate);
      expect(week).toBe('2025-W03');
      const origin = addWeeks(week, -1);
      expect(toIsoWeek(f.targetEndDate)).toBe(addWeeks(origin, f.horizon));
    }
  });
  it('truth dates carry the labelled year/week and absolute counts', () => {
    const t = parseRespinowTruth(fx('respinow-truth.csv'));
    expect(t.labelMismatches).toBe(0);
    expect(t.counts.size).toBe(13); // DE 00+ only, state rows ignored
    expect(t.counts.get('2024-W48')).toBe(1342684);
  });
});

describe('toQuantileSet', () => {
  const q = { 0.025: 10, 0.1: 100, 0.25: 200, 0.5: 300, 0.75: 400, 0.9: 500, 0.975: 900 };
  it('divides by the ratio and ignores 0.025/0.975', () => {
    expect(toQuantileSet('2025-W03', 1, q, 100)).toEqual({ iso_week: '2025-W03', h: 1, q10: 1, q25: 2, q50: 3, q75: 4, q90: 5 });
  });
  it('repairs quantile crossing and returns null for missing levels', () => {
    expect(toQuantileSet('2025-W03', 2, { ...q, 0.25: 350, 0.5: 300 }, 1)).toMatchObject({ q25: 300, q50: 350 });
    const { 0.9: _drop, ...rest } = q;
    expect(toQuantileSet('2025-W03', 1, rest, 1)).toBeNull();
  });
});

function series(start: string, n: number, f: (i: number) => number): RegionData {
  return { region: 'de', target: { start, values: Array.from({ length: n }, (_, i) => f(i)) }, signals: {} };
}

describe('unitRatio', () => {
  it('uses the median of the last weeks and reports stability', () => {
    const de = series('2024-W40', 20, (i) => 1000 + 10 * i);
    const counts = new Map<string, number>();
    for (let i = 0; i < 20; i++) counts.set(addWeeks('2024-W40', i), (1000 + 10 * i) * 830);
    counts.set(addWeeks('2024-W40', 19), (1000 + 190) * 900); // preliminary outlier in the last week
    const r = unitRatio(counts, de, 10);
    expect(r.ratio).toBeCloseTo(830, 9);
    expect(r.window.n).toBe(10);
    expect(r.max).toBeCloseTo(900, 9);
    expect(r.n_dev_gt_2pct).toBe(1);
    expect(r.all_weeks.n).toBe(20);
  });
  it('throws without overlap', () => {
    expect(() => unitRatio(new Map([['2000-W01', 1]]), series('2024-W40', 3, () => 1))).toThrow();
  });
});

describe('externalOrigins', () => {
  it('uses forecast week - 1 and keeps only origins reaching into the seasons', () => {
    const mk = (fd: string, te: string, h: number): RespinowForecast => ({ model: 'm', forecastDate: fd, horizon: h, targetEndDate: te, quantiles: {} });
    const subs = { m: [mk('2024-07-04', '2024-07-07', 1), mk('2024-09-26', '2024-10-06', 2), mk('2025-01-16', '2025-01-19', 1), mk('2025-01-16', '2025-01-12', 0)] };
    expect(externalOrigins(subs, ['2024/25'])).toEqual(['2024-W38', '2025-W02']);
  });
});

describe('buildExternalComparison', () => {
  // actual incidence per 100k: 1000 in 2025-W01.. growing by 20 per week; counts = 800 * incidence
  const START = '2024-W40';
  const de = series(START, 60, (i) => 1000 + 20 * i);
  const actualOf = (w: string) => de.target.values[[...Array(60).keys()].find((i) => addWeeks(START, i) === w)!]!;
  const counts = new Map<string, number>();
  for (let i = 0; i < 60; i++) counts.set(addWeeks(START, i), actualOf(addWeeks(START, i)) * 800);

  const origins = ['2025-W02', '2025-W03', '2025-W04', '2025-W05'];
  const mkQ = (w: string, h: 1 | 2 | 3 | 4, mid: number, half: number): QuantileSet => ({ iso_week: w, h, q10: mid - 2 * half, q25: mid - half, q50: mid, q75: mid + half, q90: mid + 2 * half });
  const ours = (model: string, bias: number, half: number): BacktestRecord[] =>
    origins.flatMap((o) =>
      ([1, 2, 3, 4] as const).map((h) => {
        const w = addWeeks(o, h);
        return { model, region: 'de', origin: o, season: seasonOf(w), forecast: mkQ(w, h, actualOf(w) + bias, half), actual: actualOf(w), phase: 'rise' as const };
      }),
    );
  const theirs = (model: string, dates: string[], bias: number, half: number): RespinowForecast[] =>
    dates.flatMap((fd) =>
      ([1, 2, 3, 4] as const).map((h) => {
        const w = addWeeks(toIsoWeek(fd), h - 1);
        const mid = (actualOf(w) + bias) * 800;
        const e = half * 800;
        return { model, forecastDate: fd, horizon: h, targetEndDate: weekSunday(w), quantiles: { 0.025: mid - 3 * e, 0.1: mid - 2 * e, 0.25: mid - e, 0.5: mid, 0.75: mid + e, 0.9: mid + 2 * e, 0.975: mid + 3 * e } };
      }),
    );
  // Thursday / Sunday of an ISO week
  const weekSunday = (w: string) => new Date(Date.UTC(2024, 11, 30) + (weekIndex(w) * 7 + 6) * 86400000).toISOString().slice(0, 10);
  const weekThursday = (w: string) => new Date(Date.UTC(2024, 11, 30) + (weekIndex(w) * 7 + 3) * 86400000).toISOString().slice(0, 10);
  const weekIndex = (w: string) => (w >= '2025-W01' ? Number(w.slice(6)) - 1 : -(52 - Number(w.slice(6)) + 1)) + 0; // relative to 2025-W01 (Monday 2024-12-30)

  it('scores all models on identical cells, converts RESPINOW to per 100k and keeps only common cells', () => {
    const fw = origins.map((o) => addWeeks(o, 1)); // forecast weeks W03..W06
    expect(weekThursday('2025-W03')).toBe('2025-01-16');
    const full = theirs('A', fw.map(weekThursday), 0, 10);
    const partial = theirs('B', fw.slice(0, 2).map(weekThursday), 50, 10); // only two forecast dates
    const result = buildExternalComparison({
      submissions: { A: full, B: partial, N: [{ model: 'N', forecastDate: '2025-01-16', horizon: 0, targetEndDate: '2025-01-12', quantiles: {} }] },
      respinowTruth: counts,
      deData: de,
      ourRecords: [...ours('baseline-seasonal', 100, 10), ...ours('persistence', 100, 10), ...ours('ensemble', 20, 10)],
      cfg: { ...cfg, bootstrap: { ...cfg.bootstrap, n: 50 } },
      seasons: ['2024/25'],
      meta: { generated: '2026-10-13' },
    });
    expect(result.unit_ratio.ratio).toBeCloseTo(800, 9);
    expect(result.alignment).toMatchObject({ rows_checked: 24, forecast_date_thursday: 24, target_end_sunday: 24, horizon_aligned: 24, nowcast_rows: 1, nowcast_aligned: 1 });
    expect(result.coverage['respinow:N']!.cells).toBe(0);
    expect(result.coverage['respinow:A']!.cells).toBe(16);
    expect(Object.keys(result.panels)).toEqual(['all', 'vs:respinow:A', 'vs:respinow:B']);
    const all = result.panels['all']!;
    expect(all.models).toEqual(['baseline-seasonal', 'persistence', 'ensemble', 'respinow:A', 'respinow:B']);
    expect(all.n_cells).toBe(8);
    expect(all.n_origins).toBe(2);
    for (const m of all.models) expect(all.overall[m]!.n).toBe(8);
    // A is exact after conversion: MAE 0 and every actual inside the bands
    expect(all.overall['respinow:A']!.mae).toBeCloseTo(0, 9);
    expect(all.overall['respinow:A']!.coverage50).toBe(1);
    expect(all.overall['respinow:B']!.mae).toBeCloseTo(50, 9);
    expect(all.overall['ensemble']!.mae).toBeCloseTo(20, 9);
    expect(all.comparisons['ensemble vs respinow:A']!.relImprovement).toBeLessThan(0);
    expect(all.comparisons['ensemble vs respinow:B']!.relImprovement).toBeGreaterThan(0);
    expect(result.panels['vs:respinow:A']!.n_cells).toBe(16);
    expect(all.respinow_truth.n_cells).toBe(8);
    expect(all.respinow_truth.overall['respinow:A']!.mae).toBeCloseTo(0, 9);
    expect(result.notes.join(' ')).toMatch(/not a fair contest/);
  });
});
