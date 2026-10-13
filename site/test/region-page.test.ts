import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mount } from '@vue/test-utils';
import { renderToString } from 'vue/server-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForecastFile, ForecastIndex } from '@coldfront/forecast-core';
import { createCfApp } from '../src/app';
import RegionPage from '../src/pages/RegionPage.vue';
import { createCfI18n } from '../src/i18n/setup';
import { EMPTY_DATA, type Locale, type PageContext } from '../src/types';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = <T>(rel: string): T => JSON.parse(readFileSync(resolve(REPO, rel), 'utf8')) as T;
const index = read<ForecastIndex>('forecasts/index.json');
const region = read<ForecastFile>('forecasts/de-sn/latest.json');

function ctxFor(locale: Locale, data: ForecastFile | null = region, id = 'de-sn'): PageContext {
  const prefix = locale === 'de' ? '' : 'en/';
  return {
    entry: { page: 'region', locale, region: id, path: `${prefix}regions/${id}.html` },
    locale,
    data: { ...EMPTY_DATA, index, region: data },
  };
}

function mountPage(ctx: PageContext) {
  return mount(RegionPage, { props: { ctx }, global: { plugins: [createCfI18n(ctx.locale)] } });
}

describe('region page', () => {
  let errors: unknown[][];
  beforeEach(() => {
    errors = [];
    vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a));
    vi.spyOn(console, 'warn').mockImplementation((...a) => errors.push(a));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the state name, the four horizons and the plain-language sentence (de)', () => {
    const wrapper = mountPage(ctxFor('de'));
    expect(wrapper.find('h1').text()).toBe('Prognose für Sachsen');
    expect(wrapper.find('nav').text()).toContain('Start');
    expect(wrapper.findAll('table.min-w-\\[40rem\\] tbody tr')).toHaveLength(4);
    expect(wrapper.text()).toContain('In KW 41 erwarten wir in Sachsen rund 1.250 Arztbesuche');
    expect(wrapper.text()).toContain('zwischen 850 und 1.950');
    expect(wrapper.text()).toContain('Die vier Prognosewochen');
    expect(wrapper.text()).toContain('nur wenige Winter');
    expect(wrapper.text()).toContain('2022-W40');
    expect(wrapper.text()).toContain('Robert Koch-Institut');
    expect(errors).toEqual([]);
    wrapper.unmount();
  });

  it('renders English names and text', () => {
    const wrapper = mountPage(ctxFor('en'));
    expect(wrapper.find('h1').text()).toBe('Forecast for Saxony');
    expect(wrapper.text()).toContain('In W41 we expect in Saxony about 1,250 doctor visits');
    expect(wrapper.text()).toContain('To the nationwide forecast');
    wrapper.unmount();
  });

  it('shows a clear message when no forecast exists for the region', () => {
    const wrapper = mountPage(ctxFor('de', null));
    expect(wrapper.find('[role="alert"]').text()).toContain('keine Prognose vor');
    expect(wrapper.find('table.min-w-\\[40rem\\]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('renders the same content through the app factory (SSR)', async () => {
    const html = await renderToString(createCfApp(ctxFor('de')));
    expect(html).toContain('Prognose für Sachsen');
    expect(html).toContain('In KW 41 erwarten wir in Sachsen rund 1.250 Arztbesuche');
    expect(html).toContain('<table');
  });
});
