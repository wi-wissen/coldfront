import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { unzipSync } from 'fflate';
import { topology } from 'topojson-server';
import { presimplify, simplify, sphericalTriangleArea } from 'topojson-simplify';
import type { Objects, Topology } from 'topojson-specification';
import { REGIONS, regionByAgs, slugify } from '@coldfront/forecast-core';
import { download } from '../http';
import type { SourceMeta } from '../types';

/** BKG WFS (sgx host; gdz.bkg.bund.de is not reachable from the agent proxy). */
export const VG250_URL =
  'https://sgx.geodatenzentrum.de/wfs_vg250?service=WFS&version=2.0.0&request=GetFeature' +
  '&typeNames=vg250:vg250_lan&outputFormat=application/json&srsName=EPSG:4326';

export const GEONAMES_URL = 'https://download.geonames.org/export/zip/DE.zip';

export const SOURCE_VG250: Omit<SourceMeta, 'retrieved' | 'sha256'> = {
  id: 'bkg-vg250',
  name: 'BKG VG250 Verwaltungsgebiete 1:250 000',
  url: VG250_URL,
  attribution:
    '© GeoBasis-DE / BKG (2026) dl-de/by-2-0; Datenquellen: https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf; Geometrie vereinfacht (bearbeitet)',
  license: 'dl-de/by-2-0',
  license_url: 'https://www.govdata.de/dl-de/by-2-0',
  doi: '',
};

export const SOURCE_GEONAMES: Omit<SourceMeta, 'retrieved' | 'sha256'> = {
  id: 'geonames-plz',
  name: 'GeoNames Postal Codes Germany',
  url: GEONAMES_URL,
  attribution: 'GeoNames, https://www.geonames.org, CC BY 4.0',
  license: 'CC BY 4.0',
  license_url: 'https://creativecommons.org/licenses/by/4.0/',
  doi: '',
};

/** Only land polygons: VG250 geofactor 4 has exactly one feature per state. */
const LAND_GEOFACTOR = 4;

/** Simplification: minimum spherical triangle weight; gives about 116 KB output. */
export const STATES_MIN_WEIGHT = 5e-8;
/** Coordinate quantisation (1e5 steps per transform unit). */
export const STATES_QUANTIZATION = 1e5;

/** Extra admin1 spellings not covered by REGIONS name_de / name_en (slugified keys). */
const ADMIN1_ALIASES: Record<string, string> = {
  'land-berlin': 'de-be',
};

/** Map a GeoNames admin1 name to a state region id; spelling variants are slug-compared. */
export function regionIdForAdmin1(name: string): string | undefined {
  const key = slugify(name.trim());
  const hit = REGIONS.find(
    (r) => r.id !== 'de' && (slugify(r.name_de) === key || slugify(r.name_en) === key),
  );
  return hit?.id ?? ADMIN1_ALIASES[key];
}

export interface StatesTopologyOptions {
  minWeight?: number;
  quantization?: number;
}

/**
 * Build a simplified TopoJSON topology (object "laender", WGS84) from the VG250 WFS
 * GeoJSON. Keeps geofactor-4 land features, one per state AGS.
 */
export function buildStatesTopology(geojson: unknown, options: StatesTopologyOptions = {}): Topology {
  const minWeight = options.minWeight ?? STATES_MIN_WEIGHT;
  const quantization = options.quantization ?? STATES_QUANTIZATION;
  const features: Feature<Geometry>[] = [];
  const seen = new Set<string>();
  for (const f of featuresOf(geojson)) {
    if (f.properties?.gf !== LAND_GEOFACTOR) continue;
    const ags = String(f.properties.ags);
    const region = regionByAgs(ags);
    if (!region || region.id === 'de') throw new Error(`unknown state AGS "${ags}"`);
    if (seen.has(ags)) throw new Error(`duplicate land feature for AGS "${ags}"`);
    seen.add(ags);
    features.push({
      type: 'Feature',
      properties: { id: region.id, ags, name: region.name_de },
      geometry: f.geometry,
    });
  }
  if (features.length === 0) throw new Error('no land features (gf=4) found');

  const collection: FeatureCollection = { type: 'FeatureCollection', features };
  const base = topology({ laender: collection }, quantization) as Topology<Objects<{}>>;
  const pre = presimplify(base, sphericalTriangleArea);
  return simplify(pre, minWeight);
}

function featuresOf(geojson: unknown): Feature[] {
  const fc = geojson as { type?: unknown; features?: unknown } | null;
  if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    throw new Error('expected a GeoJSON FeatureCollection');
  }
  return fc.features as Feature[];
}

/**
 * Parse GeoNames DE.txt (tab-separated, no header) into one entry per postcode:
 * [lat, lon, region id]. Coordinates are averaged over rows; the region is the
 * state of the first row.
 */
export function buildPostcodeIndex(txt: string): Record<string, [number, number, string]> {
  const acc = new Map<string, { lat: number; lon: number; n: number; region: string }>();
  for (const line of txt.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const cols = line.split('\t');
    if (cols.length < 11) throw new Error(`malformed GeoNames row: ${line}`);
    const postal = cols[1] ?? '';
    const admin1 = cols[3] ?? '';
    const lat = Number(cols[9]);
    const lon = Number(cols[10]);
    if (!postal || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error(`malformed GeoNames row: ${line}`);
    }
    const cur = acc.get(postal);
    if (cur) {
      cur.lat += lat;
      cur.lon += lon;
      cur.n += 1;
      continue;
    }
    // Rows without any state (e.g. Jungholz 87491, an Austrian enclave) cannot be mapped.
    if (admin1.trim() === '') continue;
    const region = regionIdForAdmin1(admin1);
    if (!region) throw new Error(`unknown admin1 "${admin1}" for postcode ${postal}`);
    acc.set(postal, { lat, lon, n: 1, region });
  }
  const out: Record<string, [number, number, string]> = {};
  for (const postal of [...acc.keys()].sort()) {
    const e = acc.get(postal)!;
    out[postal] = [round4(e.lat / e.n), round4(e.lon / e.n), e.region];
  }
  return out;
}

function round4(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}

/** Stable text form: sorted keys, one entry per line. */
export function serializePostcodeIndex(index: Record<string, [number, number, string]>): string {
  const lines = Object.keys(index)
    .sort()
    .map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(index[k])}`);
  return `{\n${lines.join(',\n')}\n}\n`;
}

/** Download the VG250 WFS GeoJSON. */
export async function fetchStatesGeoJson(): Promise<{ geojson: unknown; sha256: string }> {
  const { bytes, sha256 } = await download(SOURCE_VG250.url);
  return { geojson: JSON.parse(new TextDecoder('utf-8').decode(bytes)), sha256 };
}

/** Download DE.zip and return the contents of DE.txt. */
export async function fetchGeonamesTxt(): Promise<{ text: string; sha256: string }> {
  const { bytes, sha256 } = await download(SOURCE_GEONAMES.url);
  const entry = unzipSync(bytes)['DE.txt'];
  if (!entry) throw new Error('DE.zip does not contain DE.txt');
  return { text: new TextDecoder('utf-8').decode(entry).replace(/^﻿/, ''), sha256 };
}
