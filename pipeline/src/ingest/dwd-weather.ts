import { unzipSync } from 'fflate';
import {
  BUNDESLAENDER,
  compareWeeks,
  regionById,
  weekOfDate,
  weekStart,
  type IsoWeek,
} from '@coldfront/forecast-core';
import { download, downloadText } from '../http';
import type { NewRow, SourceMeta } from '../types';

export const SOURCE: Omit<SourceMeta, 'retrieved' | 'sha256'> = {
  id: 'dwd-kl',
  name: 'DWD Climate Data Center, daily station observations (kl)',
  url: 'https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/daily/kl/',
  attribution: 'Quelle: Deutscher Wetterdienst; Wochenmittel der Tageswerte (TXK, TNK) aus mehreren Stationen berechnet',
  license: 'CC BY 4.0',
  license_url: 'https://www.dwd.de/copyright',
  doi: '',
};

/** Missing-value marker in DWD product files. */
const MISSING = -999;
/** Minimum valid days per variable for a week to count. */
const MIN_DAYS = 5;

export interface DailyObs {
  /** ISO date YYYY-MM-DD */
  date: string;
  tmax: number | null;
  tmin: number | null;
}

export interface WeeklyValue {
  week: IsoWeek;
  tmax: number;
  tmin: number;
}

export interface StationRef {
  id: string;
  name: string;
}

/** Contents of config/weather-stations.json; keys starting with "_" are notes. */
export type StationConfig = Record<string, StationRef[] | string>;

function parseValue(raw: string | undefined): number | null {
  const s = raw?.trim() ?? '';
  if (s === '') return null;
  const v = Number(s);
  if (!Number.isFinite(v) || v === MISSING) return null;
  return v;
}

/** Parse a "produkt_klima_tag" file: ';'-separated, header row, -999 = missing. */
export function parseDailyProduct(text: string): DailyObs[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const header = lines[0]!.split(';').map((h) => h.trim());
  const iDate = header.indexOf('MESS_DATUM');
  const iMax = header.indexOf('TXK');
  const iMin = header.indexOf('TNK');
  if (iDate < 0 || iMax < 0 || iMin < 0) {
    throw new Error('DWD product file lacks MESS_DATUM, TXK or TNK column');
  }
  const out: DailyObs[] = [];
  for (const line of lines.slice(1)) {
    const f = line.split(';');
    const raw = f[iDate]?.trim() ?? '';
    if (!/^\d{8}$/.test(raw)) throw new Error(`Invalid MESS_DATUM: "${raw}"`);
    out.push({
      date: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`,
      tmax: parseValue(f[iMax]),
      tmin: parseValue(f[iMin]),
    });
  }
  return out;
}

/** Merge historical and recent observations; recent rows replace historical rows of the same date. */
export function mergeDaily(historical: DailyObs[], recent: DailyObs[]): DailyObs[] {
  const byDate = new Map<string, DailyObs>();
  for (const o of historical) byDate.set(o.date, o);
  for (const o of recent) byDate.set(o.date, o);
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function isoWeekOfDate(date: string): IsoWeek {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return weekOfDate(new Date(Date.UTC(y, m - 1, d)));
}

function sundayOf(week: IsoWeek): string {
  const sunday = weekStart(week);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return sunday.toISOString().slice(0, 10);
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Weekly means (ISO weeks). A week is kept only if it is complete (its Sunday is on or
 * before the last observation date) and has at least MIN_DAYS valid values for both
 * tmax and tmin (the output type has no room for a single variable).
 */
export function weeklyFromDaily(obs: DailyObs[]): WeeklyValue[] {
  if (obs.length === 0) return [];
  const lastDate = obs.reduce((m, o) => (o.date > m ? o.date : m), obs[0]!.date);

  const groups = new Map<IsoWeek, { tmax: number[]; tmin: number[] }>();
  for (const o of obs) {
    const week = isoWeekOfDate(o.date);
    let g = groups.get(week);
    if (!g) {
      g = { tmax: [], tmin: [] };
      groups.set(week, g);
    }
    if (o.tmax !== null) g.tmax.push(o.tmax);
    if (o.tmin !== null) g.tmin.push(o.tmin);
  }

  const out: WeeklyValue[] = [];
  for (const week of [...groups.keys()].sort(compareWeeks)) {
    if (sundayOf(week) > lastDate) continue;
    const g = groups.get(week)!;
    if (g.tmax.length < MIN_DAYS || g.tmin.length < MIN_DAYS) continue;
    out.push({ week, tmax: mean(g.tmax), tmin: mean(g.tmin) });
  }
  return out;
}

/** Unweighted mean across stations for every week that at least one station has. */
export function combineStations(perStation: WeeklyValue[][]): WeeklyValue[] {
  const acc = new Map<IsoWeek, { tmax: number[]; tmin: number[] }>();
  for (const station of perStation) {
    for (const w of station) {
      let g = acc.get(w.week);
      if (!g) {
        g = { tmax: [], tmin: [] };
        acc.set(w.week, g);
      }
      g.tmax.push(w.tmax);
      g.tmin.push(w.tmin);
    }
  }
  return [...acc.keys()].sort(compareWeeks).map((week) => {
    const g = acc.get(week)!;
    return { week, tmax: mean(g.tmax), tmin: mean(g.tmin) };
  });
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Two rows per week: series "tmax" and "tmin". */
export function toRows(region: string, weekly: WeeklyValue[]): NewRow[] {
  const rows: NewRow[] = [];
  for (const w of weekly) {
    rows.push({ region, series: 'tmax', week: w.week, value: round2(w.tmax) });
    rows.push({ region, series: 'tmin', week: w.week, value: round2(w.tmin) });
  }
  return rows;
}

// Directory listings are fetched once per process and shared by all stations.
const listingCache = new Map<string, Promise<string[]>>();

function listDirectory(dir: string): Promise<string[]> {
  let cached = listingCache.get(dir);
  if (!cached) {
    cached = downloadText(`${SOURCE.url}${dir}/`).then(({ text }) =>
      [...text.matchAll(/href="([^"?#/]+)"/g)].map((m) => m[1]!),
    );
    cached.catch(() => listingCache.delete(dir));
    listingCache.set(dir, cached);
  }
  return cached;
}

async function readProduct(path: string): Promise<DailyObs[]> {
  const { bytes } = await download(`${SOURCE.url}${path}`);
  const files = unzipSync(bytes);
  const name = Object.keys(files).find((n) => /^produkt_klima_tag_.*\.txt$/.test(n));
  if (!name) throw new Error(`No produkt_klima_tag file in ${path}`);
  return parseDailyProduct(new TextDecoder('latin1').decode(files[name]!));
}

/** Daily observations of one station: historical zip merged with the recent zip. */
export async function fetchStationDaily(stationId: string): Promise<DailyObs[]> {
  if (!/^\d{5}$/.test(stationId)) throw new Error(`Invalid DWD station id: "${stationId}"`);
  const histRe = new RegExp(`^tageswerte_KL_${stationId}_\\d{8}_\\d{8}_hist\\.zip$`);
  const aktRe = new RegExp(`^tageswerte_KL_${stationId}_akt\\.zip$`);

  const histName = (await listDirectory('historical')).find((n) => histRe.test(n));
  const aktName = (await listDirectory('recent')).find((n) => aktRe.test(n));
  if (!histName && !aktName) throw new Error(`No DWD kl zip for station ${stationId}`);

  // Sequential requests, one station at a time.
  const historical = histName ? await readProduct(`historical/${histName}`) : [];
  const recent = aktName ? await readProduct(`recent/${aktName}`) : [];
  return mergeDaily(historical, recent);
}

/** Weekly tmax/tmin rows for every Bundesland in the config plus the national mean ("de"). */
export async function ingestWeather(stations: StationConfig): Promise<NewRow[]> {
  const stateSeries = new Map<string, WeeklyValue[]>();

  for (const [region, refs] of Object.entries(stations)) {
    if (region.startsWith('_')) continue;
    const info = regionById(region);
    if (!info || info.id === 'de') throw new Error(`weather-stations: "${region}" is not a Bundesland`);
    if (!Array.isArray(refs) || refs.length === 0) {
      throw new Error(`weather-stations: "${region}" needs at least one station`);
    }
    const perStation: WeeklyValue[][] = [];
    for (const ref of refs) {
      perStation.push(weeklyFromDaily(await fetchStationDaily(ref.id)));
    }
    stateSeries.set(region, combineStations(perStation));
  }

  const missing = BUNDESLAENDER.filter((r) => !stateSeries.has(r.id)).map((r) => r.id);
  if (missing.length > 0) throw new Error(`weather-stations: missing states ${missing.join(', ')}`);

  const rows: NewRow[] = [];
  for (const r of BUNDESLAENDER) rows.push(...toRows(r.id, stateSeries.get(r.id)!));
  rows.push(...toRows('de', combineStations(BUNDESLAENDER.map((r) => stateSeries.get(r.id)!))));
  return rows;
}
