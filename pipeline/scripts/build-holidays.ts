/**
 * One-off: parse the KMK overview PDFs into data/external/holidays/<year>.json.
 * Usage: tsx pipeline/scripts/build-holidays.ts <pdfDir>
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseKmkDetailed, type VacationEntry } from '../src/ingest/holidays';

const FIRST_YEAR = 2022;
const LAST_YEAR = 2027;

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../../data/external/holidays');

const pdfDir = process.argv[2];
if (!pdfDir) throw new Error('Usage: tsx pipeline/scripts/build-holidays.ts <pdfDir>');

const pdfs = readdirSync(pdfDir)
  .filter((f) => /^FER\d{4}_\d{2}.*\.pdf$/.test(f))
  .sort();
if (pdfs.length !== 6) throw new Error(`Expected 6 KMK PDFs in ${pdfDir}, found ${pdfs.length}`);

const all: VacationEntry[] = [];
for (const file of pdfs) {
  const yearFrom = Number(/^FER(\d{4})_/.exec(file)![1]);
  const text = execFileSync('pdftotext', ['-layout', join(pdfDir, file), '-'], { encoding: 'utf8' });
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
