import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseIfsgInfluenza, SOURCE } from '../src/ingest/rki-ifsg-influenza';

const fixture = readFileSync(new URL('./fixtures/rki-ifsg-influenza.tsv', import.meta.url), 'utf8');
const HEADER = 'Meldewoche\tRegion\tRegion_Id\tAltersgruppe\tFallzahl\tInzidenz';

describe('parseIfsgInfluenza', () => {
  it('starts the fixture with a UTF-8 BOM', () => {
    expect(fixture.charCodeAt(0)).toBe(0xfeff);
  });

  it('emits two rows per input line, minus NA incidences: 18 cases + 16 incidence = 34', () => {
    const rows = parseIfsgInfluenza(fixture);
    expect(rows).toHaveLength(34);
    expect(rows.filter((r) => r.series.startsWith('cases|'))).toHaveLength(18);
    expect(rows.filter((r) => r.series.startsWith('incidence|'))).toHaveLength(16);
  });

  it('maps Region_Id to region ids (00 -> de, 16 -> de-th, 09 -> de-by)', () => {
    const rows = parseIfsgInfluenza(fixture);
    expect(new Set(rows.map((r) => r.region))).toEqual(new Set(['de', 'de-by', 'de-th']));
    expect(rows.filter((r) => r.region === 'de-th')).toHaveLength(8);
  });

  it('builds cases|/incidence| series from Altersgruppe with the real values', () => {
    const rows = parseIfsgInfluenza(fixture);
    expect(rows).toContainEqual({ region: 'de', series: 'cases|00+', week: '2026-W40', value: 461 });
    expect(rows).toContainEqual({ region: 'de', series: 'incidence|00+', week: '2026-W40', value: 0.55 });
    expect(rows).toContainEqual({ region: 'de-th', series: 'incidence|60+', week: '2026-W40', value: 1.32 });
    expect(rows).toContainEqual({ region: 'de', series: 'cases|00-14', week: '2020-W01', value: 384 });
  });

  it('keeps the Unbekannt age group, emitting only cases where incidence is NA', () => {
    const rows = parseIfsgInfluenza(fixture);
    expect(rows).toContainEqual({ region: 'de', series: 'cases|Unbekannt', week: '2020-W01', value: 1 });
    expect(rows.some((r) => r.series === 'incidence|Unbekannt')).toBe(false);
  });

  it('keeps input order, with cases before incidence for each line', () => {
    const rows = parseIfsgInfluenza(fixture);
    expect(rows.slice(0, 2)).toEqual([
      { region: 'de', series: 'cases|00+', week: '2020-W01', value: 1536 },
      { region: 'de', series: 'incidence|00+', week: '2020-W01', value: 1.83 },
    ]);
  });

  it('tolerates a UTF-8 BOM and CRLF line endings', () => {
    const crlf = fixture.replace(/\n/g, '\r\n');
    expect(parseIfsgInfluenza(crlf)).toEqual(parseIfsgInfluenza(fixture));
    expect(parseIfsgInfluenza(fixture.slice(1))).toEqual(parseIfsgInfluenza(fixture));
  });

  it('throws a clear error when a required column is missing', () => {
    const text = 'Meldewoche\tRegion\tRegion_Id\tAltersgruppe\tInzidenz\n2026-W40\tDeutschland\t00\t00+\t0.5\n';
    expect(() => parseIfsgInfluenza(text)).toThrow(/missing column\(s\) Fallzahl/);
  });

  it('throws on an invalid week', () => {
    const text = [HEADER, '2026-40\tDeutschland\t00\t00+\t1\t0.1'].join('\n');
    expect(() => parseIfsgInfluenza(text)).toThrow(/invalid week "2026-40"/);
  });

  it('throws on an unknown Region_Id', () => {
    const text = [HEADER, '2026-W40\tAtlantis\t99\t00+\t1\t0.1'].join('\n');
    expect(() => parseIfsgInfluenza(text)).toThrow(/unknown Region_Id "99"/);
  });
});

describe('SOURCE (rki-ifsg-influenza)', () => {
  it('carries the exact attribution and licence', () => {
    expect(SOURCE.attribution).toBe('Robert Koch-Institut, Influenzafälle in Deutschland, CC BY 4.0');
    expect(SOURCE.license).toBe('CC BY 4.0');
    expect(SOURCE.license_url).toBe('https://creativecommons.org/licenses/by/4.0/');
    expect(SOURCE.doi).toBe('');
  });
});
