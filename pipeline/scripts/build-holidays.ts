/**
 * One-off: parse the KMK overview PDFs into data/external/holidays/<year>.json.
 * Usage: tsx pipeline/scripts/build-holidays.ts <pdfDir>
 * The PDFs are listed explicitly (file name + first calendar year of the season it names).
 * Issues (unparsed or dropped cells) go to stderr; nothing is guessed.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseKmkDetailed, type VacationEntry } from '../src/ingest/holidays';

/** Calendar years written to data/external/holidays/<year>.json (an entry belongs to its start year). */
const FIRST_YEAR = 2012;
const LAST_YEAR = 2027;

/** Seasons 2012/13 to 2027/28 (state vacation periods), one KMK overview PDF each. */
const PDFS: readonly { file: string; yearFrom: number }[] = [
  { file: 'FER2012_13.pdf', yearFrom: 2012 },
  { file: 'FER2013_14.pdf', yearFrom: 2013 },
  { file: 'FER2014_15.pdf', yearFrom: 2014 },
  { file: 'FER2015_16.pdf', yearFrom: 2015 },
  { file: 'FER2016_17_-_NEU.pdf', yearFrom: 2016 },
  { file: 'FER17_18.pdf', yearFrom: 2017 },
  { file: 'FER18_19.pdf', yearFrom: 2018 },
  { file: 'FER19_20.pdf', yearFrom: 2019 },
  { file: 'FER2020_21-neu.pdf', yearFrom: 2020 },
  { file: 'FER2021_22-neu.pdf', yearFrom: 2021 },
  { file: 'FER2022_23-neu.pdf', yearFrom: 2022 },
  { file: 'FER2023_24-neu.pdf', yearFrom: 2023 },
  { file: 'FER2024_25.pdf', yearFrom: 2024 },
  { file: 'FER2025_26.pdf', yearFrom: 2025 },
  { file: 'FER2026_27.pdf', yearFrom: 2026 },
  { file: 'FER2027_28.pdf', yearFrom: 2027 },
];

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../../data/external/holidays');

const pdfDir = process.argv[2];
if (!pdfDir) throw new Error('Usage: tsx pipeline/scripts/build-holidays.ts <pdfDir>');

const all: VacationEntry[] = [];
for (const { file, yearFrom } of PDFS) {
  const path = join(pdfDir, file);
  if (!existsSync(path)) throw new Error(`Missing KMK PDF: ${path}`);
  const text = execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8' });
  const source = `KMK Ferienkalender ${yearFrom}/${String(yearFrom + 1).slice(2)} (${file})`;
  const { entries, issues } = parseKmkDetailed(text, yearFrom, source);
  for (const issue of issues) console.error(`[${file}] ${issue}`);
  console.error(`[${file}] ${entries.length} entries`);
  all.push(...entries);
}

const cmp = (a: VacationEntry, b: VacationEntry): number => {
  if (a.region !== b.region) return a.region < b.region ? -1 : 1;
  if (a.start !== b.start) return a.start < b.start ? -1 : 1;
  if (a.end !== b.end) return a.end < b.end ? -1 : 1;
  return a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0;
};

mkdirSync(outDir, { recursive: true });
for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
  // An entry belongs to the calendar year in which it starts.
  const entries = all.filter((e) => e.start.startsWith(`${year}-`)).sort(cmp);
  writeFileSync(join(outDir, `${year}.json`), `${JSON.stringify({ year, entries }, null, 2)}\n`);
  console.error(`${year}.json: ${entries.length} entries`);
}
