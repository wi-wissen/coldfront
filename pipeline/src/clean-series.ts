import {
  REGIONS, addWeeks, compareWeeks, snapshotAt, weekRange, type IsoWeek, type LongRow, type RegionData, type WeeklySeries,
} from '@coldfront/forecast-core';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DATA, cleanPath, longPath } from './paths';
import { readLongFile } from './long-table';
import { vacationShareByWeek, type VacationEntry } from './ingest/holidays';

/** Columns of data/clean/<region>/series.csv */
export const CLEAN_COLUMNS = ['are', 'wastewater_sars', 'wastewater_flu', 'wastewater_rsv', 'tmax', 'tmin', 'holiday'] as const;
export type CleanColumn = (typeof CLEAN_COLUMNS)[number];

const WASTEWATER_MAP: Record<string, CleanColumn> = {
  'ww|SARS-CoV-2': 'wastewater_sars',
  'ww|Influenza A+B': 'wastewater_flu',
  'ww|RSV A+B': 'wastewater_rsv',
};

/** How many weeks beyond the last observed ARE week the calendar signal is kept. */
const CALENDAR_LOOKAHEAD = 12;

function loadVacations(): VacationEntry[] {
  const dir = resolve(DATA, 'external/holidays');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .flatMap((f) => (JSON.parse(readFileSync(resolve(dir, f), 'utf8')) as { entries: VacationEntry[] }).entries);
}

function lookup(rows: LongRow[], indicator: string): Map<string, number> {
  // key: region|series|week
  const m = new Map<string, number>();
  for (const r of snapshotAt(rows, '9999-12-31')) m.set(`${r.region}|${r.series}|${r.week}`, r.value);
  void indicator;
  return m;
}

/** Build data/clean/<region>/series.csv for every region from the long tables at data version `asOf`. */
export function buildCleanSeries(asOf: string): { regions: string[]; lastWeek: IsoWeek } {
  const snap = (indicator: string) => lookup(snapshotAtRows(readLongFile(longPath(indicator)), asOf), indicator);
  const are = snap('are');
  const ww = snap('amelag');
  const weather = snap('weather');
  const vacations = loadVacations();

  let first: IsoWeek | null = null;
  let last: IsoWeek | null = null;
  for (const key of are.keys()) {
    const [region, series, week] = key.split('|') as [string, string, IsoWeek];
    if (series !== '00+' || region !== 'de') continue;
    if (!first || compareWeeks(week, first) < 0) first = week;
    if (!last || compareWeeks(week, last) > 0) last = week;
  }
  if (!first || !last) throw new Error('No ARE data in data/long/are.csv.gz; run ingest first');
  const weeks = weekRange(first, addWeeks(last, CALENDAR_LOOKAHEAD));

  const stateIds = REGIONS.filter((r) => r.id !== 'de').map((r) => r.id);
  const holidayBy = new Map<string, number[]>();
  for (const id of stateIds) holidayBy.set(id, vacationShareByWeek(vacations, id, weeks));
  holidayBy.set('de', weeks.map((_, i) => stateIds.reduce((a, id) => a + holidayBy.get(id)![i]!, 0) / stateIds.length));
  const holidayKnown = vacations.length > 0;
  const lastVacation = vacations.reduce((m, v) => (v.end > m ? v.end : m), '0000');
  // Before the first recorded entry the share is unknown (not zero).
  const firstVacation = vacations.reduce((m, v) => (v.start < m ? v.start : m), '9999');

  for (const r of REGIONS) {
    const lines = [['week', ...CLEAN_COLUMNS].join(',')];
    weeks.forEach((w, i) => {
      const cells: string[] = [w];
      for (const col of CLEAN_COLUMNS) {
        let v: number | undefined;
        if (col === 'are') v = are.get(`${r.id}|00+|${w}`);
        else if (col === 'tmax' || col === 'tmin') v = weather.get(`${r.id}|${col}|${w}`);
        else if (col === 'holiday') v = holidayKnown && weekStartIso(w) >= firstVacation && weekStartIso(w) <= lastVacation ? holidayBy.get(r.id)![i] : undefined;
        else {
          const series = Object.entries(WASTEWATER_MAP).find(([, c]) => c === col)![0];
          v = ww.get(`${r.id}|${series}|${w}`);
        }
        cells.push(v === undefined ? '' : String(v));
      }
      lines.push(cells.join(','));
    });
    const file = cleanPath(r.id);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, lines.join('\n') + '\n');
  }
  return { regions: REGIONS.map((r) => r.id), lastWeek: last };
}

function snapshotAtRows(rows: LongRow[], asOf: string): LongRow[] {
  return snapshotAt(rows, asOf);
}

function weekStartIso(w: IsoWeek): string {
  // Monday of the ISO week as YYYY-MM-DD (string compare against vacation end dates)
  const [y, wk] = w.split('-W').map(Number) as [number, number];
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const dow = jan4.getUTCDay() || 7;
  const monday = new Date(jan4.getTime() - (dow - 1) * 86400000 + (wk - 1) * 7 * 86400000);
  return monday.toISOString().slice(0, 10);
}

/** Read the cleaned series of all regions as model input. */
export function loadRegionData(): RegionData[] {
  const out: RegionData[] = [];
  for (const r of REGIONS) {
    const text = readFileSync(cleanPath(r.id), 'utf8').trim().split('\n');
    const header = text[0]!.split(',');
    const rows = text.slice(1).map((l) => l.split(','));
    const col = (name: CleanColumn): (number | null)[] => {
      const j = header.indexOf(name);
      return rows.map((c) => (c[j] === '' || c[j] === undefined ? null : Number(c[j])));
    };
    const weeks = rows.map((c) => c[0]!);
    const series = (name: CleanColumn, trimEnd: boolean): WeeklySeries | null => {
      const v = col(name);
      const firstIdx = v.findIndex((x) => x !== null);
      if (firstIdx < 0) return null;
      let lastIdx = v.length - 1;
      if (trimEnd) while (lastIdx > firstIdx && v[lastIdx] === null) lastIdx--;
      return { start: weeks[firstIdx]!, values: v.slice(firstIdx, lastIdx + 1) };
    };
    const target = series('are', true);
    if (!target) continue;
    const signals: Record<string, WeeklySeries> = {};
    for (const name of CLEAN_COLUMNS) {
      if (name === 'are') continue;
      const s = series(name, name !== 'holiday');
      if (s) signals[name] = s;
    }
    out.push({ region: r.id, target, signals });
  }
  return out;
}
