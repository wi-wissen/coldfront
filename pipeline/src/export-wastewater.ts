import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  addWeeks,
  compareWeeks,
  snapshotAt,
  weekRange,
  type IsoWeek,
  type LongRow,
  type WastewaterExport,
  type WastewaterSiteExport,
} from '@coldfront/forecast-core';
import type { WastewaterSite } from './ingest/amelag';
import type { GeoMatch } from './ingest/ww-geo';
import { readLongFile } from './long-table';
import { DATA, FORECASTS, longPath } from './paths';

export const WASTEWATER_ATTRIBUTION =
  'Robert Koch-Institut und Umweltbundesamt, Abwassersurveillance AMELAG, CC BY 4.0; ' +
  'Koordinaten nach GeoNames (CC BY 4.0), Zuordnung über den Ortsnamen, näherungsweise';

/**
 * Pathogen series that are exported, named as published. Sub-type series
 * ("Influenza A", "Influenza B", "RSV A", "RSV B") are left out to keep the file small.
 */
export const EXPORT_PATHOGENS: readonly string[] = ['SARS-CoV-2', 'Influenza A+B', 'RSV A+B', 'RSV A/B'];

/** Number of weeks in `recent`. */
export const RECENT_WEEKS = 26;
/** Trend: relative change within +-10 % counts as flat (start value, unproven). */
export const TREND_BAND = 0.1;
/** Trend uses only values from this many weeks before the pathogen's last week. */
const TREND_WINDOW_WEEKS = 8;

export interface SiteGeoEntry {
  lat: number | null;
  lon: number | null;
  geo_match: GeoMatch;
  geonames_id?: number | null;
  geonames_name?: string | null;
}

const roundTo = (x: number, digits: number): number => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

/**
 * Regression-free trend from the newest available weekly values (oldest first),
 * restricted to the last 8 weeks. With >= 4 values: mean of the last two vs the mean
 * of the two before; with exactly 3: the last value vs the mean of the two before;
 * fewer: 'flat'. Ratio within 0.9..1.1 is 'flat', above 'up', below 'down'.
 * A previous mean of 0 gives 'up' for any positive recent mean, else 'flat'.
 */
export function trendOf(values: readonly number[]): 'up' | 'flat' | 'down' {
  const v = values.slice(-4);
  if (v.length < 3) return 'flat';
  const mean = (a: readonly number[]): number => a.reduce((s, x) => s + x, 0) / a.length;
  const recent = v.length === 4 ? mean(v.slice(2)) : v[2]!;
  const prev = mean(v.slice(0, 2));
  if (prev <= 0) return recent > 0 ? 'up' : 'flat';
  const ratio = recent / prev;
  if (ratio > 1 + TREND_BAND) return 'up';
  if (ratio < 1 - TREND_BAND) return 'down';
  return 'flat';
}

/** Pure export builder. `longRows` must already be one version (see snapshotAt). */
export function buildWastewaterExport(
  longRows: readonly LongRow[],
  sites: readonly WastewaterSite[],
  geo: Readonly<Record<string, SiteGeoEntry>>,
  dataVersion: string,
): WastewaterExport {
  const wanted = new Set(EXPORT_PATHOGENS);
  const byKey = new Map<string, Map<IsoWeek, number>>();
  for (const r of longRows) {
    if (!r.region.startsWith('ww-') || !wanted.has(r.series) || !Number.isFinite(r.value)) continue;
    const k = `${r.region}\u0000${r.series}`;
    const m = byKey.get(k) ?? new Map<IsoWeek, number>();
    m.set(r.week, r.value);
    byKey.set(k, m);
  }

  let globalLast: IsoWeek | null = null;
  for (const m of byKey.values()) {
    for (const w of m.keys()) if (globalLast === null || compareWeeks(w, globalLast) > 0) globalLast = w;
  }
  if (globalLast === null) throw new Error('wastewater export: no measurements');

  const out: WastewaterSiteExport[] = [];
  for (const site of [...sites].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const g = geo[site.id];
    const pathogens: WastewaterSiteExport['pathogens'] = {};
    for (const name of EXPORT_PATHOGENS) {
      if (!site.pathogens.includes(name)) continue;
      const m = byKey.get(`${site.id}\u0000${name}`);
      if (!m || m.size === 0) continue;
      const weeks = [...m.keys()].sort(compareWeeks);
      const last = weeks[weeks.length - 1]!;
      const value = m.get(last)!;
      let le = 0;
      for (const x of m.values()) if (x <= value) le++;
      const near = weeks.filter((w) => compareWeeks(w, addWeeks(last, -TREND_WINDOW_WEEKS)) > 0).map((w) => m.get(w)!);
      pathogens[name] = {
        last_week: last,
        value: roundTo(value, 2),
        percentile: roundTo(le / m.size, 3),
        trend: trendOf(near),
        // The window ends at the plant's own last week, so plants that stopped measuring keep a readable curve.
        recent: weekRange(addWeeks(last, -(RECENT_WEEKS - 1)), last).map((w) => {
          const x = m.get(w);
          return x === undefined ? null : roundTo(x, 2);
        }),
      };
    }
    if (Object.keys(pathogens).length === 0) continue;
    out.push({
      id: site.id,
      name: site.name,
      region: site.region,
      population: site.population,
      lat: g?.lat ?? null,
      lon: g?.lon ?? null,
      geo_match: g?.geo_match ?? 'none',
      pathogens,
    });
  }

  return {
    schema_version: 1,
    last_week: globalLast,
    data_version: dataVersion,
    attribution: WASTEWATER_ATTRIBUTION,
    sites: out,
  };
}

/** Reads the repo files, writes forecasts/wastewater.json (compact) and returns the export. */
export function exportWastewater(dataVersion: string): WastewaterExport {
  const rows = snapshotAt(readLongFile(longPath('amelag')), '9999-12-31');
  const sites = JSON.parse(readFileSync(resolve(DATA, 'external/wastewater-sites.json'), 'utf8')) as WastewaterSite[];
  const geo = JSON.parse(readFileSync(resolve(DATA, 'external/geo/ww-sites-geo.json'), 'utf8')) as Record<string, SiteGeoEntry>;
  const exp = buildWastewaterExport(rows, sites, geo, dataVersion);
  const path = resolve(FORECASTS, 'wastewater.json');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(exp)}\n`);
  return exp;
}
