import {
  HORIZONS, REGIONS, activityLevel, addWeeks, empiricalQuantile, parseWeek, scaleSpreadFactory, seriesGet, validateForecastFile, weekOfDate, weeksBetween, weekRange,
  type ForecastFile, type ForecastHorizon, type ForecastIndex, type IsoWeek, type NormalPoint, type ObservedPoint, type RegionData,
  type RegionIndexEntry,
} from '@coldfront/forecast-core';
import { gzipSync } from 'fflate';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildBaseline, buildChosenEnsemble, isPandemicWeek, loadEvalConfig, type ModelChoice, type TestResult } from './evaluation';
import { readLiveReport } from './monitor';
import { FORECASTS, CONFIG } from './paths';

const SOURCES_USED = [
  'RKI ARE-Konsultationsinzidenz',
  'RKI/UBA Abwassersurveillance AMELAG',
  'DWD Klimadaten (Wochenmittel)',
  'Ferientermine der Bundesländer (KMK)',
];
const ATTRIBUTION =
  'Quelle: Robert Koch-Institut, Umweltbundesamt, Deutscher Wetterdienst; eigene Berechnung (Bearbeitung). Nicht vom RKI, DWD oder anderen genannten Stellen erstellt oder gebilligt.';

/** Seasonal norm per ISO week number over clean earlier years (+-1 week window). */
export function seasonalNorm(data: RegionData, last: IsoWeek, excludeWeek: (w: IsoWeek) => boolean): NormalPoint[] {
  const byWeek: number[][] = Array.from({ length: 53 }, () => []);
  const start = data.target.start;
  for (const w of weekRange(start, last)) {
    if (excludeWeek(w)) continue;
    const v = seriesGet(data.target, w);
    if (v === null) continue;
    const wk = Math.min(parseWeek(w).week, 52);
    for (const d of [-1, 0, 1]) {
      const k = ((wk - 1 + d + 52) % 52) + 1;
      byWeek[k]!.push(v);
    }
  }
  const out: NormalPoint[] = [];
  for (let k = 1; k <= 52; k++) {
    const s = byWeek[k]!.sort((a, b) => a - b);
    if (s.length === 0) throw new Error(`No norm samples for week ${k}`);
    out.push({ week_number: k, q10: r2(empiricalQuantile(s, 0.1)), q25: r2(empiricalQuantile(s, 0.25)), q50: r2(empiricalQuantile(s, 0.5)), q75: r2(empiricalQuantile(s, 0.75)), q90: r2(empiricalQuantile(s, 0.9)) });
  }
  return out;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}
function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value) + '\n');
}

/**
 * Fit the shipped model on all data and write forecasts/<region>/latest.json,
 * forecasts/index.json and the compressed archive piece for this run.
 */
export function runForecast(data: RegionData[], issued: string, dataVersion: string): ForecastIndex {
  const cfg = loadEvalConfig();
  const choice = readJson<{ chosen: ModelChoice }>(resolve(CONFIG, 'model.json')).chosen;
  const gate = readJson<TestResult>(resolve(FORECASTS, 'backtest/test.json')).gate;
  const excl = isPandemicWeek(cfg);

  const national = data.find((d) => d.region === 'de')!;
  const origin = addWeeks(national.target.start, national.target.values.length - 1);
  assertFresh(origin, issued);

  const ens = scaleSpreadFactory(buildChosenEnsemble(cfg, choice, `ensemble-${choice.candidate}`), choice.spread_factor, `ensemble-${choice.candidate}`);
  const fitted = ens.fit(data.map((d) => ({ ...d })), origin);
  const baseline = buildBaseline(cfg);
  // Live safety net: if archived forecasts have been worse than the baseline over enough runs, ship the baseline.
  const live = readLiveReport();
  const fallbackLive = live?.fallback === true;
  const useEnsemble = gate.shipped === 'ensemble' && !fallbackLive;
  const reason = fallbackLive
    ? `Archived forecasts scored worse than the seasonal baseline over ${live!.evaluated_runs} runs; the baseline is shipped.`
    : gate.reason;
  const shipped = useEnsemble ? fitted : baseline;

  const regions: RegionIndexEntry[] = [];
  const archive: Record<string, ForecastFile> = {};
  for (const info of REGIONS) {
    const d = data.find((x) => x.region === info.id);
    if (!d) continue;
    const last = addWeeks(d.target.start, d.target.values.length - 1);
    const fc = shipped.forecast(d, last, HORIZONS) ?? baseline.forecast(d, last, HORIZONS);
    if (!fc) continue;
    const normal = seasonalNorm(d, last, excl);
    const horizons: ForecastHorizon[] = fc.map((f) => {
      const norm = normal.find((n) => n.week_number === Math.min(parseWeek(f.iso_week).week, 52))!;
      const index = f.q50 / norm.q50;
      return { ...f, q10: r2(f.q10), q25: r2(f.q25), q50: r2(f.q50), q75: r2(f.q75), q90: r2(f.q90), index: Math.round(index * 100) / 100, level: activityLevel(index) };
    });
    const observed: ObservedPoint[] = [];
    for (const w of weekRange(d.target.start, last)) {
      const v = seriesGet(d.target, w);
      if (v !== null && !excl(w)) observed.push({ iso_week: w, value: v });
    }
    const file: ForecastFile = {
      schema_version: 1,
      region: info.id,
      level: info.id === 'de' ? 'national' : 'bundesland',
      indicator: 'are_consultation_incidence',
      unit: 'per_100k',
      issued,
      data_version: dataVersion,
      last_observed_week: last,
      model: useEnsemble ? fitted.name : baseline.name,
      gate: { shipped: useEnsemble ? fitted.name : baseline.name, reason },
      sources: SOURCES_USED,
      attribution: ATTRIBUTION,
      observed,
      normal,
      horizons,
    };
    const errors = validateForecastFile(file);
    if (errors.length) throw new Error(`Invalid forecast for ${info.id}: ${errors.join('; ')}`);
    writeJson(resolve(FORECASTS, info.id, 'latest.json'), file);
    archive[info.id] = file;
    regions.push({
      id: info.id,
      level: file.level,
      name_de: info.name_de,
      name_en: info.name_en,
      file: `${info.id}/latest.json`,
      last_observed_week: last,
      summary: horizons.map((h) => ({ h: h.h, index: h.index, level: h.level, q10: h.q10, q50: h.q50, q90: h.q90, iso_week: h.iso_week })),
    });
  }
  const index: ForecastIndex = { schema_version: 1, issued, data_version: dataVersion, model: useEnsemble ? fitted.name : baseline.name, regions };
  writeJson(resolve(FORECASTS, 'index.json'), index);
  const archivePath = resolve(FORECASTS, 'archive', `${issued}.json.gz`);
  mkdirSync(dirname(archivePath), { recursive: true });
  writeFileSync(archivePath, gzipSync(new TextEncoder().encode(JSON.stringify({ issued, forecasts: archive })), { level: 9, mtime: 0 }));
  return index;
}

/**
 * Quality gate on the data: the newest ARE week must be at most `maxWeeks` behind the
 * issue date, otherwise a source stalled and nothing is published.
 */
export function assertFresh(lastObserved: IsoWeek, issued: string, maxWeeks = 3): void {
  const behind = weeksBetween(lastObserved, weekOfDate(new Date(`${issued}T00:00:00Z`)));
  if (behind > maxWeeks) throw new Error(`Data is stale: last ARE week ${lastObserved} is ${behind} weeks behind ${issued}`);
}
