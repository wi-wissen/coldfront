/**
 * Prerender every page: renders the Vue app of each built HTML shell with the
 * server renderer and writes complete static HTML (plus the embedded page data
 * that the client uses for hydration).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { allPages, pageHref } from './pages';
import type { PageData } from '../src/types';
import { EMPTY_DATA } from '../src/types';

const TAG = process.env.CF_TAG ?? '';
const DIST = resolve(import.meta.dirname, `../dist${TAG}`);
const api = <T>(rel: string): T | null => {
  const f = resolve(DIST, 'api/v1', rel);
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as T) : null;
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const jsonForHtml = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

async function main(): Promise<void> {
  const ssrEntry = resolve(import.meta.dirname, `../dist-ssr${TAG}/ssr.js`);
  const { render } = (await import(pathToFileURL(ssrEntry).href)) as { render: (ctx: unknown) => Promise<{ html: string; title: string; description: string }> };

  const index = api<PageData['index']>('index.json');
  const national = api<PageData['national']>('regions/de.json');
  const backtest = api<PageData['backtest']>('backtest/test.json');
  const tuning = api<PageData['tuning']>('backtest/tuning.json');
  const sources = api<{ sources: PageData['sources'] }>('sources.json')?.sources ?? null;
  const topology = api<unknown>('geo/laender.topo.json');

  let n = 0;
  for (const entry of allPages()) {
    const data: PageData = { ...EMPTY_DATA, index };
    if (entry.page === 'index') Object.assign(data, { national, topology, backtest });
    if (entry.page === 'region') data.region = api<PageData['region']>(`regions/${entry.region}.json`);
    if (entry.page === 'sources') data.sources = sources;
    if (entry.page === 'method') Object.assign(data, { backtest, tuning });
    const ctx = { entry, locale: entry.locale, data };
    const out = await render(ctx);

    const file = resolve(DIST, entry.path);
    let html = readFileSync(file, 'utf8');
    const alt = (['de', 'en'] as const)
      .map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(pageHref(entry.path, { page: entry.page, locale: l, region: entry.region }))}">`)
      .join('\n');
    html = html
      .replace('<div id="app"></div>', () => `<div id="app">${out.html}</div>\n<script type="application/json" id="cf-data">${jsonForHtml(data)}</script>`)
      .replace(/<title>[^<]*<\/title>/, () => `<title>${esc(out.title)}</title>`)
      .replace('<meta name="description" content="">', () => `<meta name="description" content="${esc(out.description)}">\n${alt}`);
    if (html.includes('<div id="app"></div>')) throw new Error(`prerender failed for ${entry.path}`);
    writeFileSync(file, html);
    n++;
  }
  console.log(`prerendered ${n} pages`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
