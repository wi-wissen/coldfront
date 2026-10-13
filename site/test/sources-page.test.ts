import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { createCfApp } from '../src/app';
import { createCfI18n } from '../src/i18n/setup';
import SourcesPage from '../src/pages/SourcesPage.vue';
import type { Locale, PageContext, PageData, SourceRecord } from '../src/types';
import { EMPTY_DATA } from '../src/types';

const SOURCES: SourceRecord[] = [
  {
    id: 'rki-are',
    name: 'ARE-Konsultationsinzidenz',
    url: 'https://raw.githubusercontent.com/robert-koch-institut/ARE-Konsultationsinzidenz/main/ARE-Konsultationsinzidenz.tsv',
    attribution: 'Robert Koch-Institut, ARE-Konsultationsinzidenz, CC BY 4.0',
    license: 'CC BY 4.0',
    license_url: 'https://creativecommons.org/licenses/by/4.0/',
    retrieved: '2026-10-13',
    sha256: '9f4487193945bfd2a99dc522ca313cfcdf3bd5a8c8db5cbfedca0f76870f4a6d',
    doi: '',
  },
  {
    id: 'dwd-kl',
    name: 'DWD Climate Data Center, daily station observations (kl)',
    url: 'https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/daily/kl/',
    attribution: 'Quelle: Deutscher Wetterdienst; Wochenmittel der Tageswerte (TXK, TNK) aus mehreren Stationen berechnet',
    license: 'CC BY 4.0',
    license_url: 'https://www.dwd.de/copyright',
    retrieved: '2026-10-13',
    sha256: 'n/a (many station files)',
    doi: '',
  },
];

function ctxFor(locale: Locale, data: Partial<PageData> = {}): PageContext {
  return {
    entry: { page: 'sources', locale, path: locale === 'de' ? 'sources.html' : 'en/sources.html' },
    locale,
    data: { ...EMPTY_DATA, ...data },
  };
}

function mountPage(locale: Locale, data: Partial<PageData> = {}) {
  return mount(SourcesPage, { props: { ctx: ctxFor(locale, data) }, global: { plugins: [createCfI18n(locale)] } });
}

const GERMAN_WORDS = /\b(und|der|die|das|für|Daten|Quellen|Lizenz|Pflichthinweise|Einschränkungen|Nennung)\b/;

describe('SourcesPage', () => {
  it('renders the German headings in order', () => {
    const w = mountPage('de', { sources: SOURCES });
    const h1 = w.findAll('h1');
    expect(h1).toHaveLength(1);
    expect(h1[0]!.text()).toBe('Daten & Quellen');
    const h2 = w.findAll('h2').map((h) => h.text());
    expect(h2).toEqual(['Eingesetzte Datenquellen', 'Pflichthinweise', 'Lizenzen je Quelle', 'Nicht verwendete Quellen', 'Einschränkungen der Daten']);
  });

  it('renders one card per source with the attribution verbatim', () => {
    const w = mountPage('de', { sources: SOURCES });
    const cards = w.findAll('article.cf-card');
    expect(cards).toHaveLength(2);
    expect(cards[1]!.text()).toContain(SOURCES[1]!.attribution);
    expect(cards[0]!.find('h3').text()).toBe(SOURCES[0]!.name);
  });

  it('formats the retrieval date differently per locale', () => {
    const de = mountPage('de', { sources: SOURCES }).find('time').text();
    const en = mountPage('en', { sources: SOURCES }).find('time').text();
    expect(de).toBe('13.10.2026');
    expect(en).toBe('Oct 13, 2026');
  });

  it('shortens the checksum and keeps the full value in the title attribute', () => {
    const w = mountPage('de', { sources: SOURCES });
    const code = w.find('code[title]');
    expect(code.attributes('title')).toBe(SOURCES[0]!.sha256);
    expect(code.text()).toBe('9f4487193945…');
    // non-hash values are shown unchanged
    expect(w.findAll('code')[1]!.text()).toBe('n/a (many station files)');
  });

  it('renders the licence table rows and its caption', () => {
    const w = mountPage('de', { sources: SOURCES });
    const table = w.findAll('table').find((t) => t.find('caption').text() === 'Lizenz und Nennung je Quelle');
    expect(table).toBeDefined();
    expect(table!.findAll('tbody tr')).toHaveLength(6);
    expect(table!.findAll('th[scope="row"]').map((th) => th.text())).toContain('BKG VG250 Verwaltungsgebiete (Bundesländer)');
  });

  it('shows the fallback when the source list is missing', () => {
    const w = mountPage('de', { sources: null });
    expect(w.find('ul').exists()).toBe(true); // the sections below still render lists
    expect(w.text()).toContain('Die Quellenliste ist in dieser Ausgabe nicht verfügbar.');
    expect(w.findAll('article.cf-card')).toHaveLength(0);
  });

  it('keeps German text out of the English headings', () => {
    const w = mountPage('en', { sources: SOURCES });
    const headings = w.findAll('h1, h2, h3').map((h) => h.text());
    expect(headings.length).toBeGreaterThan(5);
    for (const h of headings) expect(h).not.toMatch(GERMAN_WORDS);
    expect(w.find('h1').text()).toBe('Data & sources');
  });

  it('contains no mention of schools', () => {
    const w = mountPage('en', { sources: SOURCES });
    expect(w.text().toLowerCase()).not.toMatch(/schul|school/);
  });

  it('is prerendered with its heading (server renderer through createCfApp)', async () => {
    const html = await renderToString(createCfApp(ctxFor('de', { sources: SOURCES })));
    expect(html).toContain('Daten &amp; Quellen');
    expect(html).toContain('Eingesetzte Datenquellen');
    const en = await renderToString(createCfApp(ctxFor('en', { sources: SOURCES })));
    expect(en).toContain('Data &amp; sources');
  });
});
