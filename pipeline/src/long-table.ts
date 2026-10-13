import { gunzipSync, gzipSync } from 'fflate';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { LongRow } from '@coldfront/forecast-core';

const HEADER = 'region,series,week,value,as_of';

/** CSV (RFC 4180 subset: fields containing , " or newline are quoted). */
function esc(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export function serializeLong(rows: readonly LongRow[]): string {
  const lines = [HEADER];
  for (const r of rows) lines.push([esc(r.region), esc(r.series), r.week, String(r.value), r.as_of].join(','));
  return lines.join('\n') + '\n';
}

export function parseLong(text: string): LongRow[] {
  const lines = text.split('\n').filter((l) => l.length > 0);
  if (lines[0] !== HEADER) throw new Error('Unexpected long-table header');
  return lines.slice(1).map((l) => {
    const [region, series, week, value, as_of] = splitCsvLine(l);
    return { region: region!, series: series!, week: week!, value: Number(value), as_of: as_of! };
  });
}

export function readLongFile(path: string): LongRow[] {
  if (!existsSync(path)) return [];
  return parseLong(new TextDecoder().decode(gunzipSync(readFileSync(path))));
}

/** Deterministic gzip (fixed mtime) so unchanged tables produce identical bytes. */
export function writeLongFile(path: string, rows: readonly LongRow[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, gzipSync(new TextEncoder().encode(serializeLong(rows)), { level: 9, mtime: 0 }));
}
