import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAmelag, SOURCE } from '../src/ingest/amelag';

const FIXTURE = readFileSync(new URL('./fixtures/amelag.tsv', import.meta.url), 'utf8');

// Hand-computed from fixtures/amelag.tsv (measured viruslast_normalisiert only).
// Week boundaries: 2025-12-28 is 2025-W52, 2025-12-29 is 2026-W01, 2026-01-04 is W01,
// 2026-01-05 is W02; 2024-12-31 is 2025-W01 (calendar year differs from ISO year).
const EXPECTED_ROWS = [
  // national
  { region: 'de', series: 'ww|Influenza A', week: '2025-W01', value: 10 },
  { region: 'de', series: 'ww|Influenza A', week: '2026-W01', value: 5 },
  { region: 'de', series: 'ww|RSV A/B', week: '2026-W02', value: 0.5 },
  { region: 'de', series: 'ww|SARS-CoV-2', week: '2025-W52', value: 75 },
  { region: 'de', series: 'ww|SARS-CoV-2', week: '2026-W01', value: 45 },
  { region: 'de', series: 'ww|SARS-CoV-2', week: '2026-W02', value: 14.8889 },
  // Bundesland
  { region: 'de-bw', series: 'ww|SARS-CoV-2', week: '2026-W02', value: 3 },
  { region: 'de-by', series: 'ww|SARS-CoV-2', week: '2026-W02', value: 1.6667 },
  { region: 'de-nw', series: 'ww|RSV A/B', week: '2026-W02', value: 0.5 },
  { region: 'de-nw', series: 'ww|SARS-CoV-2', week: '2025-W52', value: 50 },
  { region: 'de-nw', series: 'ww|SARS-CoV-2', week: '2026-W01', value: 70 },
  { region: 'de-sn', series: 'ww|Influenza A', week: '2025-W01', value: 10 },
  { region: 'de-sn', series: 'ww|Influenza A', week: '2026-W01', value: 5 },
  { region: 'de-sn', series: 'ww|SARS-CoV-2', week: '2025-W52', value: 100 },
  { region: 'de-sn', series: 'ww|SARS-CoV-2', week: '2026-W01', value: 20 },
  { region: 'de-sn', series: 'ww|SARS-CoV-2', week: '2026-W02', value: 40 },
  // sites
  { region: 'ww-aachen', series: 'RSV A/B', week: '2026-W02', value: 0.5 },
  { region: 'ww-aachen', series: 'SARS-CoV-2', week: '2025-W52', value: 50 },
  { region: 'ww-aachen', series: 'SARS-CoV-2', week: '2026-W01', value: 70 },
  { region: 'ww-leipzig', series: 'Influenza A', week: '2025-W01', value: 10 },
  { region: 'ww-leipzig', series: 'Influenza A', week: '2026-W01', value: 5 },
  { region: 'ww-leipzig', series: 'SARS-CoV-2', week: '2025-W52', value: 100 },
  { region: 'ww-leipzig', series: 'SARS-CoV-2', week: '2026-W01', value: 20 },
  { region: 'ww-leipzig', series: 'SARS-CoV-2', week: '2026-W02', value: 40 },
  { region: 'ww-sued-bw', series: 'SARS-CoV-2', week: '2026-W02', value: 3 },
  { region: 'ww-sued-by', series: 'SARS-CoV-2', week: '2026-W02', value: 1.6667 },
];

const EXPECTED_SITES = [
  {
    id: 'ww-aachen', name: 'Aachen', region: 'de-nw', population: 250000,
    first_week: '2025-W52', last_week: '2026-W02', pathogens: ['RSV A/B', 'SARS-CoV-2'],
  },
  {
    id: 'ww-leipzig', name: 'Leipzig', region: 'de-sn', population: 600000,
    first_week: '2025-W01', last_week: '2026-W02', pathogens: ['Influenza A', 'SARS-CoV-2'],
  },
  {
    id: 'ww-sued-bw', name: 'Süd', region: 'de-bw', population: 120000,
    first_week: '2026-W02', last_week: '2026-W02', pathogens: ['SARS-CoV-2'],
  },
  {
    id: 'ww-sued-by', name: 'Süd', region: 'de-by', population: 100000,
    first_week: '2026-W02', last_week: '2026-W02', pathogens: ['SARS-CoV-2'],
  },
];

type Row = { region: string; series: string; week: string; value: number };
const find = (rows: Row[], region: string, series: string, week: string): Row | undefined =>
  rows.find((r) => r.region === region && r.series === series && r.week === week);

describe('parseAmelag fixture', () => {
  const { rows, sites } = parseAmelag(FIXTURE);

  it('produces exactly the expected weekly rows, sorted', () => {
    expect(rows).toEqual(EXPECTED_ROWS);
  });

  it('produces exactly the expected site list, sorted by id', () => {
    expect(sites).toEqual(EXPECTED_SITES);
  });

  it('suffixes every id of a name that occurs in several states', () => {
    const ids = sites.filter((s) => s.name === 'Süd').map((s) => s.id);
    expect(ids).toEqual(['ww-sued-bw', 'ww-sued-by']);
    expect(sites.some((s) => s.id === 'ww-sued')).toBe(false);
  });

  it('assigns ISO weeks across the 2025/2026 year boundary', () => {
    // 2025-12-28 (Sun) is W52 of 2025; 2025-12-29 (Mon) starts 2026-W01.
    expect(find(rows, 'ww-leipzig', 'SARS-CoV-2', '2025-W52')?.value).toBe(100);
    // 2026-W01 holds Dec 29, Jan 1 and Jan 4: (10 + 20 + 30) / 3.
    expect(find(rows, 'ww-leipzig', 'SARS-CoV-2', '2026-W01')?.value).toBe(20);
  });

  it('assigns 2024-12-31 to 2025-W01 together with 2025-01-01', () => {
    expect(find(rows, 'ww-leipzig', 'Influenza A', '2025-W01')?.value).toBe(10); // (8 + 12) / 2
  });

  it('starts a new week on Monday 2026-01-05', () => {
    expect(find(rows, 'ww-leipzig', 'SARS-CoV-2', '2026-W02')?.value).toBe(40);
  });

  it('skips NA normalised values, even when the raw value is present', () => {
    // Leipzig 2026-01-02 has viruslast 999 but NA normalised: not in the W01 mean.
    expect(find(rows, 'ww-leipzig', 'SARS-CoV-2', '2026-W01')?.value).toBe(20);
    // Süd BW 2026-01-12 is NA only: no W03 row at any level.
    expect(rows.some((r) => r.week === '2026-W03')).toBe(false);
  });

  it('rounds site means to 4 decimals', () => {
    expect(find(rows, 'ww-sued-by', 'SARS-CoV-2', '2026-W02')?.value).toBe(1.6667); // 5 / 3
  });

  it('uses the population of the latest row that has one', () => {
    // Aachen: later rows are NA, so 250000 from 2025-12-28 is kept.
    expect(sites.find((s) => s.id === 'ww-aachen')?.population).toBe(250000);
  });

  it('exposes the source metadata', () => {
    expect(SOURCE.id).toBe('amelag');
    expect(SOURCE.license).toBe('CC BY 4.0');
    expect(SOURCE.doi).toBe('');
  });
});

describe('parseAmelag input handling', () => {
  it('accepts CRLF line endings with identical output', () => {
    expect(parseAmelag(FIXTURE.replace(/\n/g, '\r\n'))).toEqual(parseAmelag(FIXTURE));
  });

  it('throws when a required column is missing', () => {
    const broken = FIXTURE.replace('\ttyp\t', '\tkind\t');
    expect(() => parseAmelag(broken)).toThrow(/typ/);
  });

  it('throws naming an unknown bundesland code', () => {
    const broken = FIXTURE.replace('\tNW\t', '\tXX\t');
    expect(() => parseAmelag(broken)).toThrow(/XX/);
  });
});
