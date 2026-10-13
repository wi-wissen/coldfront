import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const REPO = resolve(import.meta.dirname, '../..');

/** Map an API path (relative to /api/v1/) to a file in the repository, or null. */
export function apiSource(rel: string): string | null {
  const f = (...p: string[]) => resolve(REPO, ...p);
  let m: RegExpExecArray | null;
  if (rel === 'index.json') return f('forecasts/index.json');
  if ((m = /^regions\/(de(?:-[a-z]{2})?)\.json$/.exec(rel))) return f('forecasts', m[1]!, 'latest.json');
  if ((m = /^backtest\/([\w.-]+\.json)$/.exec(rel))) return f('forecasts/backtest', m[1]!);
  if (rel === 'series.json') return f('forecasts/series.json');
  if (rel === 'wastewater.json') return f('forecasts/wastewater.json');
  if ((m = /^hubverse\/([\w.-]+\.(?:csv|yml))$/.exec(rel))) return f('forecasts/hubverse', m[1]!);
  if (rel === 'geo/laender.topo.json') return f('data/external/geo/vg250-laender.topo.json');
  if (rel === 'geo/plz.json') return f('data/external/geo/plz.json');
  if (rel === 'wastewater-sites.json') return f('data/external/wastewater-sites.json');
  if ((m = /^archive\/([\w.-]+\.json\.gz)$/.exec(rel))) return f('forecasts/archive', m[1]!);
  if ((m = /^holidays\/(\d{4}\.json)$/.exec(rel))) return f('data/external/holidays', m[1]!);
  return null;
}

/** All API files that exist, as [apiPath, absolute source]. sources.json is generated separately. */
export function apiFiles(): [string, string][] {
  const out: [string, string][] = [];
  const add = (rel: string) => {
    const s = apiSource(rel);
    if (s && existsSync(s)) out.push([rel, s]);
  };
  for (const rel of ['index.json', 'series.json', 'wastewater.json', 'geo/laender.topo.json', 'geo/plz.json', 'wastewater-sites.json']) add(rel);
  const fc = resolve(REPO, 'forecasts');
  if (existsSync(fc)) {
    for (const d of readdirSync(fc)) if (/^de(-[a-z]{2})?$/.test(d)) add(`regions/${d}.json`);
    for (const f of existsSync(resolve(fc, 'backtest')) ? readdirSync(resolve(fc, 'backtest')) : []) add(`backtest/${f}`);
    for (const f of existsSync(resolve(fc, 'archive')) ? readdirSync(resolve(fc, 'archive')) : []) add(`archive/${f}`);
    for (const f of existsSync(resolve(fc, 'hubverse')) ? readdirSync(resolve(fc, 'hubverse')) : []) add(`hubverse/${f}`);
  }
  const hol = resolve(REPO, 'data/external/holidays');
  for (const f of existsSync(hol) ? readdirSync(hol) : []) add(`holidays/${f}`);
  return out;
}

/** Merged provenance records of all sources (data/sources/*.json). */
export function sourcesJson(): string {
  const dir = resolve(REPO, 'data/sources');
  const list = (existsSync(dir) ? readdirSync(dir) : [])
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(resolve(dir, f), 'utf8')) as unknown);
  return JSON.stringify({ schema_version: 1, sources: list }, null, 1) + '\n';
}
