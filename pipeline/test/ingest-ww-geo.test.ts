import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  matchSites,
  parseAdmin1,
  parseCities,
  parsePostalPlaces,
  siteNameVariants,
  SOURCE,
  type GeoRow,
} from '../src/ingest/ww-geo';

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const admin1 = parseAdmin1(fixture('geonames-admin1-excerpt.txt'));
const cities = parseCities(fixture('geonames-cities-excerpt.txt'), admin1);

const site = (id: string, name: string, region: string, population: number | null) => ({ id, name, region, population });

describe('admin1 / cities parsing', () => {
  it('maps all 16 admin1 codes to state ids', () => {
    expect(admin1.size).toBe(16);
    expect(admin1.get('13')).toBe('de-sn');
    expect(admin1.get('01')).toBe('de-bw');
    expect(admin1.get('16')).toBe('de-be');
    expect(new Set(admin1.values()).size).toBe(16);
  });

  it('parses German populated places with region ids', () => {
    expect(cities).toHaveLength(13);
    const leipzig = cities.find((c) => c.name === 'Leipzig')!;
    expect(leipzig).toMatchObject({ id: 2879139, region: 'de-sn', population: 504971 });
    expect(leipzig.lat).toBeCloseTo(51.34, 2);
  });

  it('skips other countries and non-populated-place classes', () => {
    const row = (id: number, cc: string, cls: string) =>
      [id, 'X', 'X', '', 50, 8, cls, 'PPL', cc, '', '13', '', '', '', 1000, '', '', '', ''].join('\t');
    const rows = parseCities([row(1, 'DE', 'P'), row(2, 'AT', 'P'), row(3, 'DE', 'H')].join('\n'), admin1);
    expect(rows.map((r) => r.id)).toEqual([1]);
  });

  it('rejects malformed rows', () => {
    expect(() => parseCities('1\t2\t3', admin1)).toThrow(/malformed/);
  });

  it('parses postal place names', () => {
    const txt = 'DE\t04109\tLeipzig\tSachsen\tSN\t\t\t\t\t51.34\t12.37\t4\n';
    expect(parsePostalPlaces(txt)).toEqual([{ name: 'Leipzig', lat: 51.34, lon: 12.37, region: 'de-sn' }]);
  });

  it('has provenance for the cities dump', () => {
    expect(SOURCE.id).toBe('geonames-cities');
    expect(SOURCE.license).toBe('CC BY 4.0');
  });
});

describe('siteNameVariants', () => {
  it('strips noise, directions, parentheses and qualifiers; adds segments last', () => {
    expect(siteNameVariants('Düsseldorf (Nord)')).toEqual(['duesseldorf-nord', 'duesseldorf']);
    expect(siteNameVariants('Frankfurt-Niederrad')).toEqual(['frankfurt-niederrad', 'frankfurt', 'niederrad']);
    expect(siteNameVariants('Klärwerk Stadt Hof Süd')).toContain('hof');
    expect(siteNameVariants('Neustadt an der Weinstraße')).toEqual(['neustadt-an-der-weinstrasse', 'neustadt']);
  });
});

describe('matchSites', () => {
  it('matches exact name within the state', () => {
    const m = matchSites([site('ww-leipzig', 'Leipzig', 'de-sn', 606548)], cities);
    expect(m.get('ww-leipzig')).toMatchObject({ geo_match: 'name+state', geonames_id: 2879139, lat: 51.3396, lon: 12.3713 });
  });

  it('does not take a same-named place of another state', () => {
    const m = matchSites([site('ww-leipzig', 'Leipzig', 'de-by', 1000)], cities);
    expect(m.get('ww-leipzig')!.geo_match).toBe('none');
    expect(m.get('ww-leipzig')!.lat).toBeNull();
  });

  it('handles transliteration, parentheses and qualifiers', () => {
    const m = matchSites(
      [
        site('ww-duesseldorf-nord', 'Düsseldorf (Nord)', 'de-nw', 333122),
        site('ww-frankfurt-oder', 'Frankfurt (Oder)', 'de-bb', 65444),
        site('ww-frankfurt-griesheim', 'Frankfurt-Griesheim', 'de-he', 617300),
        site('ww-neustadt-weinstrasse', 'Neustadt an der Weinstraße', 'de-rp', 53000),
        site('ww-altoetting', 'Altötting', 'de-by', 34550),
      ],
      cities,
    );
    expect(m.get('ww-duesseldorf-nord')!.geonames_name).toBe('Düsseldorf');
    expect(m.get('ww-frankfurt-oder')!.geonames_id).toBe(2925535);
    expect(m.get('ww-frankfurt-griesheim')!.geonames_id).toBe(2925533);
    expect(m.get('ww-neustadt-weinstrasse')!.geo_match).toBe('name+state');
    expect(m.get('ww-altoetting')!.geonames_id).toBe(2956940);
  });

  it('ranks several same-name places by catchment population', () => {
    const m = matchSites([site('ww-ebersbach', 'Ebersbach', 'de-sn', 16000)], cities);
    expect(m.get('ww-ebersbach')).toMatchObject({ geo_match: 'name+state+population', geonames_id: 2933965 });
  });

  it('refuses ambiguous candidates without a clear population winner', () => {
    const twin = (id: number, lat: number, pop: number): GeoRow => ({
      id, name: 'Zwilling', asciiname: 'Zwilling', alternates: [], lat, lon: 10, region: 'de-sn', population: pop,
    });
    const rows = [twin(1, 51, 10000), twin(2, 52, 11000)];
    expect(matchSites([site('ww-zwilling', 'Zwilling', 'de-sn', 10500)], rows).get('ww-zwilling')!.geo_match).toBe('none');
    // unknown catchment: also ambiguous
    expect(matchSites([site('ww-zwilling', 'Zwilling', 'de-sn', null)], rows).get('ww-zwilling')!.geo_match).toBe('none');
  });

  it('accepts candidates that lie within a few km of each other', () => {
    const near = (id: number, lat: number): GeoRow => ({
      id, name: 'Nahe', asciiname: 'Nahe', alternates: [], lat, lon: 10, region: 'de-sn', population: 5000,
    });
    const m = matchSites([site('ww-nahe', 'Nahe', 'de-sn', 5000)], [near(1, 51), near(2, 51.01)]);
    expect(m.get('ww-nahe')!.geo_match).toBe('name+state+population');
  });

  it('uses alternate names after primary names', () => {
    const rows: GeoRow[] = [
      { id: 1, name: 'Altstadt', asciiname: 'Altstadt', alternates: ['Neuburg'], lat: 50, lon: 9, region: 'de-by', population: 9000 },
    ];
    expect(matchSites([site('ww-neuburg', 'Neuburg', 'de-by', 9000)], rows).get('ww-neuburg')!.geonames_id).toBe(1);
  });

  it('falls back to postal place names, averaging, only within one municipality', () => {
    const postal = [
      { name: 'Teilort', lat: 50, lon: 10, region: 'de-th' },
      { name: 'Teilort', lat: 50.02, lon: 10.02, region: 'de-th' },
    ];
    const m = matchSites([site('ww-teilort', 'Teilort', 'de-th', 3000)], cities, postal);
    expect(m.get('ww-teilort')).toMatchObject({ geo_match: 'name+state', geonames_id: null, lat: 50.01, lon: 10.01 });
    expect(m.get('ww-teilort')!.detail.source).toBe('postal');
    const far = [...postal, { name: 'Teilort', lat: 52, lon: 12, region: 'de-th' }];
    expect(matchSites([site('ww-teilort', 'Teilort', 'de-th', 3000)], cities, far).get('ww-teilort')!.geo_match).toBe('none');
  });

  it('applies verified overrides and rejects wrong-state ones', () => {
    const ov = { 'ww-koenigsbach': { geonames_id: 3206188, reason: 'test' } };
    const m = matchSites([site('ww-koenigsbach', 'Königsbach', 'de-bw', 27239)], cities, [], ov);
    expect(m.get('ww-koenigsbach')).toMatchObject({ geo_match: 'manual', geonames_id: 3206188 });
    expect(() => matchSites([site('ww-koenigsbach', 'Königsbach', 'de-by', 1)], cities, [], ov)).toThrow(/lies in/);
    expect(() => matchSites([site('ww-x', 'X', 'de-by', 1)], cities, [], { 'ww-x': { geonames_id: 1, reason: '' } })).toThrow(/not in the dump/);
  });

  it('is deterministic', () => {
    const s = [site('ww-leipzig', 'Leipzig', 'de-sn', 606548), site('ww-ebersbach', 'Ebersbach', 'de-sn', 16000)];
    expect([...matchSites(s, cities)]).toEqual([...matchSites(s, [...cities].reverse())]);
  });
});

describe('generated artifact', () => {
  it('has an entry for every site and consistent labels', () => {
    const geo = JSON.parse(readFileSync(new URL('../../data/external/geo/ww-sites-geo.json', import.meta.url), 'utf8')) as Record<
      string, { lat: number | null; lon: number | null; geo_match: string; geonames_id: number | null }
    >;
    const sites = JSON.parse(readFileSync(new URL('../../data/external/wastewater-sites.json', import.meta.url), 'utf8')) as { id: string }[];
    expect(Object.keys(geo).sort()).toEqual(sites.map((s) => s.id).sort());
    for (const g of Object.values(geo)) {
      expect(['name+state', 'name+state+population', 'manual', 'none']).toContain(g.geo_match);
      expect(g.lat === null).toBe(g.geo_match === 'none');
      if (g.lat !== null) {
        expect(g.lat).toBeGreaterThan(47);
        expect(g.lat).toBeLessThan(55.1);
        expect(g.lon!).toBeGreaterThan(5.8);
        expect(g.lon!).toBeLessThan(15.1);
      }
    }
  });
});
