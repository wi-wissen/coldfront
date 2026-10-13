import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { snapshotAt } from '@coldfront/forecast-core';
import { afterAll, describe, expect, it } from 'vitest';
import { backfillIndicator, parseAreAnyLayout, readGitVersions, rebuildLongRows, type DataVersion } from '../src/backfill';
import { readLongFile } from '../src/long-table';
import type { NewRow } from '../src/types';

const row = (week: string, value: number, region = 'de', series = '00+'): NewRow => ({ region, series, week, value });
const V1: DataVersion = { asOf: '2026-01-07', rows: [row('2026-W01', 100), row('2026-W02', 110), row('2026-W01', 50, 'de-sn')] };
const V2: DataVersion = { asOf: '2026-01-14', rows: [row('2026-W01', 100), row('2026-W02', 120), row('2026-W03', 90), row('2026-W01', 50, 'de-sn')] };
const V3: DataVersion = { asOf: '2026-01-21', rows: [row('2026-W01', 101), row('2026-W02', 120), row('2026-W03', 95), row('2026-W04', 80), row('2026-W01', 50, 'de-sn')] };

const strip = (rows: { region: string; series: string; week: string; value: number }[]) => rows.map(({ region, series, week, value }) => ({ region, series, week, value }));
const sortRows = <T extends { region: string; week: string }>(rows: T[]) => [...rows].sort((a, b) => a.region.localeCompare(b.region) || a.week.localeCompare(b.week));

describe('rebuildLongRows', () => {
  it('gives each change the as_of of the version that first showed it', () => {
    const rows = rebuildLongRows([V1, V2, V3]);
    const hist = (week: string) => rows.filter((r) => r.region === 'de' && r.week === week).map((r) => [r.value, r.as_of]);
    expect(hist('2026-W01')).toEqual([[100, '2026-01-07'], [101, '2026-01-21']]);
    expect(hist('2026-W02')).toEqual([[110, '2026-01-07'], [120, '2026-01-14']]);
    expect(hist('2026-W03')).toEqual([[90, '2026-01-14'], [95, '2026-01-21']]);
    expect(hist('2026-W04')).toEqual([[80, '2026-01-21']]);
    expect(rows.filter((r) => r.region === 'de-sn')).toHaveLength(1);
  });
  it('is independent of input order and adds nothing for identical versions', () => {
    expect(rebuildLongRows([V3, V1, V2])).toEqual(rebuildLongRows([V1, V2, V3]));
    const dup = { ...V2, asOf: '2026-01-15' };
    expect(rebuildLongRows([V1, V2, dup])).toEqual(rebuildLongRows([V1, V2]));
    expect(rebuildLongRows([V1, V1])).toHaveLength(3);
  });
  it('snapshotAt reproduces every version', () => {
    const rows = rebuildLongRows([V1, V2, V3]);
    for (const v of [V1, V2, V3]) expect(sortRows(strip(snapshotAt(rows, v.asOf)))).toEqual(sortRows(strip(v.rows.map((r) => ({ ...r })))));
  });
  it('between versions the earlier snapshot is returned', () => {
    expect(snapshotAt(rebuildLongRows([V1, V2, V3]), '2026-01-20').find((r) => r.week === '2026-W01' && r.region === 'de')!.value).toBe(100);
  });
  it('same-date versions collapse, last wins', () => {
    const rows = rebuildLongRows([{ asOf: '2026-01-07', rows: [row('2026-W01', 1)] }, { asOf: '2026-01-07', rows: [row('2026-W01', 2)] }]);
    expect(rows).toEqual([{ ...row('2026-W01', 2), as_of: '2026-01-07' }]);
  });
});

describe('git versions', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cf-git-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const commit = (content: string, date: string, msg: string) => {
    writeFileSync(join(dir, 'data.tsv'), content);
    const env = { ...process.env, GIT_COMMITTER_DATE: `${date}T12:00:00Z`, GIT_AUTHOR_DATE: `${date}T12:00:00Z`, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.org', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.org' };
    execFileSync('git', ['-C', dir, 'add', 'data.tsv'], { env });
    execFileSync('git', ['-C', dir, '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', msg], { env });
  };
  // tiny parser: "region,series,week,value" lines; "BAD" fails
  const parse = (t: string): NewRow[] => {
    if (t.startsWith('BAD')) throw new Error('bad format');
    return t.trim().split('\n').map((l) => { const [region, series, week, v] = l.split(','); return row(week!, Number(v), region, series); });
  };
  const text = (v: V) => v.map(([w, x]) => `de,00+,${w},${x}`).join('\n') + '\n';
  type V = [string, number][];
  mkdirSync(dir, { recursive: true });
  execFileSync('git', ['init', '-q', dir]);
  commit(text([['2026-W01', 100], ['2026-W02', 110]]), '2026-01-07', 'a');
  commit('BAD header\n', '2026-01-10', 'bad');
  commit(text([['2026-W01', 100], ['2026-W02', 120]]), '2026-01-14', 'b1');
  commit(text([['2026-W01', 100], ['2026-W02', 121]]), '2026-01-14', 'b2');
  commit(text([['2026-W01', 101], ['2026-W02', 121], ['2026-W03', 90]]), '2026-01-21', 'c');

  it('reads versions oldest first, keeps the last commit per date and lists skipped commits', () => {
    const skipped: any[] = [];
    const versions = readGitVersions({ repoDir: dir, file: 'data.tsv', parse, skipped });
    expect(versions.map((v) => v.asOf)).toEqual(['2026-01-07', '2026-01-14', '2026-01-21']);
    expect(versions[1]!.rows.find((r) => r.week === '2026-W02')!.value).toBe(121);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].asOf).toBe('2026-01-10');
    expect(readGitVersions({ repoDir: dir, file: 'data.tsv', parse, sinceDate: '2026-01-14' }).map((v) => v.asOf)).toEqual(['2026-01-14', '2026-01-21']);
  });

  it('backfillIndicator rebuilds the table, keeps current values latest and is idempotent', () => {
    const path = join(dir, 'out', 'x.csv.gz');
    const current = [row('2026-W01', 101), row('2026-W02', 121), row('2026-W03', 90), row('2026-W04', 70)];
    const opts = { repoDir: dir, file: 'data.tsv', parse, indicator: 'x', currentAsOf: '2026-01-28', path, skipped: [] as any[] };
    const r1 = backfillIndicator({ ...opts, currentRows: current });
    const bytes1 = readFileSync(path);
    expect(r1.versions).toBe(4);
    const rows = readLongFile(path);
    expect(strip(snapshotAt(rows, '9999-12-31'))).toEqual(sortRows(strip(current.map((r) => ({ ...r })))).map((r) => r));
    expect(snapshotAt(rows, '2026-01-07').map((r) => r.value)).toEqual([100, 110]);
    // second run: current derived from the rebuilt table itself
    backfillIndicator({ ...opts, currentRows: undefined });
    expect(readFileSync(path).equals(bytes1)).toBe(true);
    backfillIndicator({ ...opts, currentRows: current });
    expect(readFileSync(path).equals(bytes1)).toBe(true);
  });
});

describe('parseAreAnyLayout', () => {
  const head = 'Saison\tKalenderwoche\tBundesland\tAltersgruppe\tARE_Konsultationsinzidenz';
  it('maps the legacy layout (no Bundesland_ID) onto region ids', () => {
    const rows = parseAreAnyLayout(`${head}\n2023/24\t2023-W40\tBundesweit\t00+\t970\n2023/24\t2023-W40\tThueringen\t00+\t800\n2023/24\t2023-W40\tBaden-Wuerttemberg\t0-4\t5\n`);
    expect(rows).toEqual([
      { region: 'de', series: '00+', week: '2023-W40', value: 970 },
      { region: 'de-th', series: '00+', week: '2023-W40', value: 800 },
      { region: 'de-bw', series: '0-4', week: '2023-W40', value: 5 },
    ]);
  });
  it('passes the modern layout through and rejects unknown names', () => {
    expect(parseAreAnyLayout('Saison\tKalenderwoche\tBundesland\tBundesland_ID\tAltersgruppe\tARE_Konsultationsinzidenz\n2023/24\t2023-W40\tBundesweit\t0\t00+\t1\n')).toHaveLength(1);
    expect(() => parseAreAnyLayout(`${head}\n2023/24\t2023-W40\tAtlantis\t00+\t1\n`)).toThrow(/unknown Bundesland/);
  });
});
