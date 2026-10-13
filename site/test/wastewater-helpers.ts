import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WastewaterExport } from '@coldfront/forecast-core';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export const readRepo = <T>(rel: string): T => JSON.parse(readFileSync(resolve(REPO, rel), 'utf8')) as T;

/** The real published export (forecasts/wastewater.json). */
export const wastewater = readRepo<WastewaterExport>('forecasts/wastewater.json');

/** The export restricted to one federal state, as the region pages receive it at build time. */
export function plantsOf(region: string): WastewaterExport {
  return { ...wastewater, sites: wastewater.sites.filter((s) => s.region === region) };
}
