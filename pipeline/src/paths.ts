import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root (this file lives in pipeline/src). */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const DATA = resolve(ROOT, 'data');
export const FORECASTS = resolve(ROOT, 'forecasts');
export const CONFIG = resolve(ROOT, 'pipeline/config');

export const longPath = (indicator: string) => resolve(DATA, 'long', `${indicator}.csv.gz`);
export const sourcePath = (id: string) => resolve(DATA, 'sources', `${id}.json`);
export const cleanPath = (region: string) => resolve(DATA, 'clean', region, 'series.csv');
