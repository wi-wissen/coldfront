import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { feature } from 'topojson-client';
import type { FeatureCollection } from 'geojson';
import type { Topology } from 'topojson-specification';
import { REGIONS } from '@coldfront/forecast-core';
import {
  buildPostcodeIndex,
  buildStatesTopology,
  regionIdForAdmin1,
  serializePostcodeIndex,
  SOURCE_GEONAMES,
  SOURCE_VG250,
} from '../src/ingest/geo';

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const artifact = (name: string): string =>
  readFileSync(new URL(`../../data/external/geo/${name}`, import.meta.url), 'utf8');

const STATE_IDS = REGIONS.filter((r) => r.id !== 'de').map((r) => r.id);
const GERMANY_BBOX = { lonMin: 5.8, lonMax: 15.1, latMin: 47, latMax: 55.1 };

/** The "laender" collection of a topology; throws if missing. */
function laenderGeometries(topo: Topology): { properties: Record<string, unknown> | null }[] {
  const obj = topo.objects.laender;
  if (!obj || obj.type !== 'GeometryCollection') throw new Error('missing laender collection');
  return obj.geometries as unknown as { properties: Record<string, unknown> | null }[];
}

/** Decode the "laender" object back to lon/lat GeoJSON. */
function decodeLaender(topo: Topology): FeatureCollection {
  const obj = topo.objects.laender;
  if (!obj) throw new Error('missing laender object');
  return feature(topo, obj) as FeatureCollection;
}

/** Visit every position of a GeoJSON coordinates array. */
function forEachPosition(coords: unknown, visit: (p: number[]) => void): void {
  if (!Array.isArray(coords)) return;
  if (typeof coords[0] === 'number') return visit(coords as number[]);
  for (const c of coords) forEachPosition(c, visit);
}

describe('admin1 mapping', () => {
  it('maps German and English spellings to state ids', () => {
    expect(regionIdForAdmin1('Sachsen')).toBe('de-sn');
    expect(regionIdForAdmin1('Saxony')).toBe('de-sn');
    expect(regionIdForAdmin1('Bayern')).toBe('de-by');
    expect(regionIdForAdmin1('Bavaria')).toBe('de-by');
    expect(regionIdForAdmin1('Thuringia')).toBe('de-th');
    expect(regionIdForAdmin1('Hesse')).toBe('de-he');
    expect(regionIdForAdmin1('Mecklenburg-Western Pomerania')).toBe('de-mv');
    expect(regionIdForAdmin1('Baden-Wuerttemberg')).toBe('de-bw');
    expect(regionIdForAdmin1('Land Berlin')).toBe('de-be');
  });

  it('returns undefined for names that are not a German state', () => {
    expect(regionIdForAdmin1('Tyrol')).toBeUndefined();
    expect(regionIdForAdmin1('Deutschland')).toBeUndefined();
  });
});

describe('buildPostcodeIndex', () => {
  const index = buildPostcodeIndex(fixture('geonames-excerpt.txt'));

  it('averages coordinates per postcode over its rows', () => {
    // 04109 has two rows: (51.33, 12.36) and (51.35, 12.38)
    expect(index['04109']?.[0]).toBeCloseTo(51.34, 4);
    expect(index['04109']?.[1]).toBeCloseTo(12.37, 4);
    expect(index['04109']?.[2]).toBe('de-sn');
  });

  it('maps spelling variants to the right state', () => {
    expect(index['01067']?.[2]).toBe('de-sn'); // Saxony
    expect(index['80331']?.[2]).toBe('de-by'); // Bavaria
    expect(index['10115']?.[2]).toBe('de-be'); // Land Berlin
    expect(index['19055']?.[2]).toBe('de-mv'); // Mecklenburg-Western Pomerania
    expect(index['60311']?.[2]).toBe('de-he'); // Hesse
    expect(index['70173']?.[2]).toBe('de-bw'); // Baden-Wuerttemberg
  });

  it('takes the state of the first row for a postcode spanning states', () => {
    // 99084: first row Thuringia, second row Sachsen
    expect(index['99084']?.[2]).toBe('de-th');
    expect(index['99084']?.[0]).toBeCloseTo(50.9394, 4);
  });

  it('has one entry per postcode', () => {
    expect(Object.keys(index)).toHaveLength(9);
  });

  it('throws on an unknown state name', () => {
    expect(() => buildPostcodeIndex('DE\t12345\tX\tAtlantis\t00\t\t\t\t\t50\t10\t')).toThrow(/Atlantis/);
  });

  it('skips rows without any state (Austrian enclave)', () => {
    const idx = buildPostcodeIndex('DE\t87491\tJungholz\t\t\t\t\t\t\t47.5741\t10.4472\t\n');
    expect(idx).toEqual({});
  });

  it('serialises with sorted keys and round-trips through JSON', () => {
    const text = serializePostcodeIndex(index);
    expect(JSON.parse(text)).toEqual(index);
    const keysInText = [...text.matchAll(/^ {2}"(\d{5})"/gm)].map((m) => m[1]);
    expect(keysInText).toEqual([...keysInText].sort());
    expect(keysInText).toHaveLength(9);
  });
});

describe('buildStatesTopology (offline fixture)', () => {
  const geojson = JSON.parse(fixture('vg250-mini.geojson')) as unknown;
  const topo = buildStatesTopology(geojson);

  it('produces a TopoJSON topology with one geometry per state', () => {
    expect(topo.type).toBe('Topology');
    expect(Object.keys(topo.objects)).toEqual(['laender']);
    expect(laenderGeometries(topo).map((g) => g.properties)).toEqual([
      { id: 'de-sn', ags: '14', name: 'Sachsen' },
      { id: 'de-by', ags: '09', name: 'Bayern' },
    ]);
  });

  it('decodes back to lon/lat inside the input square', () => {
    const fc = decodeLaender(topo);
    const sachsen = fc.features[0]!.geometry;
    const coords: number[][] = [];
    forEachPosition(sachsen.type === 'Polygon' ? sachsen.coordinates : [], (p) => coords.push(p));
    const lons = coords.map((p) => p[0] ?? NaN);
    const lats = coords.map((p) => p[1] ?? NaN);
    expect(Math.min(...lons)).toBeCloseTo(12, 3);
    expect(Math.max(...lons)).toBeCloseTo(13, 3);
    expect(Math.min(...lats)).toBeCloseTo(50.5, 3);
    expect(Math.max(...lats)).toBeCloseTo(51, 3);
  });

  it('keeps only land features (gf = 4)', () => {
    const withWater = {
      type: 'FeatureCollection',
      features: [
        ...(geojson as { features: unknown[] }).features,
        {
          type: 'Feature',
          properties: { gf: 1, ags: '09', gen: 'Bayern (Bodensee)' },
          geometry: { type: 'Polygon', coordinates: [[[9, 47.5], [9.5, 47.5], [9.5, 47.8], [9, 47.5]]] },
        },
      ],
    };
    expect(laenderGeometries(buildStatesTopology(withWater))).toHaveLength(2);
  });

  it('rejects input that is not a FeatureCollection', () => {
    expect(() => buildStatesTopology({ type: 'Feature' })).toThrow(/FeatureCollection/);
  });

  it('metadata carries the expected licence and identifiers', () => {
    expect(SOURCE_VG250.id).toBe('bkg-vg250');
    expect(SOURCE_VG250.license).toBe('dl-de/by-2-0');
    expect(SOURCE_VG250.url).toContain('sgx.geodatenzentrum.de');
    expect(SOURCE_GEONAMES.id).toBe('geonames-plz');
    expect(SOURCE_GEONAMES.license).toBe('CC BY 4.0');
  });
});

describe('committed artifacts', () => {
  it('vg250-laender.topo.json: 16 state geometries, WGS84, size limit', () => {
    const text = artifact('vg250-laender.topo.json');
    expect(Buffer.byteLength(text, 'utf8')).toBeLessThanOrEqual(120_000);
    const topo = JSON.parse(text) as Topology;
    expect(topo.type).toBe('Topology');
    const geoms = laenderGeometries(topo);
    expect(geoms).toHaveLength(16);
    expect(geoms.map((g) => g.properties?.id).sort()).toEqual([...STATE_IDS].sort());
    for (const g of geoms) {
      const region = REGIONS.find((r) => r.id === g.properties?.id);
      expect(g.properties?.ags).toBe(region?.ags);
      expect(g.properties?.name).toBe(region?.name_de);
    }
    for (const f of decodeLaender(topo).features) {
      const geom = f.geometry;
      forEachPosition(geom.type === 'Polygon' || geom.type === 'MultiPolygon' ? geom.coordinates : [], (p) => {
        expect(p[0]).toBeGreaterThanOrEqual(GERMANY_BBOX.lonMin);
        expect(p[0]).toBeLessThanOrEqual(GERMANY_BBOX.lonMax);
        expect(p[1]).toBeGreaterThanOrEqual(GERMANY_BBOX.latMin);
        expect(p[1]).toBeLessThanOrEqual(GERMANY_BBOX.latMax);
      });
    }
  });

  it('plz.json: size limit, stable form, known postcodes, bounding box', () => {
    const text = artifact('plz.json');
    expect(Buffer.byteLength(text, 'utf8')).toBeLessThanOrEqual(450_000);
    const index = JSON.parse(text) as Record<string, [number, number, string]>;
    expect(serializePostcodeIndex(index)).toBe(text);

    expect(index['04109']?.[2]).toBe('de-sn'); // Leipzig
    expect(index['01067']?.[2]).toBe('de-sn'); // Dresden
    expect(index['80331']?.[2]).toBe('de-by'); // München
    expect(index['10115']?.[2]).toBe('de-be'); // Berlin

    const keysInText = [...text.matchAll(/^ {2}"(\d{5})"/gm)].map((m) => m[1]);
    expect(keysInText).toEqual([...keysInText].sort());

    const stateIds = new Set(STATE_IDS);
    for (const [postal, [lat, lon, region]] of Object.entries(index)) {
      expect(postal).toMatch(/^\d{5}$/);
      expect(stateIds.has(region)).toBe(true);
      expect(lat).toBeGreaterThanOrEqual(GERMANY_BBOX.latMin);
      expect(lat).toBeLessThanOrEqual(GERMANY_BBOX.latMax);
      expect(lon).toBeGreaterThanOrEqual(GERMANY_BBOX.lonMin);
      expect(lon).toBeLessThanOrEqual(GERMANY_BBOX.lonMax);
    }
  });
});
