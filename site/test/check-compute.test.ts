// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { EvalConfig, ModelChoice, SeriesExport } from '@coldfront/forecast-core';
import { computeCheck } from '../src/check/compute';

const FORECASTS = resolve(import.meta.dirname, '../../forecasts');
const read = <T>(rel: string): T => JSON.parse(readFileSync(resolve(FORECASTS, rel), 'utf8')) as T;

const series = read<SeriesExport>('series.json');
const cfg = read<EvalConfig>('backtest/evaluation.json');
const choice = read<{ chosen: ModelChoice }>('backtest/model.json').chosen;

describe('computeCheck on the published inputs', () => {
  it('computes de-sn for 2024/25 and horizon 2 with all models', () => {
    const r = computeCheck(series, cfg, choice, 'de-sn', '2024/25', 2);
    expect(r.models).toEqual(['baseline-seasonal', 'persistence', 'regional-model', 'ensemble']);
    for (const m of r.models) {
      const s = r.metrics[m]!;
      expect(s.n).toBeGreaterThan(40);
      expect(Number.isFinite(s.wis)).toBe(true);
      expect(Number.isFinite(s.mae)).toBe(true);
    }
    expect(r.metrics['ensemble']!.n).toBe(r.chart.length);
    expect(Number.isFinite(r.improvementVsBaseline!)).toBe(true);
    expect(r.chart.every((p) => p.q10 <= p.q50 && p.q50 <= p.q90)).toBe(true);
    expect(r.computeMs).toBeLessThan(60_000);
  }, 120_000);

  it('is deterministic across two runs', () => {
    const a = computeCheck(series, cfg, choice, 'de-sn', '2024/25', 1);
    const b = computeCheck(series, cfg, choice, 'de-sn', '2024/25', 1);
    const strip = ({ computeMs: _c, ...rest }: typeof a) => rest;
    expect(strip(a)).toEqual(strip(b));
  }, 120_000);

  it('reports progress over all origins', () => {
    const calls: [number, number][] = [];
    computeCheck(series, cfg, choice, 'de-sn', '2025/26', 4, (d, t) => calls.push([d, t]), 8);
    expect(calls.length).toBeGreaterThan(10);
    expect(calls[0]![0]).toBe(0);
    expect(calls.every(([d, t]) => d < t)).toBe(true);
  }, 120_000);
});
