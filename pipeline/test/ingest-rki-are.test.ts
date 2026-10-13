import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAre, SOURCE } from '../src/ingest/rki-are';

const fixture = readFileSync(new URL('./fixtures/rki-are.tsv', import.meta.url), 'utf8');
const HEADER = 'Saison\tKalenderwoche\tBundesland\tBundesland_ID\tAltersgruppe\tARE_Konsultationsinzidenz';

describe('parseAre', () => {
  it('parses the fixture into exactly 24 rows (2 weeks Bundesweit, 1 week each for two Länder)', () => {
    expect(parseAre(fixture)).toHaveLength(24);
  });

  it('maps Bundesland_ID to region ids (0 -> de, 9 -> de-by, 16 -> de-th)', () => {
    const rows = parseAre(fixture);
    const byRegion = (id: string) => rows.filter((r) => r.region === id).length;
    expect(byRegion('de')).toBe(12);
    expect(byRegion('de-by')).toBe(6);
    // The file spells it "Thueringen"; the mapping goes by ID, so the spelling does not matter.
    expect(byRegion('de-th')).toBe(6);
  });

  it('uses Altersgruppe as series and converts the week and value', () => {
    const rows = parseAre(fixture);
    expect(rows[0]).toEqual({ region: 'de', series: '00+', week: '2025-W40', value: 1174 });
    expect(rows[1]).toEqual({ region: 'de', series: '0-4', week: '2025-W40', value: 3378 });
    expect(rows.find((r) => r.region === 'de-th' && r.series === '00+')).toEqual({
      region: 'de-th',
      series: '00+',
      week: '2025-W41',
      value: 983,
    });
    expect(new Set(rows.map((r) => r.series))).toEqual(new Set(['00+', '0-4', '5-14', '15-34', '35-59', '60+']));
  });

  it('keeps input order', () => {
    const weeks = parseAre(fixture).map((r) => r.week);
    const expected = fixture
      .trim()
      .split('\n')
      .slice(1)
      .map((l) => l.split('\t')[1]);
    expect(weeks).toEqual(expected);
  });

  it('skips NA and empty values without dropping the rest', () => {
    const text = [HEADER, '2025/26\t2025-W40\tBundesweit\t0\t00+\tNA', '2025/26\t2025-W40\tBundesweit\t0\t0-4\t', '2025/26\t2025-W40\tBundesweit\t0\t5-14\t42'].join('\n');
    expect(parseAre(text)).toEqual([{ region: 'de', series: '5-14', week: '2025-W40', value: 42 }]);
  });

  it('tolerates a UTF-8 BOM and CRLF line endings', () => {
    const crlf = '﻿' + fixture.replace(/\n/g, '\r\n');
    expect(parseAre(crlf)).toEqual(parseAre(fixture));
  });

  it('throws a clear error when a required column is missing', () => {
    const text = 'Saison\tKalenderwoche\tBundesland\tBundesland_ID\tAltersgruppe\n2025/26\t2025-W40\tBundesweit\t0\t00+\n';
    expect(() => parseAre(text)).toThrow(/missing column\(s\) ARE_Konsultationsinzidenz/);
  });

  it('throws on an invalid week', () => {
    const text = [HEADER, '2025/26\t2025-40\tBundesweit\t0\t00+\t1'].join('\n');
    expect(() => parseAre(text)).toThrow(/invalid week "2025-40"/);
  });

  it('throws on an unknown Bundesland_ID', () => {
    const text = [HEADER, '2025/26\t2025-W40\tAtlantis\t99\t00+\t1'].join('\n');
    expect(() => parseAre(text)).toThrow(/unknown Bundesland_ID "99"/);
  });

  it('skips a repeated header line', () => {
    const text = [HEADER, HEADER, '2025/26\t2025-W40\tBundesweit\t0\t00+\t1'].join('\n');
    expect(parseAre(text)).toHaveLength(1);
  });
});

describe('SOURCE (rki-are)', () => {
  it('carries the exact attribution and licence', () => {
    expect(SOURCE.attribution).toBe('Robert Koch-Institut, ARE-Konsultationsinzidenz, CC BY 4.0');
    expect(SOURCE.license).toBe('CC BY 4.0');
    expect(SOURCE.license_url).toBe('https://creativecommons.org/licenses/by/4.0/');
    expect(SOURCE.doi).toBe('');
  });
});
