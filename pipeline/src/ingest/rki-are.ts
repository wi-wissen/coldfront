import { regionByRkiId } from '@coldfront/forecast-core';
import type { NewRow, SourceMeta } from '../types';

/** Provenance of the RKI ARE consultation incidence file. */
export const SOURCE: Omit<SourceMeta, 'retrieved' | 'sha256'> = {
  id: 'rki-are',
  name: 'ARE-Konsultationsinzidenz',
  url: 'https://raw.githubusercontent.com/robert-koch-institut/ARE-Konsultationsinzidenz/main/ARE-Konsultationsinzidenz.tsv',
  attribution: 'Robert Koch-Institut, ARE-Konsultationsinzidenz, CC BY 4.0',
  license: 'CC BY 4.0',
  license_url: 'https://creativecommons.org/licenses/by/4.0/',
  doi: '',
};

const COLUMNS = [
  'Saison',
  'Kalenderwoche',
  'Bundesland',
  'Bundesland_ID',
  'Altersgruppe',
  'ARE_Konsultationsinzidenz',
] as const;

const WEEK = /^\d{4}-W\d{2}$/;
const MISSING = new Set(['', 'NA']);

/** Maps required column names to their index; throws if one is absent. */
function columnIndex<K extends string>(header: string, required: readonly K[]): Record<K, number> {
  const cols = header.split('\t');
  const missing = required.filter((k) => !cols.includes(k));
  if (missing.length > 0) {
    throw new Error(`rki-are: missing column(s) ${missing.join(', ')}; header is "${header}"`);
  }
  return Object.fromEntries(required.map((k) => [k, cols.indexOf(k)])) as Record<K, number>;
}

function splitRow(line: string, width: number, lineNo: number): string[] {
  const f = line.split('\t');
  if (f.length !== width) {
    throw new Error(`rki-are: line ${lineNo}: expected ${width} columns, found ${f.length}`);
  }
  return f;
}

/** Returns null for NA/empty, otherwise the finite number (throws on anything else). */
function parseValue(raw: string, lineNo: number): number | null {
  const s = raw.trim();
  if (MISSING.has(s)) return null;
  const v = Number(s);
  if (!Number.isFinite(v)) throw new Error(`rki-are: line ${lineNo}: not a number "${raw}"`);
  return v;
}

function checkWeek(raw: string, lineNo: number): string {
  if (!WEEK.test(raw)) throw new Error(`rki-are: line ${lineNo}: invalid week "${raw}"`);
  return raw;
}

/**
 * Parses ARE-Konsultationsinzidenz.tsv into weekly rows.
 * region = Bundesland_ID (0 -> "de"), series = Altersgruppe, value = ARE incidence.
 * NA/empty values are skipped; output keeps input order. Pure: no I/O.
 */
export function parseAre(text: string): NewRow[] {
  const raw = text.replace(/^﻿/, '').split(/\r?\n/);
  const header = raw[0];
  if (header === undefined || header.trim() === '') throw new Error('rki-are: empty input');
  const col = columnIndex(header, COLUMNS);
  const width = header.split('\t').length;

  const rows: NewRow[] = [];
  raw.forEach((line, i) => {
    if (i === 0 || line.trim() === '' || line === header) return;
    const lineNo = i + 1;
    const f = splitRow(line, width, lineNo);

    const week = checkWeek(f[col.Kalenderwoche] ?? '', lineNo);
    const rkiId = f[col.Bundesland_ID] ?? '';
    const region = /^\d+$/.test(rkiId) ? regionByRkiId(Number(rkiId)) : undefined;
    if (!region) throw new Error(`rki-are: line ${lineNo}: unknown Bundesland_ID "${rkiId}"`);

    const value = parseValue(f[col.ARE_Konsultationsinzidenz] ?? '', lineNo);
    if (value === null) return;

    rows.push({ region: region.id, series: f[col.Altersgruppe] ?? '', week, value });
  });
  return rows;
}
