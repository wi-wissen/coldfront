import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EvalConfig } from '@coldfront/forecast-core';
import { CONFIG } from './paths';

export * from '@coldfront/forecast-core';

export function loadEvalConfig(): EvalConfig {
  return JSON.parse(readFileSync(resolve(CONFIG, 'evaluation.json'), 'utf8')) as EvalConfig;
}
