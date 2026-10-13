import { REGIONS, appendChanges, snapshotAt, type LongRow } from '@coldfront/forecast-core';
import { execFileSync } from 'node:child_process';
import { longPath } from './paths';
import { readLongFile, writeLongFile } from './long-table';
import { parseAre } from './ingest/rki-are';
import type { NewRow } from './types';

/** One published state of a source file: all rows as they were visible on `asOf` (YYYY-MM-DD). */
export interface DataVersion {
  asOf: string;
  rows: NewRow[];
}

/**
 * Fold data versions into an append-only long table. Versions are sorted by
 * `asOf` (versions sharing a date are collapsed, the last one wins); each value
 * change gets the as_of of the first version that showed it. Identical
 * consecutive versions add nothing, so `snapshotAt(result, v.asOf)` reproduces
 * every version (keys that vanish from a later version are kept, as the table
 * is append-only). Pure and deterministic.
 */
export function rebuildLongRows(versions: readonly DataVersion[]): LongRow[] {
  const byDate = new Map<string, DataVersion>();
  for (const v of versions) byDate.set(v.asOf, v);
  const sorted = [...byDate.values()].sort((a, b) => (a.asOf < b.asOf ? -1 : a.asOf > b.asOf ? 1 : 0));
  const out: LongRow[] = [];
  // Incremental "latest value per key" avoids the O(n^2) cost of calling appendChanges on the growing table.
  const latest = new Map<string, LongRow>();
  const k = (r: NewRow) => `${r.region}\u0000${r.series}\u0000${r.week}`;
  for (const v of sorted) {
    const added = appendChanges([...latest.values()], v.rows, v.asOf);
    // Duplicate keys inside one version: the last occurrence wins (as in a snapshot).
    for (const r of added) {
      latest.set(k(r), r);
    }
    out.push(...added);
  }
  return out;
}

export interface SkippedVersion {
  sha: string;
  asOf: string;
  error: string;
}

export interface GitVersionOptions {
  repoDir: string;
  /** Path of the data file inside the repository. */
  file: string;
  parse: (text: string) => NewRow[];
  /** Only commits with committer date >= sinceDate (YYYY-MM-DD). */
  sinceDate?: string;
  /** Receives the commits that could not be read or parsed (they are skipped). */
  skipped?: SkippedVersion[];
  /** Called after each commit (sequential fetch). */
  onProgress?: (done: number, total: number, asOf: string) => void;
}

const git = (repoDir: string, args: string[]): string =>
  execFileSync('git', ['-C', repoDir, ...args], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' } });

/**
 * Read every committed version of a file from a git repository (oldest first).
 * asOf = committer date; if several commits share a date the last one is kept.
 * Blobs are fetched strictly sequentially (a blobless clone loads them on demand).
 */
export function readGitVersions(opts: GitVersionOptions): DataVersion[] {
  const log = git(opts.repoDir, ['log', '--reverse', '--format=%H %cs', '--', opts.file])
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => {
      const [sha, asOf] = l.split(' ') as [string, string];
      return { sha, asOf };
    })
    .filter((c) => !opts.sinceDate || c.asOf >= opts.sinceDate);
  // Last commit per date (log is oldest first, so later entries overwrite).
  const perDate = new Map<string, { sha: string; asOf: string }>();
  for (const c of log) perDate.set(c.asOf, c);
  const commits = [...perDate.values()].sort((a, b) => (a.asOf < b.asOf ? -1 : 1));
  const out: DataVersion[] = [];
  commits.forEach((c, i) => {
    try {
      out.push({ asOf: c.asOf, rows: opts.parse(git(opts.repoDir, ['show', `${c.sha}:${opts.file}`])) });
    } catch (e) {
      opts.skipped?.push({ sha: c.sha, asOf: c.asOf, error: e instanceof Error ? e.message.split('\n')[0]! : String(e) });
    }
    opts.onProgress?.(i + 1, commits.length, c.asOf);
  });
  return out;
}

export interface BackfillOptions {
  repoDir: string;
  file: string;
  parse: (text: string) => NewRow[];
  indicator: string;
  /**
   * Rows of the current download (what a live ingest produced). Default: the
   * latest value per key of the existing table, which is the same set on the
   * first run and keeps the operation idempotent afterwards.
   */
  currentRows?: NewRow[];
  /** as_of that changes relative to the last git version receive. */
  currentAsOf: string;
  sinceDate?: string;
  /** Override the output path (tests). Default data/long/<indicator>.csv.gz. */
  path?: string;
  skipped?: SkippedVersion[];
  onProgress?: GitVersionOptions['onProgress'];
}

export interface BackfillResult {
  versions: number;
  rowsBefore: number;
  rowsAfter: number;
  path: string;
}

/**
 * Rebuild data/long/<indicator>.csv.gz from the git history plus the current
 * download as the last version. The current values stay the latest ones, so a
 * later live ingest (which compares with the latest value per key) adds only
 * genuinely new changes. Running it twice gives byte-identical output.
 */
export function backfillIndicator(opts: BackfillOptions): BackfillResult {
  const path = opts.path ?? longPath(opts.indicator);
  const existing = readLongFile(path);
  const current: NewRow[] =
    opts.currentRows ?? snapshotAt(existing, '9999-12-31').map(({ region, series, week, value }) => ({ region, series, week, value }));
  const versions = readGitVersions({ repoDir: opts.repoDir, file: opts.file, parse: opts.parse, sinceDate: opts.sinceDate, skipped: opts.skipped, onProgress: opts.onProgress });
  const rows = rebuildLongRows([...versions, { asOf: opts.currentAsOf, rows: current }]);
  writeLongFile(path, rows);
  return { versions: versions.length + 1, rowsBefore: existing.length, rowsAfter: rows.length, path };
}

export const ARE_FILE = 'ARE-Konsultationsinzidenz.tsv';

const ascii = (s: string) => s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

/**
 * parseAre plus support for the first RKI file layout (2023-09-13 .. 2023-10-12), which has
 * no Bundesland_ID column and names the states in ASCII ("Bundesweit", "Thueringen"). The
 * name is mapped to the id and the column is inserted; the modern layout passes through.
 */
export function parseAreAnyLayout(text: string): NewRow[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const header = lines[0]?.split('\t') ?? [];
  if (header.includes('Bundesland_ID') || !header.includes('Bundesland')) return parseAre(text);
  const ci = header.indexOf('Bundesland');
  const ids = new Map<string, number>([['Bundesweit', 0], ...REGIONS.map((r) => [ascii(r.name_de), r.rki_id] as [string, number])]);
  const out = [[...header.slice(0, ci + 1), 'Bundesland_ID', ...header.slice(ci + 1)].join('\t')];
  lines.slice(1).forEach((l, i) => {
    if (l.trim() === '') return;
    const f = l.split('\t');
    const id = ids.get(f[ci] ?? '');
    if (id === undefined) throw new Error(`rki-are (legacy layout): line ${i + 2}: unknown Bundesland "${f[ci]}"`);
    out.push([...f.slice(0, ci + 1), String(id), ...f.slice(ci + 1)].join('\t'));
  });
  return parseAre(out.join('\n'));
}

/** Backfill the ARE table from the RKI git history (CLI entry point). */
export function backfillAre(repoDir: string, asOfToday: string, extra: Partial<BackfillOptions> = {}): BackfillResult {
  return backfillIndicator({ repoDir, file: ARE_FILE, parse: parseAreAnyLayout, indicator: 'are', currentAsOf: asOfToday, ...extra });
}
