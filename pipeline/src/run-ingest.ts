import { appendChanges } from '@coldfront/forecast-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DATA, CONFIG, longPath, sourcePath } from './paths';
import { downloadText } from './http';
import { readLongFile, writeLongFile } from './long-table';
import type { NewRow, SourceMeta } from './types';
import { SOURCE as AMELAG, parseAmelag } from './ingest/amelag';
import { SOURCE as ARE, parseAre } from './ingest/rki-are';
import { SOURCE as GRIPPEWEB, parseGrippeweb } from './ingest/rki-grippeweb';
import { SOURCE as IFSG, parseIfsgInfluenza } from './ingest/rki-ifsg-influenza';
import { SOURCE as DWD, ingestWeather, type StationConfig } from './ingest/dwd-weather';

type Source = Omit<SourceMeta, 'retrieved' | 'sha256'>;

interface TextJob {
  indicator: string;
  source: Source;
  parse: (text: string) => NewRow[];
  after?: (text: string) => void;
}

const TEXT_JOBS: TextJob[] = [
  { indicator: 'are', source: ARE, parse: parseAre },
  { indicator: 'grippeweb', source: GRIPPEWEB, parse: parseGrippeweb },
  { indicator: 'ifsg-influenza', source: IFSG, parse: parseIfsgInfluenza },
  {
    indicator: 'amelag',
    source: AMELAG,
    parse: (t) => parseAmelag(t).rows,
    after: (t) => {
      const file = resolve(DATA, 'external/wastewater-sites.json');
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(parseAmelag(t).sites, null, 1) + '\n');
    },
  },
];

function writeSource(source: Source, retrieved: string, sha256: string): void {
  const file = sourcePath(source.id);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ ...source, retrieved, sha256 }, null, 2) + '\n');
}

function merge(indicator: string, rows: NewRow[], asOf: string): number {
  const path = longPath(indicator);
  const existing = readLongFile(path);
  const added = appendChanges(existing, rows, asOf);
  if (added.length > 0) writeLongFile(path, [...existing, ...added]);
  return added.length;
}

/** Download all sources, merge new/changed weekly rows into the append-only tables. */
export async function runIngest(asOf: string, only?: string[]): Promise<void> {
  for (const job of TEXT_JOBS) {
    if (only && !only.includes(job.indicator)) continue;
    const { text, sha256 } = await downloadText(job.source.url);
    const rows = job.parse(text);
    const added = merge(job.indicator, rows, asOf);
    job.after?.(text);
    writeSource(job.source, asOf, sha256);
    console.log(`${job.indicator}: ${rows.length} rows parsed, ${added} new/changed`);
  }
  if (!only || only.includes('weather')) {
    const stations = JSON.parse(readFileSync(resolve(CONFIG, 'weather-stations.json'), 'utf8')) as StationConfig;
    // Weather before 2012 is not needed (ARE starts 2012-W40); keeps the table small.
    const rows = (await ingestWeather(stations)).filter((r) => r.week >= '2012-W01');
    const added = merge('weather', rows, asOf);
    writeSource(DWD, asOf, 'n/a (many station files)');
    console.log(`weather: ${rows.length} rows built, ${added} new/changed`);
  }
}
