import { createI18n } from 'vue-i18n';
import type { Locale } from '../types';
import { common } from './common';
import { messages as api } from './api';
import { messages as check } from './check';
import { messages as index } from './index-page';
import { messages as legal } from './legal';
import { messages as method } from './method';
import { messages as region } from './region';
import { messages as sources } from './sources';

export const allMessages = {
  de: { ...common.de, pages: { index: index.de, region: region.de, check: check.de, sources: sources.de, api: api.de, method: method.de, legal: legal.de } },
  en: { ...common.en, pages: { index: index.en, region: region.en, check: check.en, sources: sources.en, api: api.en, method: method.en, legal: legal.en } },
};

export function createCfI18n(locale: Locale) {
  return createI18n({ legacy: false, locale, fallbackLocale: 'de', messages: allMessages as never, missingWarn: false, fallbackWarn: false });
}

/** All message keys of a locale as dotted paths (used by the i18n parity test). */
export function keyPaths(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k));
}
