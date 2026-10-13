import {
  seriesGet, summarize, truncateRegionData, type ForecastFile, type MetricSummary, type RegionData,
} from '@coldfront/forecast-core';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { gunzipSync } from 'fflate';
import { buildBaseline, type EvalConfig } from './evaluation';
import { FORECASTS } from './paths';

export interface ArchivePiece {
  issued: string;
  forecasts: Record<string, ForecastFile>;
}

export interface LiveReport {
  generated: string;
  /** distinct archived runs with at least one scored week */
  evaluated_runs: number;
  min_runs: number;
  n: number;
  shipped: MetricSummary | null;
  baseline: MetricSummary | null;
  /** 1 - WIS(shipped) / WIS(baseline); null until something is scored */
  rel_improvement: number | null;
  /** true: the shipped model has been worse than the baseline over enough runs -> ship the baseline */
  fallback: boolean;
}

/**
 * Compare archived forecasts with the actuals known today. The baseline is recomputed
 * at each archived origin from the data known then (it is deterministic), so both
 * are scored on identical cells.
 */
export function evaluateArchive(
  archives: readonly ArchivePiece[],
  data: RegionData[],
  cfg: EvalConfig,
  generated: string,
  minRuns = 8,
): LiveReport {
  const baseline = buildBaseline(cfg);
  const shipped: { forecast: ForecastFile['horizons'][number]; actual: number }[] = [];
  const base: { forecast: ForecastFile['horizons'][number]; actual: number }[] = [];
  let runs = 0;
  for (const a of archives) {
    let scored = false;
    for (const [region, file] of Object.entries(a.forecasts)) {
      const d = data.find((x) => x.region === region);
      if (!d) continue;
      const known = truncateRegionData(d, file.last_observed_week, cfg.availability_lags_weeks);
      const b = baseline.forecast(known, file.last_observed_week, [1, 2, 3, 4]);
      for (const h of file.horizons) {
        const actual = seriesGet(d.target, h.iso_week);
        const bh = b?.find((x) => x.h === h.h);
        if (actual === null || !bh) continue;
        shipped.push({ forecast: h, actual });
        base.push({ forecast: { ...h, ...bh }, actual });
        scored = true;
      }
    }
    if (scored) runs++;
  }
  const s = shipped.length ? summarize(shipped) : null;
  const bs = base.length ? summarize(base) : null;
  const rel = s && bs && bs.wis > 0 ? 1 - s.wis / bs.wis : null;
  return { generated, evaluated_runs: runs, min_runs: minRuns, n: shipped.length, shipped: s, baseline: bs, rel_improvement: rel, fallback: runs >= minRuns && rel !== null && rel < 0 };
}

export function readArchive(): ArchivePiece[] {
  const dir = resolve(FORECASTS, 'archive');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json.gz'))
    .sort()
    .map((f) => JSON.parse(new TextDecoder().decode(gunzipSync(readFileSync(resolve(dir, f))))) as ArchivePiece);
}

export function liveReportPath(): string {
  return resolve(FORECASTS, 'backtest/live.json');
}

export function writeLiveReport(r: LiveReport): void {
  mkdirSync(dirname(liveReportPath()), { recursive: true });
  writeFileSync(liveReportPath(), JSON.stringify(r, null, 1) + '\n');
}

export function readLiveReport(): LiveReport | null {
  return existsSync(liveReportPath()) ? (JSON.parse(readFileSync(liveReportPath(), 'utf8')) as LiveReport) : null;
}
