import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { createCfApp } from '../src/app';
import { createCfI18n } from '../src/i18n/setup';
import ApiPage from '../src/pages/ApiPage.vue';
import { API_BASE } from '../src/site-config';
import type { Locale, PageContext, PageData } from '../src/types';
import { EMPTY_DATA } from '../src/types';

const INDEX: PageData['index'] = {
  schema_version: 1,
  issued: '2026-10-08',
  data_version: '2026-10-08',
  model: 'ensemble',
  regions: [
    { id: 'de', level: 'national', name_de: 'Deutschland', name_en: 'Germany', file: 'de/latest.json', last_observed_week: '2026-W40', summary: [] },
    { id: 'de-sn', level: 'bundesland', name_de: 'Sachsen', name_en: 'Saxony', file: 'de-sn/latest.json', last_observed_week: '2026-W40', summary: [] },
  ],
};

function ctxFor(locale: Locale, data: Partial<PageData> = {}): PageContext {
  return {
    entry: { page: 'api', locale, path: locale === 'de' ? 'api.html' : 'en/api.html' },
    locale,
    data: { ...EMPTY_DATA, ...data },
  };
}

function mountPage(locale: Locale, data: Partial<PageData> = {}) {
  return mount(ApiPage, { props: { ctx: ctxFor(locale, data) }, global: { plugins: [createCfI18n(locale)] } });
}

function table(w: ReturnType<typeof mountPage>, caption: string) {
  const t = w.findAll('table').find((x) => x.find('caption').text() === caption);
  if (!t) throw new Error(`no table with caption ${caption}`);
  return t;
}

const GERMAN_WORDS = /\b(und|der|die|das|für|Dateien|Aktueller|Stand|Nachnutzung|Versionierung|Regionen|Felder|Quantile|Beispiele)\b/;

describe('ApiPage', () => {
  it('renders the German headings', () => {
    const w = mountPage('de', { index: INDEX });
    expect(w.find('h1').text()).toBe('Statische JSON-API');
    const h2 = w.findAll('h2').map((h) => h.text());
    expect(h2).toEqual([
      'Basis-URL',
      'Aktueller Stand',
      'Dateien',
      'Regionen-Kennungen',
      'Felder der Regionsdateien',
      'Quantile und Bänder',
      'Aktivitätsstufen',
      'Beispiele',
      'Zugriff aus dem Browser (CORS)',
      'Versionierung',
      'Nachnutzung und Nennung',
    ]);
  });

  it('lists all 17 regions (Germany plus 16 federal states) with their files', () => {
    const w = mountPage('de');
    const t = table(w, 'Regionen und ihre Dateien');
    const ids = t.findAll('tbody th').map((th) => th.text());
    expect(ids).toHaveLength(17);
    expect(ids).toContain('de');
    expect(ids).toContain('de-sn');
    expect(ids).toContain('de-th');
    const link = t.find('a[href$="regions/de-sn.json"]');
    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe(`${API_BASE}regions/de-sn.json`);
  });

  it('lists every endpoint file of the API', () => {
    const w = mountPage('en');
    const t = table(w, 'Files of the API');
    const files = t.findAll('tbody th').map((th) => th.text());
    for (const f of ['index.json', 'regions/<id>.json', 'series.json', 'backtest/test.json', 'geo/plz.json', 'archive/<date>.json.gz', 'holidays/<year>.json']) {
      expect(files).toContain(f);
    }
  });

  it('formats thresholds and dates by locale', () => {
    const de = mountPage('de', { index: INDEX }).text();
    const en = mountPage('en', { index: INDEX }).text();
    expect(de).toContain('Ab 1,25 gilt die Stufe erhöht');
    expect(de).toContain('08.10.2026');
    expect(de).toContain('Die Prognose gilt für 2 Regionen.');
    expect(en).toContain('From 1.25 the level is elevated');
    expect(en).toContain('Oct 8, 2026');
  });

  it('shows the fallback when the index is missing', () => {
    const w = mountPage('de', { index: null });
    expect(w.text()).toContain('Der aktuelle Stand ist in dieser Ausgabe nicht verfügbar.');
  });

  it('renders the examples as escaped code blocks with the API base URL', () => {
    const w = mountPage('de');
    const codes = w.findAll('pre code').map((c) => c.text());
    expect(codes).toHaveLength(4);
    expect(codes[0]).toBe(API_BASE);
    expect(codes[1]).toBe(`curl -s "${API_BASE}index.json"`);
    expect(codes[2]).toContain(`fetch("${API_BASE}regions/de-sn.json")`);
    expect(codes[3]).toContain('"level": "normal"');
  });

  it('documents every ForecastFile field in the field table', () => {
    const w = mountPage('en');
    const t = table(w, 'Fields of a region file (ForecastFile)');
    const fields = t.findAll('tbody th').map((th) => th.text());
    expect(fields).toEqual(expect.arrayContaining(['schema_version', 'region', 'observed', 'normal', 'horizons', 'horizons[].q10 … q90', 'horizons[].index']));
    expect(t.text()).toContain('Median divided by the median of the seasonal norm');
  });

  it('keeps German text out of the English headings', () => {
    const w = mountPage('en', { index: INDEX });
    const headings = w.findAll('h1, h2, h3').map((h) => h.text());
    expect(headings.length).toBeGreaterThan(8);
    for (const h of headings) expect(h).not.toMatch(GERMAN_WORDS);
  });

  it('contains no mention of schools', () => {
    const w = mountPage('de', { index: INDEX });
    expect(w.text().toLowerCase()).not.toMatch(/schul|school/);
  });

  it('is prerendered with its heading (server renderer through createCfApp)', async () => {
    const html = await renderToString(createCfApp(ctxFor('de', { index: INDEX })));
    expect(html).toContain('Statische JSON-API');
    expect(html).toContain('Access-Control-Allow-Origin: *');
    const en = await renderToString(createCfApp(ctxFor('en')));
    expect(en).toContain('Static JSON API');
  });
});
