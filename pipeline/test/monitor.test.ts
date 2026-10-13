import { addWeeks, makeRng, type ForecastFile, type RegionData } from '@coldfront/forecast-core';
import { describe, expect, it } from 'vitest';
import { loadEvalConfig } from '../src/evaluation';
import { evaluateArchive, type ArchivePiece } from '../src/monitor';

const cfg = loadEvalConfig();

function synthetic(): RegionData {
  const rng = makeRng(5);
  const start = '2022-W40';
  const values = Array.from({ length: 52 * 4 + 20 }, (_, i) => {
    const wk = ((i + 39) % 52) + 1;
    return 1000 * Math.exp(1.2 * Math.cos((2 * Math.PI * (wk - 6)) / 52)) * Math.exp(0.05 * (rng() - 0.5));
  });
  return { region: 'de', target: { start, values }, signals: {} };
}

function archiveWith(origin: string, data: RegionData, bias: number): ArchivePiece {
  const horizons = [1, 2, 3, 4].map((h) => {
    const w = addWeeks(origin, h);
    const idx = (Number(w.slice(0, 4)) - 2022) * 52 + Number(w.slice(6)) - 40;
    const v = (data.target.values[idx] ?? 1000) * bias;
    return { iso_week: w, h: h as 1 | 2 | 3 | 4, q10: v * 0.9, q25: v * 0.95, q50: v, q75: v * 1.05, q90: v * 1.1, index: 1, level: 'normal' as const };
  });
  return { issued: origin, forecasts: { de: { last_observed_week: origin, horizons } as unknown as ForecastFile } };
}

describe('evaluateArchive', () => {
  const data = synthetic();
  const origins = Array.from({ length: 10 }, (_, i) => addWeeks('2025-W30', i));
  it('does not trigger the fallback for a near-perfect shipped model', () => {
    const r = evaluateArchive(origins.map((o) => archiveWith(o, data, 1)), [data], cfg, '2026-10-13');
    expect(r.evaluated_runs).toBe(10);
    expect(r.rel_improvement!).toBeGreaterThan(0);
    expect(r.fallback).toBe(false);
  });
  it('triggers the fallback for a badly biased model after enough runs', () => {
    const r = evaluateArchive(origins.map((o) => archiveWith(o, data, 3)), [data], cfg, '2026-10-13');
    expect(r.rel_improvement!).toBeLessThan(0);
    expect(r.fallback).toBe(true);
  });
  it('waits for the minimum number of runs', () => {
    const r = evaluateArchive(origins.slice(0, 3).map((o) => archiveWith(o, data, 3)), [data], cfg, '2026-10-13');
    expect(r.fallback).toBe(false);
  });
  it('scores nothing when actuals are not known yet', () => {
    const r = evaluateArchive([archiveWith('2027-W30', data, 1)], [data], cfg, '2026-10-13');
    expect(r.n).toBe(0);
    expect(r.rel_improvement).toBeNull();
  });
});
