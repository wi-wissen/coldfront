import { readFileSync } from 'node:fs';
import { mount } from '@vue/test-utils';
import { renderToString } from 'vue/server-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BacktestPublic, ForecastFile, ForecastIndex } from '@coldfront/forecast-core';
import { createCfApp } from '../src/app';
import IndexPage from '../src/pages/IndexPage.vue';
import RegionPage from '../src/pages/RegionPage.vue';
import { createCfI18n } from '../src/i18n/setup';
import { EMPTY_DATA, type Locale, type PageContext } from '../src/types';
import { plantsOf, readRepo, wastewater } from './wastewater-helpers';

const index = readRepo<ForecastIndex>('forecasts/index.json');
const national = readRepo<ForecastFile>('forecasts/de/latest.json');
const region = readRepo<ForecastFile>('forecasts/de-sn/latest.json');
const topology = readRepo<unknown>('data/external/geo/vg250-laender.topo.json');
const backtest = readRepo<BacktestPublic>('forecasts/backtest/test.json');

function indexCtx(locale: Locale, withWastewater: boolean): PageContext {
  const path = locale === 'de' ? 'index.html' : 'en/index.html';
  return {
    entry: { page: 'index', locale, path },
    locale,
    data: { ...EMPTY_DATA, index, national, topology, backtest, wastewater: withWastewater ? wastewater : null },
  };
}

function regionCtx(locale: Locale, withWastewater: boolean): PageContext {
  const prefix = locale === 'de' ? '' : 'en/';
  return {
    entry: { page: 'region', locale, region: 'de-sn', path: `${prefix}regions/de-sn.html` },
    locale,
    data: { ...EMPTY_DATA, index, region, wastewater: withWastewater ? plantsOf('de-sn') : null },
  };
}

describe('wastewater section on the start page', () => {
  let errors: unknown[][];
  beforeEach(() => {
    errors = [];
    vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a));
    vi.spyOn(console, 'warn').mockImplementation((...a) => errors.push(a));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('renders the section after the map and before the postcode search (de, mounted)', () => {
    const w = mount(IndexPage, { props: { ctx: indexCtx('de', true) }, global: { plugins: [createCfI18n('de')] } });
    const heading = w.find('#home-wastewater');
    expect(heading.text()).toBe('Abwasser als Frühindikator');
    expect(w.find('#home-map').exists()).toBe(true);
    expect(errors).toEqual([]);
    const html = w.html();
    expect(html.indexOf('home-map')).toBeLessThan(html.indexOf('home-wastewater'));
    expect(html.indexOf('home-wastewater')).toBeLessThan(html.indexOf('cf-plz'));
    w.unmount();
  });

  it('renders nothing for the section when the wastewater data is null', () => {
    const w = mount(IndexPage, { props: { ctx: indexCtx('de', false) }, global: { plugins: [createCfI18n('de')] } });
    expect(w.find('#home-wastewater').exists()).toBe(false);
    expect(w.text()).not.toContain('Abwasser als Frühindikator');
    expect(w.find('#home-map').exists()).toBe(true);
    w.unmount();
  });

  it('is in the static HTML (SSR) with the pathogen choice, and without school references', async () => {
    const html = await renderToString(createCfApp(indexCtx('de', true)));
    expect(html).toContain('id="home-wastewater"');
    expect(html).toContain('Abwasser als Frühindikator');
    expect(html).toContain('name="cf-wastewater-pathogen"');
    expect(html).toContain('Berchtesgaden');
    expect(html.toLowerCase()).not.toMatch(/schul|school/);
  });

  it('omits the section from the static HTML when the data is null', async () => {
    const html = await renderToString(createCfApp(indexCtx('de', false)));
    expect(html).not.toContain('home-wastewater');
    expect(html).not.toContain('Abwasser als Frühindikator');
  });

  it('uses English text on the English start page', async () => {
    const html = await renderToString(createCfApp(indexCtx('en', true)));
    expect(html).toContain('Wastewater as an early indicator');
    expect(html).toContain('Choose a pathogen');
  });
});

describe('wastewater section on the region page', () => {
  it('renders the section with the state plants (de, SSR)', async () => {
    const html = await renderToString(createCfApp(regionCtx('de', true)));
    expect(html).toContain('id="region-wastewater"');
    expect(html).toContain('Abwasser als Frühindikator');
    expect(html).toContain('Verlauf der letzten 26 Wochen: Dresden, SARS-CoV-2');
    expect(html).not.toContain('Berchtesgaden');
  });

  it('renders nothing for the section when the wastewater data is null', async () => {
    const html = await renderToString(createCfApp(regionCtx('de', false)));
    expect(html).toContain('Prognose für Sachsen');
    expect(html).not.toContain('region-wastewater');
    expect(html).not.toContain('Abwasser als Frühindikator');
  });

  it('is shown after the horizon table and before the summary (mounted)', () => {
    const w = mount(RegionPage, { props: { ctx: regionCtx('de', true) }, global: { plugins: [createCfI18n('de')] } });
    const html = w.html();
    expect(html.indexOf('region-table')).toBeLessThan(html.indexOf('region-wastewater'));
    expect(html.indexOf('region-wastewater')).toBeLessThan(html.indexOf('region-summary'));
    w.unmount();
  });

  it('renders English text on the English region page', async () => {
    const html = await renderToString(createCfApp(regionCtx('en', true)));
    expect(html).toContain('Wastewater as an early indicator');
    expect(html).toContain('History of the last 26 weeks: Dresden, SARS-CoV-2');
  });
});
