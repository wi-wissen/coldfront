import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REGIONS } from '@coldfront/forecast-core';
import {
  parseKmkDetailed,
  parseKmkText,
  vacationShareByWeek,
  type VacationEntry,
} from '../src/ingest/holidays';

const FIXTURE = readFileSync(fileURLToPath(new URL('./fixtures/kmk-excerpt.txt', import.meta.url)), 'utf8');
const SOURCE = 'KMK Ferienkalender 2025/26 (FER2025_26.pdf)';
const OLD_2012 = readFileSync(fileURLToPath(new URL('./fixtures/kmk-old-2012-13.txt', import.meta.url)), 'utf8');
const OLD_2015 = readFileSync(fileURLToPath(new URL('./fixtures/kmk-old-2015-16.txt', import.meta.url)), 'utf8');

const sortEntries = (es: VacationEntry[]): VacationEntry[] =>
  [...es].sort((a, b) =>
    a.region !== b.region ? (a.region < b.region ? -1 : 1) : a.start !== b.start ? (a.start < b.start ? -1 : 1) : a.kind < b.kind ? -1 : 1,
  );

const e = (region: string, kind: VacationEntry['kind'], start: string, end: string): VacationEntry => ({
  region,
  kind,
  start,
  end,
  source: SOURCE,
});

describe('parseKmkText on the 2025/26 excerpt', () => {
  const entries = sortEntries(parseKmkText(FIXTURE, 2025, SOURCE));
  const byRegion = (region: string): VacationEntry[] => entries.filter((x) => x.region === region);

  it('parses Baden-Württemberg, including the wrapped movable day', () => {
    expect(byRegion('de-bw')).toEqual([
      e('de-bw', 'autumn', '2025-10-27', '2025-10-30'),
      e('de-bw', 'other', '2025-10-31', '2025-10-31'),
      e('de-bw', 'christmas', '2025-12-22', '2026-01-05'),
      e('de-bw', 'easter', '2026-03-30', '2026-04-11'),
      e('de-bw', 'pentecost', '2026-05-26', '2026-06-05'),
      e('de-bw', 'summer', '2026-07-30', '2026-09-12'),
    ]);
  });

  it('parses Bayern, keeps "--" winter as no entry, and marks the two stacked Ostern ranges as other', () => {
    expect(byRegion('de-by')).toEqual([
      e('de-by', 'autumn', '2025-11-03', '2025-11-07'),
      e('de-by', 'christmas', '2025-12-22', '2026-01-05'),
      e('de-by', 'other', '2026-02-16', '2026-02-20'),
      e('de-by', 'other', '2026-03-30', '2026-04-10'),
      e('de-by', 'pentecost', '2026-05-26', '2026-06-05'),
      e('de-by', 'summer', '2026-08-03', '2026-09-14'),
    ]);
  });

  it('parses Berlin, with the Christmas range crossing into 2026 and single days as other', () => {
    expect(byRegion('de-be')).toEqual([
      e('de-be', 'autumn', '2025-10-20', '2025-11-01'),
      e('de-be', 'christmas', '2025-12-22', '2026-01-02'),
      e('de-be', 'winter', '2026-02-02', '2026-02-07'),
      e('de-be', 'easter', '2026-03-30', '2026-04-10'),
      e('de-be', 'other', '2026-05-15', '2026-05-15'),
      e('de-be', 'other', '2026-05-26', '2026-05-26'),
      e('de-be', 'summer', '2026-07-09', '2026-08-22'),
    ]);
  });

  it('reports only the stacked Bayern cell as an issue (plus states missing from the excerpt)', () => {
    const { issues } = parseKmkDetailed(FIXTURE, 2025, SOURCE);
    expect(issues.filter((i) => !i.startsWith('state row not found'))).toEqual([
      'Bayern / Ostern: 2 ranges in one cell; kind not determinable, recorded as "other"',
    ]);
  });

  it('refuses text that names other years', () => {
    expect(() => parseKmkText(FIXTURE, 2024, SOURCE)).toThrow();
  });
});

describe('vacationShareByWeek', () => {
  it('counts weekdays, not weeks: Sommer 30.07.-12.09.2026 covers 2 of 5 days in W31', () => {
    // W31 = Mon 27.07.-Fri 31.07.2026; only Thu 30.07. and Fri 31.07. are in the range.
    const entries = [e('de-x', 'summer', '2026-07-30', '2026-09-12')];
    expect(vacationShareByWeek(entries, 'de-x', ['2026-W31', '2026-W37', '2026-W38'])).toEqual([0.4, 1, 0]);
  });

  it('single-day entry counts as one weekday', () => {
    // W20 = Mon 11.05.-Fri 15.05.2026; only Thu 14.05. is covered.
    const entries = [e('de-x', 'other', '2026-05-14', '2026-05-14')];
    expect(vacationShareByWeek(entries, 'de-x', ['2026-W20', '2026-W21'])).toEqual([0.2, 0]);
  });

  it('overlapping entries do not double count', () => {
    // W27 = Mon 29.06.-Fri 03.07.2026: Wed 01.07., Thu 02.07. and Fri 03.07. are covered by both entries.
    // W28 = Mon 06.07.-Fri 10.07.2026: only Mon 06.07. is covered.
    const entries = [e('de-x', 'other', '2026-07-01', '2026-07-03'), e('de-x', 'other', '2026-07-02', '2026-07-06')];
    expect(vacationShareByWeek(entries, 'de-x', ['2026-W27', '2026-W28'])).toEqual([0.6, 0.2]);
  });

  it('Christmas range across the year boundary, incl. ISO week 53 of 2026', () => {
    // 23.12.2026-02.01.2027. W52 = Mon 21.12.-Fri 25.12.2026 (23.-25. covered); W53 = Mon 28.12.2026-Fri 01.01.2027 (all covered);
    // 2027-W01 = Mon 04.01.-Fri 08.01.2027 (not covered).
    const entries = [e('de-x', 'christmas', '2026-12-23', '2027-01-02')];
    expect(vacationShareByWeek(entries, 'de-x', ['2026-W52', '2026-W53', '2027-W01'])).toEqual([0.6, 1, 0]);
  });

  it('uses only entries of the requested region', () => {
    const entries = [e('de-x', 'summer', '2026-07-30', '2026-09-12'), e('de-y', 'summer', '2026-07-30', '2026-09-12')];
    expect(vacationShareByWeek(entries, 'de-z', ['2026-W37'])).toEqual([0]);
  });

  it('parsed Baden-Württemberg Christmas range: week 2026-W02 starts on the last covered day (Mon 05.01.)', () => {
    const entries = parseKmkText(FIXTURE, 2025, SOURCE);
    expect(vacationShareByWeek(entries, 'de-bw', ['2025-W52', '2026-W01', '2026-W02'])).toEqual([1, 1, 0.2]);
  });
});

/** Entries without the source field, for comparisons across PDFs. */
const plain = (es: VacationEntry[]): Omit<VacationEntry, 'source'>[] =>
  es.map(({ source: _source, ...rest }) => rest);

describe('parseKmkDetailed on the 2012/13 PDF (older layout: "()"/"(-)" footnotes, lone "-" markers)', () => {
  const SRC = 'KMK Ferienkalender 2012/13 (FER2012_13.pdf)';
  const { entries, issues } = parseKmkDetailed(OLD_2012, 2012, SRC);
  const byRegion = (region: string): Omit<VacationEntry, 'source'>[] =>
    plain(entries.filter((x) => x.region === region));

  it('keeps every entry on the source of its PDF', () => {
    expect(entries.every((x) => x.source === SRC)).toBe(true);
  });

  it('reads Baden-Württemberg with a lone "-" winter marker as no winter entry', () => {
    expect(byRegion('de-bw')).toEqual([
      { region: 'de-bw', kind: 'autumn', start: '2012-10-29', end: '2012-11-02' },
      { region: 'de-bw', kind: 'christmas', start: '2012-12-24', end: '2013-01-05' },
      { region: 'de-bw', kind: 'easter', start: '2013-03-25', end: '2013-04-05' },
      { region: 'de-bw', kind: 'pentecost', start: '2013-05-21', end: '2013-06-01' },
      { region: 'de-bw', kind: 'summer', start: '2013-07-25', end: '2013-09-07' },
    ]);
  });

  it('reads Bayern with the "()" footnote and the winter range from the 2013 column', () => {
    expect(byRegion('de-by')).toEqual([
      { region: 'de-by', kind: 'autumn', start: '2012-10-29', end: '2012-11-03' },
      { region: 'de-by', kind: 'christmas', start: '2012-12-24', end: '2013-01-05' },
      { region: 'de-by', kind: 'winter', start: '2013-02-11', end: '2013-02-15' },
      { region: 'de-by', kind: 'easter', start: '2013-03-25', end: '2013-04-06' },
      { region: 'de-by', kind: 'pentecost', start: '2013-05-21', end: '2013-05-31' },
      { region: 'de-by', kind: 'summer', start: '2013-07-31', end: '2013-09-11' },
    ]);
  });

  it('reads the "und" pattern "10.05. und 21.05." as two single days, and drops the ambiguous Berlin summer', () => {
    expect(byRegion('de-be').filter((x) => x.kind === 'other' || x.kind === 'summer')).toEqual([
      { region: 'de-be', kind: 'other', start: '2013-05-10', end: '2013-05-10' },
      { region: 'de-be', kind: 'other', start: '2013-05-21', end: '2013-05-21' },
    ]);
    expect(issues.filter((i) => !i.startsWith('state row not found'))).toEqual([
      'line 12: "19./20.06. - 02.08." in column Sommer has an ambiguous start day or month; dropped',
      'Berlin / Sommer: no date and no "--" marker',
    ]);
  });

  it('joins a two-line Pfingsten cell in Sachsen: "10.05. und" above, "18.05. – 22.05." below the row', () => {
    expect(byRegion('de-sn').filter((x) => x.kind === 'other' || x.kind === 'pentecost')).toEqual([
      { region: 'de-sn', kind: 'other', start: '2013-05-10', end: '2013-05-10' },
      { region: 'de-sn', kind: 'pentecost', start: '2013-05-18', end: '2013-05-22' },
    ]);
  });

  it('reads Sachsen-Anhalt with the unpunctuated "01.02 – 08.02." winter range', () => {
    expect(byRegion('de-st')).toEqual([
      { region: 'de-st', kind: 'autumn', start: '2012-10-29', end: '2012-11-02' },
      { region: 'de-st', kind: 'christmas', start: '2012-12-19', end: '2013-01-04' },
      { region: 'de-st', kind: 'winter', start: '2013-02-01', end: '2013-02-08' },
      { region: 'de-st', kind: 'easter', start: '2013-03-25', end: '2013-03-30' },
      { region: 'de-st', kind: 'pentecost', start: '2013-05-10', end: '2013-05-18' },
      { region: 'de-st', kind: 'summer', start: '2013-07-15', end: '2013-08-28' },
    ]);
  });
});

describe('parseKmkDetailed on the 2015/16 PDF (single-day "17. 05." and "05. – 17.10." cells)', () => {
  const SRC = 'KMK Ferienkalender 2015/16 (FER2015_16.pdf)';
  const { entries, issues } = parseKmkDetailed(OLD_2015, 2015, SRC);
  const byRegion = (region: string): Omit<VacationEntry, 'source'>[] =>
    plain(entries.filter((x) => x.region === region));

  it('reads "06.05. / 17. 05." (space after the day dot) as two single days in Niedersachsen', () => {
    expect(byRegion('de-ni').filter((x) => x.start.startsWith('2016-05'))).toEqual([
      { region: 'de-ni', kind: 'other', start: '2016-05-06', end: '2016-05-06' },
      { region: 'de-ni', kind: 'other', start: '2016-05-17', end: '2016-05-17' },
    ]);
  });

  it('joins the two-line Pfingsten cell in Hamburg: "06.05. und" above, "17.05. – 20.05." below', () => {
    expect(byRegion('de-hh').filter((x) => x.start.startsWith('2016-05'))).toEqual([
      { region: 'de-hh', kind: 'other', start: '2016-05-06', end: '2016-05-06' },
      { region: 'de-hh', kind: 'pentecost', start: '2016-05-17', end: '2016-05-20' },
    ]);
  });

  it('reads Thüringen Christmas, winter and summer, and drops the Herbst cell "05. – 17.10." (no start month)', () => {
    expect(byRegion('de-th')).toEqual([
      { region: 'de-th', kind: 'christmas', start: '2015-12-23', end: '2016-01-02' },
      { region: 'de-th', kind: 'winter', start: '2016-02-01', end: '2016-02-06' },
      { region: 'de-th', kind: 'easter', start: '2016-03-24', end: '2016-04-02' },
      { region: 'de-th', kind: 'other', start: '2016-05-06', end: '2016-05-06' },
      { region: 'de-th', kind: 'summer', start: '2016-06-27', end: '2016-08-10' },
    ]);
  });

  it('reports the ambiguous and unmarked cells as issues, never as entries', () => {
    expect(issues.filter((i) => !i.startsWith('state row not found'))).toEqual([
      'line 12: "20./21.07. - 02.09." in column Sommer has an ambiguous start day or month; dropped',
      'line 28: "05. – 17.10." in column Herbst has an ambiguous start day or month; dropped',
      'Berlin / Sommer: no date and no "--" marker',
      'Rheinland-Pfalz / Himmelfahrt/Pfingsten: no date and no "--" marker',
      'Saarland / Himmelfahrt/Pfingsten: no date and no "--" marker',
      'Thüringen / Herbst: no date and no "--" marker',
    ]);
  });
});

describe('vacation data files data/external/holidays/<year>.json (2012-2027)', () => {
  const FIRST_YEAR = 2012;
  const LAST_YEAR = 2027;
  const load = (year: number): { year: number; entries: VacationEntry[] } =>
    JSON.parse(readFileSync(fileURLToPath(new URL(`../../data/external/holidays/${year}.json`, import.meta.url)), 'utf8'));
  const files = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => load(FIRST_YEAR + i));
  const all = files.flatMap((f) => f.entries);
  const regions = REGIONS.filter((r) => r.id !== 'de').map((r) => r.id);

  /**
   * Summer or Christmas cells that the PDFs leave unparsed (see the Berlin issues in the 2012/13, 2013/14
   * and 2015/16 PDFs). Listed explicitly so that a new gap or a silently repaired one fails the test.
   */
  const KNOWN_GAPS = new Set(['de-be|2012/13|summer', 'de-be|2013/14|summer', 'de-be|2015/16|summer']);

  it('has one file per calendar year with the year field matching the file', () => {
    files.forEach((f, i) => expect(f.year).toBe(FIRST_YEAR + i));
  });

  it('keeps every entry in the file of its start year, with end on or after start', () => {
    for (const f of files) {
      for (const e of f.entries) {
        expect(e.start.startsWith(`${f.year}-`), `${e.region} ${e.kind} ${e.start}`).toBe(true);
        expect(e.end >= e.start, `${e.region} ${e.kind} ${e.start}..${e.end}`).toBe(true);
      }
    }
    expect(all.length).toBeGreaterThan(1000);
  });

  it('has a Christmas entry for every state in every season 2012/13-2027/28', () => {
    const missing: string[] = [];
    for (let sy = FIRST_YEAR; sy <= LAST_YEAR; sy++) {
      for (const r of regions) {
        const has = all.some((e) => e.region === r && e.kind === 'christmas' && e.start.startsWith(`${sy}-`));
        if (!has) missing.push(`${r}|${sy}/${String(sy + 1).slice(2)}|christmas`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('has a summer entry for every state in every season 2012/13-2026/27, except the known gaps', () => {
    // The summer of season 2027/28 falls in 2028, which is outside the 2012-2027 files.
    const gaps: string[] = [];
    for (let sy = FIRST_YEAR; sy < LAST_YEAR; sy++) {
      for (const r of regions) {
        const has = all.some((e) => e.region === r && e.kind === 'summer' && e.start.startsWith(`${sy + 1}-`));
        if (!has) gaps.push(`${r}|${sy}/${String(sy + 1).slice(2)}|summer`);
      }
    }
    expect(new Set(gaps)).toEqual(KNOWN_GAPS);
    expect(gaps.length).toBe(KNOWN_GAPS.size);
  });

  it('carries concrete values from the PDFs, incl. the 2021/22 and 2022/23 files', () => {
    const find = (year: number, region: string, kind: VacationEntry['kind']): Omit<VacationEntry, 'source'>[] =>
      plain(files[year - FIRST_YEAR]!.entries.filter((e) => e.region === region && e.kind === kind));
    // FER2020_21: Sachsen "08.02. – 20.02." winter; Thüringen "08.02. – 13.02."
    expect(find(2021, 'de-sn', 'winter')).toEqual([{ region: 'de-sn', kind: 'winter', start: '2021-02-08', end: '2021-02-20' }]);
    expect(find(2021, 'de-th', 'winter')).toEqual([{ region: 'de-th', kind: 'winter', start: '2021-02-08', end: '2021-02-13' }]);
    // FER2021_22: Berlin Christmas "24.12. – 31.12."; Berlin summer "07.07. – 19.08." (in 2022.json)
    expect(find(2021, 'de-be', 'christmas')).toEqual([{ region: 'de-be', kind: 'christmas', start: '2021-12-24', end: '2021-12-31' }]);
    expect(find(2022, 'de-be', 'summer')).toEqual([{ region: 'de-be', kind: 'summer', start: '2022-07-07', end: '2022-08-19' }]);
  });
});
