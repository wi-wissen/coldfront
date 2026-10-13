// One-off: fetch BKG VG250 states and GeoNames postcodes, write data/external/geo/*.
// Run from the repo root: tsx pipeline/scripts/build-geo.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPostcodeIndex,
  buildStatesTopology,
  fetchGeonamesTxt,
  fetchStatesGeoJson,
  serializePostcodeIndex,
} from '../src/ingest/geo';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = resolve(repoRoot, 'data/external/geo');
mkdirSync(outDir, { recursive: true });

const states = await fetchStatesGeoJson();
const topo = buildStatesTopology(states.geojson);
const topoText = `${JSON.stringify(topo)}\n`;
writeFileSync(resolve(outDir, 'vg250-laender.topo.json'), topoText);
console.log(`vg250 sha256=${states.sha256} bytes=${topoText.length}`);

const geonames = await fetchGeonamesTxt();
const index = buildPostcodeIndex(geonames.text);
const plzText = serializePostcodeIndex(index);
writeFileSync(resolve(outDir, 'plz.json'), plzText);
console.log(`geonames sha256=${geonames.sha256} postcodes=${Object.keys(index).length} bytes=${plzText.length}`);
