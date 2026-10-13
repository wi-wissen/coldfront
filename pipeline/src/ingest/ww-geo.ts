import { unzipSync } from 'fflate';
import { slugify } from '@coldfront/forecast-core';
import { download } from '../http';
import type { SourceMeta } from '../types';
import type { WastewaterSite } from './amelag';
import { regionIdForAdmin1 } from './geo';

/**
 * Locating AMELAG plants. AMELAG publishes only the plant name, the state and the
 * catchment population, so positions are looked up by place name in GeoNames
 * (CC BY 4.0). The result is approximate: it is the position of the municipality
 * (or district) the plant is named after, not of the plant itself.
 */

export const CITIES_URL = 'https://download.geonames.org/export/dump/cities500.zip';
export const ADMIN1_URL = 'https://download.geonames.org/export/dump/admin1CodesASCII.txt';

export const SOURCE: Omit<SourceMeta, 'retrieved' | 'sha256'> = {
  id: 'geonames-cities',
  name: 'GeoNames Cities (population > 500), Germany',
  url: CITIES_URL,
  attribution: 'GeoNames, https://www.geonames.org, CC BY 4.0',
  license: 'CC BY 4.0',
  license_url: 'https://creativecommons.org/licenses/by/4.0/',
  doi: '',
};

export type GeoMatch = 'name+state' | 'name+state+population' | 'manual' | 'none';

/** One populated place of the GeoNames cities dump (Germany only). */
export interface GeoRow {
  id: number;
  name: string;
  asciiname: string;
  alternates: string[];
  lat: number;
  lon: number;
  /** State region id, e.g. "de-sn". */
  region: string;
  population: number;
}

/** One place name of the GeoNames postal-code file (second, coarser source). */
export interface PostalPlace {
  name: string;
  lat: number;
  lon: number;
  region: string;
}

export interface SiteGeo {
  lat: number | null;
  lon: number | null;
  geo_match: GeoMatch;
  geonames_id: number | null;
  geonames_name: string | null;
}

/** Manual assignment: site id -> GeoNames id that is justified in `reason`. */
export type GeoOverrides = Record<string, { geonames_id: number; reason: string }>;

/** admin1 names that regionIdForAdmin1 does not know (the ASCII file drops umlauts etc.). */
const ADMIN1_FALLBACK: Record<string, string> = {
  'baden-wurttemberg': 'de-bw',
  'state-of-berlin': 'de-be',
  'free-hanseatic-city-of-bremen': 'de-hb',
  'free-and-hanseatic-city-of-hamburg': 'de-hh',
  'free-state-of-saxony': 'de-sn',
};

/** Parse admin1CodesASCII.txt into a map "01" -> region id (Germany lines only). */
export function parseAdmin1(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const f = line.split('\t');
    const code = f[0] ?? '';
    if (!code.startsWith('DE.')) continue;
    const name = f[1] ?? '';
    const region = regionIdForAdmin1(name) ?? ADMIN1_FALLBACK[slugify(name)];
    if (!region) throw new Error(`unknown admin1 "${name}" (${code})`);
    out.set(code.slice(3), region);
  }
  return out;
}

/** Parse the tab-separated cities dump; keeps German populated places (feature class P). */
export function parseCities(text: string, admin1: ReadonlyMap<string, string>): GeoRow[] {
  const out: GeoRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line === '') continue;
    const f = line.split('\t');
    if (f.length < 15) throw new Error(`malformed GeoNames row: ${line}`);
    if (f[8] !== 'DE' || f[6] !== 'P') continue;
    const region = admin1.get(f[10]!);
    if (!region) continue;
    const lat = Number(f[4]);
    const lon = Number(f[5]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error(`malformed GeoNames row: ${line}`);
    out.push({
      id: Number(f[0]),
      name: f[1]!,
      asciiname: f[2]!,
      alternates: f[3] === '' ? [] : f[3]!.split(','),
      lat,
      lon,
      region,
      population: Number(f[14]) || 0,
    });
  }
  return out;
}

/** Parse the postal-code file (DE.txt) into place names with coordinates. */
export function parsePostalPlaces(text: string): PostalPlace[] {
  const out: PostalPlace[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const f = line.split('\t');
    if (f.length < 11) throw new Error(`malformed GeoNames row: ${line}`);
    const region = regionIdForAdmin1(f[3] ?? '');
    const lat = Number(f[9]);
    const lon = Number(f[10]);
    if (!region || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({ name: f[2]!, lat, lon, region });
  }
  return out;
}

// ---------------------------------------------------------------- name handling

/** Tokens that carry no place information (slugified). */
const NOISE = new Set(['stadt', 'klaerwerk', 'klaeranlage', 'zentralklaeranlage', 'klaerwerke', 'kw', 'ara', 'hauptklaerwerk']);
const DIRECTION = new Set(['nord', 'sued', 'mitte', 'ost', 'west']);
/** Words that are not a place on their own ("Bad Kreuznach", "Neu-Ulm"); never used as a single-segment variant. */
const GENERIC_PREFIX = new Set(['bad', 'neu', 'alt', 'sankt', 'st', 'gross', 'klein', 'ober', 'unter', 'nieder', 'der', 'die', 'das']);

/** Drops a trailing " am/an/im/in … " qualifier ("Frankfurt am Main" -> "frankfurt"). */
function stripQualifier(slug: string): string {
  const m = /^(.+?)-(?:am|an|im|in|ob|bei|vor)-.+$/.exec(slug);
  return m ? m[1]! : slug;
}

function withoutParens(name: string): string {
  return name.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Candidate keys for a plant name, most specific first. Later keys are weaker
 * (qualifier or noise removed, then single segments of compound names).
 */
export function siteNameVariants(name: string): string[] {
  const out: string[] = [];
  const add = (s: string): void => {
    if (s !== '' && !out.includes(s)) out.push(s);
  };
  const full = slugify(name);
  add(full);
  const plain = slugify(withoutParens(name));
  add(plain);
  const tokens = plain.split('-').filter((t) => !NOISE.has(t));
  add(tokens.join('-'));
  const noDir = tokens.filter((t) => !DIRECTION.has(t));
  add(noDir.join('-'));
  add(stripQualifier(noDir.join('-')));
  // Compound names such as "Frankfurt-Niederrad": the leading municipality, then the trailing district.
  const segments = stripQualifier(plain)
    .split('-')
    .filter((s) => s !== '' && !NOISE.has(s) && !DIRECTION.has(s) && !GENERIC_PREFIX.has(s));
  if (segments.length > 1) {
    add(segments[0]!);
    add(segments[segments.length - 1]!);
  }
  return out;
}

/** Kinds of name equality, strongest first. */
const KIND_EXACT = 0;
const KIND_STRIPPED = 1;
const KIND_ALTERNATE = 2;

interface Entry<T> {
  item: T;
  kind: number;
}

function indexByName<T>(
  items: readonly T[],
  names: (t: T) => { primary: string[]; alternates: string[] },
): Map<string, Map<string, Entry<T>[]>> {
  // region -> key -> entries
  const idx = new Map<string, Map<string, Entry<T>[]>>();
  const regionOf = (t: T): string => (t as unknown as { region: string }).region;
  for (const item of items) {
    const byKey = idx.get(regionOf(item)) ?? new Map<string, Entry<T>[]>();
    idx.set(regionOf(item), byKey);
    const seen = new Map<string, number>();
    const put = (key: string, kind: number): void => {
      if (key === '') return;
      const cur = seen.get(key);
      if (cur === undefined || kind < cur) seen.set(key, kind);
    };
    const { primary, alternates } = names(item);
    for (const p of primary) {
      const s = slugify(p);
      put(s, KIND_EXACT);
      put(stripQualifier(s), KIND_STRIPPED);
      put(slugify(withoutParens(p)), KIND_STRIPPED);
    }
    for (const a of alternates) {
      const s = slugify(a);
      put(s, KIND_ALTERNATE);
    }
    for (const [key, kind] of seen) {
      const list = byKey.get(key) ?? [];
      list.push({ item, kind });
      byKey.set(key, list);
    }
  }
  return idx;
}

function distKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dy = (bLat - aLat) * 111.2;
  const dx = (bLon - aLon) * 111.2 * Math.cos(((aLat + bLat) / 2) * rad);
  return Math.hypot(dx, dy);
}

/** Distance of a place population to the catchment in log space; 0 = equal. */
function popGap(pop: number, catchment: number | null): number {
  if (catchment === null || catchment <= 0) return 0;
  return Math.abs(Math.log(Math.max(pop, 1) / catchment));
}

/** Candidates closer than this are the same place for our purposes (approximate map position). */
const SAME_PLACE_KM = 5;
/** The best population gap must be at most this share of the runner-up's gap to count as clearly best. */
const CLEARLY_BEST = 0.5;
/** A candidate place is plausible for a plant if population * factor >= catchment population (start value, unproven). */
const PLAUSIBLE_FACTOR = 2;

const round4 = (x: number): number => Math.round(x * 1e4) / 1e4;

const NONE: SiteGeo = { lat: null, lon: null, geo_match: 'none', geonames_id: null, geonames_name: null };

function fromRow(row: GeoRow, geo_match: GeoMatch): SiteGeo {
  return { lat: round4(row.lat), lon: round4(row.lon), geo_match, geonames_id: row.id, geonames_name: row.name };
}

/** Choose among candidates of the same tier; undefined = ambiguous. */
function choose(cands: readonly GeoRow[], catchment: number | null): { row: GeoRow; byPopulation: boolean } | undefined {
  if (cands.length === 1) return { row: cands[0]!, byPopulation: false };
  const ranked = [...cands].sort(
    (a, b) => popGap(a.population, catchment) - popGap(b.population, catchment) || b.population - a.population || a.id - b.id,
  );
  const best = ranked[0]!;
  const rest = ranked.slice(1);
  if (rest.every((r) => distKm(best.lat, best.lon, r.lat, r.lon) <= SAME_PLACE_KM)) {
    return { row: best, byPopulation: true };
  }
  if (catchment === null) return undefined;
  // Catchments rarely exceed about twice the population of the municipality they are named after:
  // if exactly one candidate is large enough, it is the one.
  const plausible = ranked.filter((r) => r.population * PLAUSIBLE_FACTOR >= catchment);
  if (plausible.length === 1) return { row: plausible[0]!, byPopulation: true };
  const g0 = popGap(best.population, catchment);
  const g1 = popGap(rest[0]!.population, catchment);
  if (g0 <= CLEARLY_BEST * g1) return { row: best, byPopulation: true };
  return undefined;
}

export interface MatchDetail {
  /** Which name variant matched (0 = full name); > 0 means weaker evidence. */
  variant: number;
  source: 'cities' | 'postal' | 'override' | 'none';
}

/**
 * Pure matching: site name + state (+ catchment population) against GeoNames places.
 * Order: manual overrides, then cities dump (variant by variant, exact before
 * qualifier-stripped before alternate names), then the postal place names.
 */
export function matchSites(
  sites: readonly Pick<WastewaterSite, 'id' | 'name' | 'region' | 'population'>[],
  cities: readonly GeoRow[],
  postal: readonly PostalPlace[] = [],
  overrides: GeoOverrides = {},
): Map<string, SiteGeo & { detail: MatchDetail }> {
  const cityIdx = indexByName(cities, (c) => ({ primary: [c.name, c.asciiname], alternates: c.alternates }));
  const byId = new Map(cities.map((c) => [c.id, c]));
  const postalIdx = indexByName(postal, (p) => ({ primary: [p.name], alternates: [] }));

  const out = new Map<string, SiteGeo & { detail: MatchDetail }>();
  for (const site of sites) {
    const ov = overrides[site.id];
    if (ov) {
      const row = byId.get(ov.geonames_id);
      if (!row) throw new Error(`override for ${site.id}: GeoNames id ${ov.geonames_id} not in the dump`);
      if (row.region !== site.region) throw new Error(`override for ${site.id}: GeoNames id ${ov.geonames_id} lies in ${row.region}`);
      out.set(site.id, { ...fromRow(row, 'manual'), detail: { variant: 0, source: 'override' } });
      continue;
    }
    out.set(site.id, { ...NONE, detail: { variant: 0, source: 'none' } });
    const variants = siteNameVariants(site.name);

    let found = false;
    const byKey = cityIdx.get(site.region);
    for (let v = 0; v < variants.length && byKey && !found; v++) {
      const entries = byKey.get(variants[v]!) ?? [];
      for (const kind of [KIND_EXACT, KIND_STRIPPED, KIND_ALTERNATE]) {
        const tier = entries.filter((e) => e.kind === kind).map((e) => e.item);
        if (tier.length === 0) continue;
        const pick = choose(tier, site.population);
        if (pick) {
          out.set(site.id, {
            ...fromRow(pick.row, pick.byPopulation ? 'name+state+population' : 'name+state'),
            detail: { variant: v, source: 'cities' },
          });
        }
        // An ambiguous tier stops the search: weaker evidence must not override it.
        found = true;
        break;
      }
    }
    if (found) continue;

    const pKey = postalIdx.get(site.region);
    for (let v = 0; v < variants.length && pKey; v++) {
      const entries = pKey.get(variants[v]!) ?? [];
      if (entries.length === 0) continue;
      const places = entries.map((e) => e.item);
      const lat = places.reduce((s, p) => s + p.lat, 0) / places.length;
      const lon = places.reduce((s, p) => s + p.lon, 0) / places.length;
      // Postal places of one name scatter within a municipality; a wide scatter means different places.
      if (places.every((p) => distKm(lat, lon, p.lat, p.lon) <= 15)) {
        out.set(site.id, {
          lat: round4(lat), lon: round4(lon), geo_match: 'name+state', geonames_id: null, geonames_name: places[0]!.name,
          detail: { variant: v, source: 'postal' },
        });
      }
      break;
    }
  }
  return out;
}

// ---------------------------------------------------------------- network

/** Download cities500.zip; returns the txt and the SHA-256 of the zip. */
export async function fetchCities(): Promise<{ text: string; sha256: string }> {
  const { bytes, sha256 } = await download(SOURCE.url);
  return { text: citiesTextFromZip(bytes), sha256 };
}

export function citiesTextFromZip(bytes: Uint8Array): string {
  const entry = unzipSync(bytes)['cities500.txt'];
  if (!entry) throw new Error('cities500.zip does not contain cities500.txt');
  return new TextDecoder('utf-8').decode(entry).replace(/^﻿/, '');
}

export async function fetchAdmin1(): Promise<string> {
  const { bytes } = await download(ADMIN1_URL);
  return new TextDecoder('utf-8').decode(bytes);
}
