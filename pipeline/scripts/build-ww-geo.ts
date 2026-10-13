// One-off: locate AMELAG plants via GeoNames place names. Deterministic for a given input.
// Run from the repo root: NODE_USE_ENV_PROXY=1 tsx pipeline/scripts/build-ww-geo.ts [cities500.zip]
// With a path argument the local zip is used instead of downloading.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WastewaterSite } from '../src/ingest/amelag';
import { fetchGeonamesTxt } from '../src/ingest/geo';
import {
  citiesTextFromZip,
  fetchAdmin1,
  fetchCities,
  matchSites,
  parseAdmin1,
  parseCities,
  parsePostalPlaces,
  SOURCE,
  type GeoOverrides,
} from '../src/ingest/ww-geo';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = <T>(p: string): T => JSON.parse(readFileSync(resolve(root, p), 'utf8')) as T;

const sites = readJson<WastewaterSite[]>('data/external/wastewater-sites.json');
const overrides = readJson<GeoOverrides>('pipeline/config/ww-geo-overrides.json');

const arg = process.argv[2];
let citiesText: string;
let sha256: string;
if (arg) {
  const bytes = new Uint8Array(readFileSync(arg));
  citiesText = citiesTextFromZip(bytes);
  sha256 = createHash('sha256').update(bytes).digest('hex');
} else {
  ({ text: citiesText, sha256 } = await fetchCities());
}
const admin1 = parseAdmin1(await fetchAdmin1());
const cities = parseCities(citiesText, admin1);
const postal = parsePostalPlaces((await fetchGeonamesTxt()).text);

const result = matchSites(sites, cities, postal, overrides);

const geo: Record<string, unknown> = {};
const counts: Record<string, number> = {};
for (const s of [...sites].sort((a, b) => (a.id < b.id ? -1 : 1))) {
  const { detail, ...g } = result.get(s.id)!;
  geo[s.id] = g;
  counts[g.geo_match] = (counts[g.geo_match] ?? 0) + 1;
  if (g.geo_match === 'none' || detail.variant > 0 || detail.source === 'postal') {
    console.log(`${s.id.padEnd(34)} ${g.geo_match.padEnd(22)} src=${detail.source} variant=${detail.variant} -> ${g.geonames_name ?? '-'}`);
  }
}
const outDir = resolve(root, 'data/external/geo');
mkdirSync(outDir, { recursive: true });
const lines = Object.keys(geo).map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(geo[k])}`);
writeFileSync(resolve(outDir, 'ww-sites-geo.json'), `{\n${lines.join(',\n')}\n}\n`);
console.log(counts);

// Keep the retrieval date when the very same file was seen before.
const srcPath = resolve(root, 'data/sources/geonames-cities.json');
let retrieved = new Date().toISOString().slice(0, 10);
if (existsSync(srcPath)) {
  const old = JSON.parse(readFileSync(srcPath, 'utf8')) as { sha256?: string; retrieved?: string };
  if (old.sha256 === sha256 && old.retrieved) retrieved = old.retrieved;
}
writeFileSync(srcPath, `${JSON.stringify({ ...SOURCE, retrieved, sha256 }, null, 2)}\n`);
