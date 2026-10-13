import { REGIONS, type SeriesExport } from '@coldfront/forecast-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { cleanPath, FORECASTS } from './paths';
import { CLEAN_COLUMNS } from './clean-series';

/** Write forecasts/series.json (cleaned inputs of all regions, used by the in-browser self-check). */
export function exportSeries(): SeriesExport {
  let start = '';
  const regions: SeriesExport['regions'] = {};
  for (const r of REGIONS) {
    const lines = readFileSync(cleanPath(r.id), 'utf8').trim().split('\n');
    const header = lines[0]!.split(',');
    const rows = lines.slice(1).map((l) => l.split(','));
    if (!start) start = rows[0]![0]!;
    const cols: Record<string, (number | null)[]> = {};
    for (const name of CLEAN_COLUMNS) {
      const j = header.indexOf(name);
      cols[name] = rows.map((c) => (c[j] === '' || c[j] === undefined ? null : Math.round(Number(c[j]) * 1e4) / 1e4));
    }
    regions[r.id] = cols;
  }
  const out: SeriesExport = { schema_version: 1, start, regions, columns: CLEAN_COLUMNS };
  const file = resolve(FORECASTS, 'series.json');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(out) + '\n');
  return out;
}
