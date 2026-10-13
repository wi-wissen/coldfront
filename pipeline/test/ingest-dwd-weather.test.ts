import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  combineStations,
  mergeDaily,
  parseDailyProduct,
  SOURCE,
  toRows,
  weeklyFromDaily,
  type DailyObs,
} from '../src/ingest/dwd-weather';

const fixture = readFileSync(new URL('./fixtures/dwd-kl-product.txt', import.meta.url), 'utf8');

const day = (date: string, tmax: number | null, tmin: number | null): DailyObs => ({ date, tmax, tmin });

describe('parseDailyProduct', () => {
  it('parses the fixture excerpt (30 days, header with padded names, trailing eor)', () => {
    const obs = parseDailyProduct(fixture);
    expect(obs).toHaveLength(30);
    expect(obs[0]!.date).toBe('2000-12-25');
    expect(obs.at(-1)!.date).toBe('2001-01-23');
    // Dec 27 2000 is a complete day in the excerpt.
    const dec27 = obs.find((o) => o.date === '2000-12-27')!;
    expect(dec27.tmax).toBeTypeOf('number');
    expect(dec27.tmin).toBeTypeOf('number');
  });

  it('maps -999 to null for TXK and TNK', () => {
    const obs = parseDailyProduct(fixture);
    expect(obs[0]).toEqual({ date: '2000-12-25', tmax: null, tmin: null });
    expect(obs[1]).toEqual({ date: '2000-12-26', tmax: null, tmin: null });
  });

  it('reads TXK and TNK by column name, not by position', () => {
    const text = [
      'STATIONS_ID;MESS_DATUM;TNK;TXK;eor',
      '    1;20240102;  -1.5;  4.25;eor',
      '    1;20240103;  -999;  -999;eor',
    ].join('\n');
    expect(parseDailyProduct(text)).toEqual([
      { date: '2024-01-02', tmax: 4.25, tmin: -1.5 },
      { date: '2024-01-03', tmax: null, tmin: null },
    ]);
  });

  it('throws when a required column is missing', () => {
    expect(() => parseDailyProduct('STATIONS_ID;MESS_DATUM;TXK;eor\n1;20240102;3.0;eor')).toThrow(/TNK/);
  });
});

describe('mergeDaily', () => {
  it('lets recent rows win on overlapping dates and sorts by date', () => {
    const historical = [day('2024-01-02', 3, 4), day('2024-01-01', 1, 2)];
    const recent = [day('2024-01-03', 7, 8), day('2024-01-02', 5, 6)];
    expect(mergeDaily(historical, recent)).toEqual([
      day('2024-01-01', 1, 2),
      day('2024-01-02', 5, 6),
      day('2024-01-03', 7, 8),
    ]);
  });
});

describe('weeklyFromDaily', () => {
  // 2024-01-01 is a Monday, so ISO week 2024-W01 starts on Jan 1.
  const obs: DailyObs[] = [
    // 2024-W01 (Jan 1-7): five valid days for both variables -> kept, mean tmax 2, tmin -3.
    day('2024-01-01', 0, -1),
    day('2024-01-02', 1, -2),
    day('2024-01-03', 2, -3),
    day('2024-01-04', 3, -4),
    day('2024-01-05', 4, -5),
    day('2024-01-06', null, null),
    day('2024-01-07', null, null),
    // 2024-W02 (Jan 8-14): only four valid tmax days -> dropped.
    day('2024-01-08', 1, 0),
    day('2024-01-09', 2, 0),
    day('2024-01-10', 3, 0),
    day('2024-01-11', 4, 0),
    day('2024-01-12', null, 0),
    day('2024-01-13', null, 0),
    day('2024-01-14', null, 0),
    // 2024-W03 (Jan 15-21): complete, seven valid days.
    day('2024-01-15', 10, 0),
    day('2024-01-16', 11.5, 1),
    day('2024-01-17', 12, 2),
    day('2024-01-18', 13, 3),
    day('2024-01-19', 14, 4),
    day('2024-01-20', 15, 5),
    day('2024-01-21', 16, 6),
    // 2024-W04 (Jan 22-28): five valid days, but Sunday Jan 28 is after the last observation -> dropped.
    day('2024-01-22', 5, 1),
    day('2024-01-23', 5, 1),
    day('2024-01-24', 5, 1),
    day('2024-01-25', 5, 1),
    day('2024-01-26', 5, 1),
  ];

  it('keeps weeks with >= 5 valid days, drops weeks with fewer, and drops incomplete weeks', () => {
    const weekly = weeklyFromDaily(obs);
    expect(weekly.map((w) => w.week)).toEqual(['2024-W01', '2024-W03']);
  });

  it('computes hand-checked means', () => {
    const [w1, w3] = weeklyFromDaily(obs);
    expect(w1!.tmax).toBeCloseTo((0 + 1 + 2 + 3 + 4) / 5, 10); // 2
    expect(w1!.tmin).toBeCloseTo((-1 - 2 - 3 - 4 - 5) / 5, 10); // -3
    expect(w3!.tmax).toBeCloseTo((10 + 11.5 + 12 + 13 + 14 + 15 + 16) / 7, 10); // 91.5 / 7
    expect(w3!.tmin).toBeCloseTo((0 + 1 + 2 + 3 + 4 + 5 + 6) / 7, 10); // 3
  });

  it('returns nothing for empty input', () => {
    expect(weeklyFromDaily([])).toEqual([]);
  });

  it('handles the ISO year boundary and the -999 gap in the fixture', () => {
    const weekly = weeklyFromDaily(parseDailyProduct(fixture));
    // 2000-W52 (Dec 25-31): Dec 25 and 26 are missing, so exactly five valid days -> kept.
    const w52 = weekly.find((w) => w.week === '2000-W52');
    expect(w52).toBeDefined();
    // Week 2001-W01 starts on Mon Jan 1 2001 and is complete (seven days).
    expect(weekly.find((w) => w.week === '2001-W01')).toBeDefined();
    // 2001-W04 ends on Sun Jan 28, after the last observation (Jan 23) -> dropped.
    expect(weekly.find((w) => w.week === '2001-W04')).toBeUndefined();
  });
});

describe('combineStations', () => {
  it('averages the stations that have each week, unweighted', () => {
    const a = [
      { week: '2024-W01' as const, tmax: 2, tmin: -3 },
      { week: '2024-W02' as const, tmax: 4, tmin: 0 },
    ];
    const b = [{ week: '2024-W01' as const, tmax: 4, tmin: -1 }];
    const c = [
      { week: '2024-W02' as const, tmax: 6, tmin: 2 },
      { week: '2024-W03' as const, tmax: 9, tmin: 5 },
    ];
    expect(combineStations([a, b, c])).toEqual([
      { week: '2024-W01', tmax: 3, tmin: -2 },
      { week: '2024-W02', tmax: 5, tmin: 1 },
      { week: '2024-W03', tmax: 9, tmin: 5 },
    ]);
  });

  it('returns an empty list for no stations', () => {
    expect(combineStations([])).toEqual([]);
  });
});

describe('toRows', () => {
  it('emits tmax and tmin rows per week, rounded to 2 decimals', () => {
    const rows = toRows('de-sn', [
      { week: '2024-W01', tmax: 3.14159, tmin: -0.5649 },
      { week: '2024-W02', tmax: 4.125, tmin: -2 },
    ]);
    expect(rows).toEqual([
      { region: 'de-sn', series: 'tmax', week: '2024-W01', value: 3.14 },
      { region: 'de-sn', series: 'tmin', week: '2024-W01', value: -0.56 },
      { region: 'de-sn', series: 'tmax', week: '2024-W02', value: 4.13 },
      { region: 'de-sn', series: 'tmin', week: '2024-W02', value: -2 },
    ]);
  });
});

describe('SOURCE', () => {
  it('declares the DWD kl source with CC BY 4.0', () => {
    expect(SOURCE.id).toBe('dwd-kl');
    expect(SOURCE.license).toBe('CC BY 4.0');
    expect(SOURCE.url.endsWith('/climate/daily/kl/')).toBe(true);
  });
});
