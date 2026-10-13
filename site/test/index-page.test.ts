import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flushPromises, mount } from '@vue/test-utils';
import { renderToString } from 'vue/server-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BacktestPublic, ForecastFile, ForecastIndex } from '@coldfront/forecast-core';
import { createCfApp } from '../src/app';
import IndexPage from '../src/pages/IndexPage.vue';
import HomePostcodeSearch from '../src/components/HomePostcodeSearch.vue';
import { createCfI18n } from '../src/i18n/setup';
import { formatCount } from '../src/lib/forecast-text';
import { EMPTY_DATA, type Locale, type PageContext } from '../src/types';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = <T>(rel: string): T => JSON.parse(readFileSync(resolve(REPO, rel), 'utf8')) as T;
const index = read<ForecastIndex>('forecasts/index.json');
const national = read<ForecastFile>('forecasts/de/latest.json');
const topology = read<unknown>('data/external/geo/vg250-laender.topo.json');
const backtest = read<BacktestPublic>('forecasts/backtest/test.json');
const plz = read<Record<string, [number, number, string]>>('data/external/geo/plz.json');

function ctxFor(locale: Locale): PageContext {
  const path = locale === 'de' ? 'index.html' : 'en/index.html';
  return { entry: { page: 'index', locale, path }, locale, data: { ...EMPTY_DATA, index, national, topology, backtest } };
}

function mountPage(locale: Locale) {
  return mount(IndexPage, { props: { ctx: ctxFor(locale) }, global: { plugins: [createCfI18n(locale)] }, attachTo: document.body });
}

const stateLabel = (h: number, id: string): string => {
  const entry = index.regions.find((r) => r.id === id)!;
  const row = entry.summary.find((s) => s.h === h)!;
  return `${row.index.toFixed(2).replace('.', ',')}`;
};

describe('start page (de)', () => {
  let errors: unknown[][];
  beforeEach(() => {
    errors = [];
    vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a));
    vi.spyOn(console, 'warn').mockImplementation((...a) => errors.push(a));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('states the national horizon-1 numbers in plain language, rounded', () => {
    const wrapper = mountPage('de');
    const text = wrapper.text();
    const h1 = national.horizons[0]!;
    expect(text).toContain(`In KW 41 erwarten wir bundesweit rund ${formatCount(h1.q50, 'de')} Arztbesuche`);
    expect(text).toContain(`zwischen ${formatCount(h1.q10, 'de')} und ${formatCount(h1.q90, 'de')}`);
    expect(text).toContain('etwa so viel wie üblich');
    expect(text).toContain('Einstufung:');
    expect(wrapper.find('[aria-hidden="true"]').text()).toBe('●');
    expect(text).toContain('normal');
    expect(errors).toEqual([]);
    wrapper.unmount();
  });

  it('switching the horizon changes week, numbers and map colours', async () => {
    const wrapper = mountPage('de');
    const radios = wrapper.findAll('input[name="cf-horizon"]');
    expect(radios).toHaveLength(4);
    expect((radios[0]!.element as HTMLInputElement).checked).toBe(true);

    const before = wrapper.find('path[data-region="de-sn"]').attributes('aria-label');
    await radios[1]!.trigger('change');
    await radios[1]!.setValue(true);
    await flushPromises();

    expect((radios[1]!.element as HTMLInputElement).checked).toBe(true);
    const text = wrapper.text();
    const h2 = national.horizons[1]!;
    expect(text).toContain(`In KW 42 erwarten wir bundesweit rund ${formatCount(h2.q50, 'de')} Arztbesuche`);
    expect(text).toContain(`zwischen ${formatCount(h2.q10, 'de')} und ${formatCount(h2.q90, 'de')}`);
    const after = wrapper.find('path[data-region="de-sn"]').attributes('aria-label');
    expect(after).not.toBe(before);
    expect(after).toContain(`Index ${stateLabel(2, 'de-sn')}`);
    expect(errors).toEqual([]);
    wrapper.unmount();
  });

  it('renders the 16 federal states as plain links to their region pages', () => {
    const wrapper = mountPage('de');
    const links = wrapper.findAll('a').filter((a) => /regions\/de-[a-z]{2}\.html$/.test(a.attributes('href') ?? ''));
    expect(links).toHaveLength(16);
    expect(links.map((a) => a.attributes('href'))).toContain('./regions/de-sn.html');
    wrapper.unmount();
  });

  it('looks up a postcode lazily after submit and navigates to the region page', async () => {
    const fetchMock = vi.fn(async (_url: string) => ({ ok: true, status: 200, json: async () => plz }));
    vi.stubGlobal('fetch', fetchMock);
    const wrapper = mountPage('de');
    const search = wrapper.findComponent(HomePostcodeSearch);
    const navigate = vi.spyOn(search.vm as unknown as { navigate: (h: string) => void }, 'navigate').mockImplementation(() => {});
    expect(fetchMock).not.toHaveBeenCalled();

    await wrapper.find('#cf-plz').setValue('04109');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/api\/v1\/geo\/plz\.json$/);
    expect(navigate).toHaveBeenCalledWith('./regions/de-sn.html');
    vi.unstubAllGlobals();
    wrapper.unmount();
  });

  it('shows clear messages for invalid and unknown postcodes without fetching for invalid input', async () => {
    const fetchMock = vi.fn(async (_url: string) => ({ ok: true, status: 200, json: async () => plz }));
    vi.stubGlobal('fetch', fetchMock);
    const wrapper = mountPage('de');

    await wrapper.find('#cf-plz').setValue('abc');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('#cf-plz-status').text()).toContain('genau fünf Ziffern');
    expect(wrapper.find('#cf-plz').attributes('aria-invalid')).toBe('true');
    expect(fetchMock).not.toHaveBeenCalled();

    await wrapper.find('#cf-plz').setValue('99999');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('#cf-plz-status').text()).toContain('99999 ist uns nicht bekannt');
    expect(wrapper.find('#cf-plz-status').attributes('aria-live')).toBe('polite');
    vi.unstubAllGlobals();
    wrapper.unmount();
  });

  it('shows the stale warning only after mount, when the data is older than nine days', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-25T12:00:00Z'));
    const wrapper = mountPage('de');
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('älter als neun Tage');
    wrapper.unmount();

    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
    const fresh = mountPage('de');
    await fresh.vm.$nextTick();
    expect(fresh.text()).not.toContain('älter als neun Tage');
    fresh.unmount();
  });

  it('renders the quality sentence from the gate, with the evaluation note', () => {
    const wrapper = mountPage('de');
    expect(wrapper.text()).toContain('Warum Sie der Prognose trauen können — und warum nicht blind');
    const pct = new Intl.NumberFormat('de', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(backtest.gate.rel_wis_improvement! * 100);
    expect(wrapper.text()).toContain(`${pct} % kleineren Prognosefehler`);
    expect(wrapper.text()).toContain('heute korrigierten Daten');
    // honest wording: the first untouched evaluation was under protocol 1, the current figures are descriptive
    expect(wrapper.text()).toContain('Die erste unberührte Auswertung gab es nach dem ersten Protokoll');
    expect(wrapper.text()).toContain('beschreibende Neuauswertung');
    expect(wrapper.text()).not.toContain('im unabhängigen Testzeitraum');
    const link = wrapper.findAll('a').find((a) => a.text() === 'Was sich geändert hat');
    expect(link?.attributes('href')).toBe('./method.html#m-amendment');
    wrapper.unmount();
  });
});

describe('start page (en)', () => {
  it('uses English text and English week labels', () => {
    const wrapper = mountPage('en');
    const h1 = national.horizons[0]!;
    expect(wrapper.text()).toContain(`In W41 we expect nationwide about ${formatCount(h1.q50, 'en')} doctor visits`);
    expect(wrapper.text()).toContain(`between ${formatCount(h1.q10, 'en')} and ${formatCount(h1.q90, 'en')}`);
    expect(wrapper.text()).toContain('Why you can trust the forecast');
    expect(wrapper.text()).toContain('Federal states');
    wrapper.unmount();
  });
});

describe('start page SSR', () => {
  it('contains the national sentence and the 16 region links in the static HTML', async () => {
    const html = await renderToString(createCfApp(ctxFor('de')));
    expect(html).toContain(`In KW 41 erwarten wir bundesweit rund ${formatCount(national.horizons[0]!.q50, 'de')} Arztbesuche`);
    expect(html.match(/regions\/de-[a-z]{2}\.html/g)?.length ?? 0).toBeGreaterThanOrEqual(16);
    expect(html).toContain('id="cf-plz"');
  });
});
