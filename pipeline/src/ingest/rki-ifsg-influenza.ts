import { regionByAgs } from '@coldfront/forecast-core';
import type { NewRow, SourceMeta } from '../types';

/** Provenance of the RKI influenza case counts reported under IfSG. */
export const SOURCE: Omit<SourceMeta, 'retrieved' | 'sha256'> = {
  id: 'rki-ifsg-influenza',
  name: 'Influenzafälle in Deutschland',
  url: 'https://raw.githubusercontent.com/robert-koch-institut/Influenzafaelle_in_Deutschland/main/IfSG_Influenzafaelle.tsv',
  attribution: 'Robert Koch-Institut, Influenzafälle in Deutschland, CC BY 4.0',
  license: 'CC BY 4.0',
  license_url: 'https://creativecommons.org/licenses/by/4.0/',
  doi: '',
};

const COLUMNS = ['Meldewoche', 'Region', 'Region_Id', 'Altersgruppe', 'Fallzahl', 'Inzidenz'] as const;

const WEEK = /^\d{4}-W\d{2}$/;
const MISSING = new Set(['', 'NA']);

/** Maps required column names to their index; throws if one is absent. */
function columnIndex<K extends string>(header: string, required: readonly K[]): Record<K, number> {
  const cols = header.split('\t');
  const missing = required.filter((k) => !cols.includes(k));
  if (missing.length > 0) {
    throw new Error(`rki-ifsg-influenza: missing column(s) ${missing.join(', ')}; header is "${header}"`);
  }
  return Object.fromEntries(required.map((k) => [k, cols.indexOf(k)])) as Record<K, number>;
}

function splitRow(line: string, width: number, lineNo: number): string[] {
  const f = line.split('\t');
  if (f.length !== width) {
    throw new Error(`rki-ifsg-influenza: line ${lineNo}: expected ${width} columns, found ${f.length}`);
  }
  return f;
}

/** Returns null for NA/empty, otherwise the finite number (throws on anything else). */
function parseValue(raw: string, lineNo: number): number | null {
  const s = raw.trim();
  if (MISSING.has(s)) return null;
  const v = Number(s);
  if (!Number.isFinite(v)) throw new Error(`rki-ifsg-influenza: line ${lineNo}: not a number "${raw}"`);
  return v;
}

/**
 * Parses IfSG_Influenzafaelle.tsv into weekly rows.
 * region from Region_Id ("00" -> "de"); two rows per input line:
 * `cases|<Altersgruppe>` (Fallzahl) and `incidence|<Altersgruppe>` (Inzidenz).
 * NA/empty values are skipped per row; output keeps input order. Pure: no I/O.
 */
export function parseIfsgInfluenza(text: string): NewRow[] {
  const raw = text.replace(/^﻿/, '').split(/\r?\n/);
  const header = raw[0];
  if (header === undefined || header.trim() === '') throw new Error('rki-ifsg-influenza: empty input');
  const col = columnIndex(header, COLUMNS);
  const width = header.split('\t').length;

  const rows: NewRow[] = [];
  raw.forEach((line, i) => {
    if (i === 0 || line.trim() === '' || line === header) return;
    const lineNo = i + 1;
    const f = splitRow(line, width, lineNo);

    const week = (f[col.Meldewoche] ?? '').trim();
    if (!WEEK.test(week)) throw new Error(`rki-ifsg-influenza: line ${lineNo}: invalid week "${week}"`);

    const agsId = f[col.Region_Id] ?? '';
    const region = regionByAgs(agsId);
    if (!region) throw new Error(`rki-ifsg-influenza: line ${lineNo}: unknown Region_Id "${agsId}"`);

    const ageGroup = f[col.Altersgruppe] ?? '';
    const cases = parseValue(f[col.Fallzahl] ?? '', lineNo);
    const incidence = parseValue(f[col.Inzidenz] ?? '', lineNo);
    if (cases !== null) rows.push({ region: region.id, series: `cases|${ageGroup}`, week, value: cases });
    if (incidence !== null) rows.push({ region: region.id, series: `incidence|${ageGroup}`, week, value: incidence });
  });
  return rows;
}
