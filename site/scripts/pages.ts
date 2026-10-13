/** Page registry shared by the Vite config (shell generation) and the prerender script. */
import { BUNDESLAENDER } from '../../packages/forecast-core/src/regions';

export const LOCALES = ['de', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const STATIC_PAGES = ['index', 'check', 'sources', 'api', 'method', 'legal'] as const;
export type StaticPage = (typeof STATIC_PAGES)[number];

export interface PageEntry {
  /** page name; region pages use "region" */
  page: StaticPage | 'region';
  locale: Locale;
  /** region id for region pages */
  region?: string;
  /** output path relative to dist, e.g. "en/regions/de-sn.html" */
  path: string;
}

export function allPages(): PageEntry[] {
  const out: PageEntry[] = [];
  for (const locale of LOCALES) {
    const prefix = locale === 'de' ? '' : 'en/';
    for (const page of STATIC_PAGES) out.push({ page, locale, path: `${prefix}${page}.html` });
    for (const r of BUNDESLAENDER) out.push({ page: 'region', locale, region: r.id, path: `${prefix}regions/${r.id}.html` });
  }
  return out;
}

/** Relative prefix from a page path to the site root: "" | "../" | "../../". */
export function rootPrefix(path: string): string {
  const depth = path.split('/').length - 1;
  return depth === 0 ? './' : '../'.repeat(depth);
}

/** Relative href of another page, seen from `fromPath`. */
export function pageHref(fromPath: string, target: { page: StaticPage | 'region'; locale: Locale; region?: string }): string {
  const prefix = target.locale === 'de' ? '' : 'en/';
  const file = target.page === 'region' ? `regions/${target.region}.html` : `${target.page}.html`;
  return rootPrefix(fromPath) + prefix + file;
}
