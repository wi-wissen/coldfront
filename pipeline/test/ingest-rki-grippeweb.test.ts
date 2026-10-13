import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseGrippeweb, SOURCE } from '../src/ingest/rki-grippeweb';

const fixture = readFileSync(new URL('./fixtures/rki-grippeweb.tsv', import.meta.url), 'utf8');
const HEADER = 'Meldungen\tSaison\tErkrankung\tAltersgruppe\tRegion\tKalenderwoche\tInzidenz';

describe('parseGrippeweb', () => {
  it('parses the fixture into exactly 24 rows (all of 2025-W41: ARE and ILI)', () => {
    expect(parseGrippeweb(fixture)).toHaveLength(24);
  });

  it('maps Bundesweit to de and the four RKI regions to gw-* ids', () => {
    const regions = new Set(parseGrippeweb(fixture).map((r) => r.region));
    expect(regions).toEqual(new Set(['de', 'gw-mitte-west', 'gw-norden-west', 'gw-osten', 'gw-sueden']));
    const byRegion = (id: string) => parseGrippeweb(fixture).filter((r) => r.region === id).length;
    expect(byRegion('de')).toBe(16);
    expect(byRegion('gw-sueden')).toBe(2);
  });

  it('builds series as Erkrankung|Altersgruppe and converts week and value', () => {
    const rows = parseGrippeweb(fixture);
    expect(rows[0]).toEqual({ region: 'de', series: 'ARE|0-4', week: '2025-W41', value: 10866 });
    expect(rows).toContainEqual({ region: 'gw-sueden', series: 'ARE|00+', week: '2025-W41', value: 8556 });
    expect(rows).toContainEqual({ region: 'gw-mitte-west', series: 'ARE|00+', week: '2025-W41', value: 7163 });
    expect(rows).toContainEqual({ region: 'gw-osten', series: 'ILI|00+', week: '2025-W41', value: 1064 });
    expect(new Set(rows.map((r) => r.series.split('|')[0]))).toEqual(new Set(['ARE', 'ILI']));
  });

  it('maps German state names with umlauts to state ids', () => {
    const text = [HEADER, '1\t2025/26\tARE\t00+\tThüringen\t2025-W41\t500', '2\t2025/26\tARE\t00+\tBaden-Württemberg\t2025-W41\t600'].join('\n');
    expect(parseGrippeweb(text)).toEqual([
      { region: 'de-th', series: 'ARE|00+', week: '2025-W41', value: 500 },
      { region: 'de-bw', series: 'ARE|00+', week: '2025-W41', value: 600 },
    ]);
  });

  it('throws on an unknown region, naming the value', () => {
    const text = [HEADER, '1\t2025/26\tARE\t00+\tNordland\t2025-W41\t500'].join('\n');
    expect(() => parseGrippeweb(text)).toThrow(/unknown Region "Nordland"/);
  });

  it('skips NA and empty values and rows with NA week', () => {
    const text = [
      HEADER,
      '1\t2025/26\tARE\t00+\tBundesweit\t2025-W41\tNA',
      '2\t2025/26\tARE\t00+\tBundesweit\t2025-W41\t',
      '3\t2025/26\tARE\t00+\tBundesweit\tNA\t700',
      '4\t2025/26\tILI\t00+\tBundesweit\t2025-W41\t12',
    ].join('\n');
    expect(parseGrippeweb(text)).toEqual([{ region: 'de', series: 'ILI|00+', week: '2025-W41', value: 12 }]);
  });

  it('skips a row that repeats the header', () => {
    const text = [HEADER, HEADER, '1\t2025/26\tARE\t00+\tBundesweit\t2025-W41\t5'].join('\n');
    expect(parseGrippeweb(text)).toHaveLength(1);
  });

  it('tolerates a UTF-8 BOM and CRLF line endings', () => {
    const crlf = '﻿' + fixture.replace(/\n/g, '\r\n');
    expect(parseGrippeweb(crlf)).toEqual(parseGrippeweb(fixture));
  });

  it('throws a clear error when a required column is missing', () => {
    const text = 'Meldungen\tSaison\tErkrankung\tAltersgruppe\tRegion\tKalenderwoche\n1\t2025/26\tARE\t00+\tBundesweit\t2025-W41\n';
    expect(() => parseGrippeweb(text)).toThrow(/missing column\(s\) Inzidenz/);
  });
});

describe('SOURCE (rki-grippeweb)', () => {
  it('carries the exact attribution and licence', () => {
    expect(SOURCE.attribution).toBe('Robert Koch-Institut, GrippeWeb Daten des Wochenberichts, CC BY 4.0');
    expect(SOURCE.license).toBe('CC BY 4.0');
    expect(SOURCE.license_url).toBe('https://creativecommons.org/licenses/by/4.0/');
    expect(SOURCE.doi).toBe('');
  });
});
