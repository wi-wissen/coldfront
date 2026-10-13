import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  parseKmkDetailed,
  parseKmkText,
  vacationShareByWeek,
  type VacationEntry,
} from '../src/ingest/holidays';

const FIXTURE = readFileSync(fileURLToPath(new URL('./fixtures/kmk-excerpt.txt', import.meta.url)), 'utf8');
const SOURCE = 'KMK Ferienkalender 2025/26 (FER2025_26.pdf)';

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
