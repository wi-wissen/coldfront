import { REGIONS } from '@coldfront/forecast-core';
import type { NewRow, SourceMeta } from '../types';

/** Provenance of the RKI GrippeWeb weekly report data. */
export const SOURCE: Omit<SourceMeta, 'retrieved' | 'sha256'> = {
  id: 'rki-grippeweb',
  name: 'GrippeWeb Daten des Wochenberichts',
  url: 'https://raw.githubusercontent.com/robert-koch-institut/GrippeWeb_Daten_des_Wochenberichts/main/GrippeWeb_Daten_des_Wochenberichts.tsv',
  attribution: 'Robert Koch-Institut, GrippeWeb Daten des Wochenberichts, CC BY 4.0',
  license: 'CC BY 4.0',
  license_url: 'https://creativecommons.org/licenses/by/4.0/',
  doi: '',
};

const COLUMNS = [
  'Meldungen',
  'Saison',
  'Erkrankung',
  'Altersgruppe',
  'Region',
  'Kalenderwoche',
  'Inzidenz',
] as const;

/** RKI region labels used in the file, mapped to region ids. */
const RKI_REGION_IDS: Record<string, string> = {
  Bundesweit: 'de',
  'Mitte (West)': 'gw-mitte-west',
  'Norden (West)': 'gw-norden-west',
  Osten: 'gw-osten',
  Sueden: 'gw-sueden',
};

/** German state names (exact, with umlauts) mapped to state ids. */
const STATE_IDS: ReadonlyMap<string, string> = new Map(
  REGIONS.filter((r) => r.id !== 'de').map((r) => [r.name_de, r.id] as const),
);

const WEEK = /^\d{4}-W\d{2}$/;
const MISSING = new Set(['', 'NA']);

/** Maps required column names to their index; throws if one is absent. */
function columnIndex<K extends string>(header: string, required: readonly K[]): Record<K, number> {
  const cols = header.split('\t');
  const missing = required.filter((k) => !cols.includes(k));
  if (missing.length > 0) {
    throw new Error(`rki-grippeweb: missing column(s) ${missing.join(', ')}; header is "${header}"`);
  }
  return Object.fromEntries(required.map((k) => [k, cols.indexOf(k)])) as Record<K, number>;
}

function splitRow(line: string, width: number, lineNo: number): string[] {
  const f = line.split('\t');
  if (f.length !== width) {
    throw new Error(`rki-grippeweb: line ${lineNo}: expected ${width} columns, found ${f.length}`);
  }
  return f;
}

/** Returns null for NA/empty, otherwise the finite number (throws on anything else). */
function parseValue(raw: string, lineNo: number): number | null {
  const s = raw.trim();
  if (MISSING.has(s)) return null;
  const v = Number(s);
  if (!Number.isFinite(v)) throw new Error(`rki-grippeweb: line ${lineNo}: not a number "${raw}"`);
  return v;
}

function regionId(name: string, lineNo: number): string {
  const id = RKI_REGION_IDS[name] ?? STATE_IDS.get(name);
  if (id === undefined) throw new Error(`rki-grippeweb: line ${lineNo}: unknown Region "${name}"`);
  return id;
}

/**
 * Parses GrippeWeb_Daten_des_Wochenberichts.tsv into weekly rows.
 * region: "Bundesweit" -> "de", RKI regions -> "gw-*", German state names -> state id.
 * series = `${Erkrankung}|${Altersgruppe}`, value = Inzidenz.
 * Rows with NA/empty week or value are skipped; output keeps input order. Pure: no I/O.
 */
export function parseGrippeweb(text: string): NewRow[] {
  const raw = text.replace(/^﻿/, '').split(/\r?\n/);
  const header = raw[0];
  if (header === undefined || header.trim() === '') throw new Error('rki-grippeweb: empty input');
  const col = columnIndex(header, COLUMNS);
  const width = header.split('\t').length;

  const rows: NewRow[] = [];
  raw.forEach((line, i) => {
    if (i === 0 || line.trim() === '' || line === header) return;
    const lineNo = i + 1;
    const f = splitRow(line, width, lineNo);

    const week = (f[col.Kalenderwoche] ?? '').trim();
    if (MISSING.has(week)) return;
    if (!WEEK.test(week)) throw new Error(`rki-grippeweb: line ${lineNo}: invalid week "${week}"`);

    const region = regionId(f[col.Region] ?? '', lineNo);

    const value = parseValue(f[col.Inzidenz] ?? '', lineNo);
    if (value === null) return;

    const series = `${f[col.Erkrankung] ?? ''}|${f[col.Altersgruppe] ?? ''}`;
    rows.push({ region, series, week, value });
  });
  return rows;
}
