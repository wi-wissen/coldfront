import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomeWastewater from '../src/components/HomeWastewater.vue';
import { createCfI18n } from '../src/i18n/setup';
import type { Locale } from '../src/types';
import { readRepo, wastewater } from './wastewater-helpers';

const topology = readRepo<unknown>('data/external/geo/vg250-laender.topo.json');

function mountHome(locale: Locale = 'de', data = wastewater) {
  return mount(HomeWastewater, {
    props: { wastewater: data, topology, locale, path: locale === 'de' ? 'index.html' : 'en/index.html' },
    global: { plugins: [createCfI18n(locale)] },
    attachTo: document.body,
  });
}

// Only the map's own markers: the legend keys reuse the same classes.
const count = (w: ReturnType<typeof mountHome>, cls: string) => w.findAll(`.cf-points > .${cls}`).length;
/** Rows of the top-10 table (the last table on the page; the map's points table comes first). */
const topRows = (w: ReturnType<typeof mountHome>) => w.findAll('table').at(-1)!.findAll('tbody tr');

describe('HomeWastewater (de)', () => {
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

  it('offers SARS-CoV-2, Influenza and RSV with SARS-CoV-2 selected by default', () => {
    const w = mountHome();
    const radios = w.findAll('input[name="cf-wastewater-pathogen"]');
    expect(radios).toHaveLength(3);
    expect(radios.map((r) => (r.element as HTMLInputElement).value)).toEqual(['sars', 'flu', 'rsv']);
    expect((radios[0]!.element as HTMLInputElement).checked).toBe(true);
    expect(w.find('legend').text()).toBe('Erreger wählen');
    w.unmount();
  });

  it('lists the ten current plants with the highest percentile, with state and trend text', () => {
    const w = mountHome();
    const rows = topRows(w);
    expect(rows).toHaveLength(10);
    const first = rows[0]!;
    expect(first.find('th').text()).toBe('Berchtesgaden');
    expect(first.text()).toContain('Bayern');
    expect(first.find('td').element.nextElementSibling?.textContent).toBe('81');
    expect(first.find('.sr-only').text()).toBe('steigend');
    expect(first.find('[aria-hidden="true"]').text()).toBe('▲');
    expect(errors).toEqual([]);
    w.unmount();
  });

  it('draws one point per plant with current SARS-CoV-2 data, by level; stale plants are not drawn', () => {
    const w = mountHome();
    expect(count(w, 'cf-point')).toBe(70);
    // All 169 plants have a position now; Emschermündung (active) is one more point than before.
    expect(count(w, 'cf-point-high') + count(w, 'cf-point-medium') + count(w, 'cf-point-low')).toBe(70);
    expect(count(w, 'cf-point-high')).toBeGreaterThanOrEqual(1);
    expect(count(w, 'cf-point-none')).toBe(0);
    expect(w.find('[aria-label^="Aachen:"]').exists()).toBe(false);
    expect(w.text()).toMatch(/\d+ Standorte sind auf der Karte nicht dargestellt/);
    w.unmount();
  });

  it('changes the point levels when the pathogen changes', async () => {
    const w = mountHome();
    const flu = w.findAll('input[name="cf-wastewater-pathogen"]')[1]!;
    await flu.setValue(true);
    await flushPromises();
    expect((flu.element as HTMLInputElement).checked).toBe(true);
    expect(count(w, 'cf-point')).toBe(66);
    expect(count(w, 'cf-point-high') + count(w, 'cf-point-medium') + count(w, 'cf-point-low')).toBe(66);
    expect(count(w, 'cf-point-high')).toBeGreaterThanOrEqual(6);
    expect(count(w, 'cf-point-none')).toBe(0);
    const first = topRows(w)[0]!;
    expect(first.find('th').text()).toBe('Emschermündung');
    expect(errors).toEqual([]);
    w.unmount();
  });

  it('shows Emschermündung on the map and in the top table (it has a position now)', async () => {
    const w = mountHome();
    const flu = w.findAll('input[name="cf-wastewater-pathogen"]')[1]!;
    await flu.setValue(true);
    await flushPromises();
    expect(w.find('[aria-label^="Emschermündung:"]').exists()).toBe(true);
    const topTable = w.findAll('table').at(-1)!;
    expect(topTable.text()).toContain('Emschermündung');
    w.unmount();
  });

  it('shows the source line from the export attribution under the map', () => {
    const w = mountHome();
    expect(w.find('p.cf-source').text()).toBe(wastewater.attribution);
    w.unmount();
  });

  it('renders a points table with one row per point on the map, with level texts', () => {
    const w = mountHome();
    const details = w.find('details.cf-points-details');
    expect(details.find('summary').text()).toBe('Standorte als Tabelle anzeigen');
    expect(details.findAll('tbody tr')).toHaveLength(70);
    w.unmount();
  });

  it('shows the data week and the explanation, without school references', () => {
    const w = mountHome();
    const text = w.text();
    expect(text).toContain('Abwasserdaten bis KW 40');
    expect(text).toContain('bis zu zwei Wochen Verzug');
    expect(text).toContain('keine Schlüsse auf Schwere oder Inzidenz');
    expect(text).toContain('Startwerte ohne Validierung');
    expect(text.toLowerCase()).not.toMatch(/schul|school/);
    w.unmount();
  });
});

describe('HomeWastewater (en)', () => {
  it('uses English labels, week names and trend words', () => {
    const w = mountHome('en');
    expect(w.find('legend').text()).toBe('Choose a pathogen');
    expect(w.find('table tbody tr .sr-only').text()).toBe('rising');
    expect(w.text()).toContain('Wastewater data up to W40');
    expect(w.find('[aria-label^="Berchtesgaden:"]').attributes('aria-label')).toBe('Berchtesgaden: Percentile 81 · W40');
    w.unmount();
  });
});

describe('HomeWastewater with an export of current data only', () => {
  it('shows the empty message in the top table when no current value exists for the pathogen', () => {
    const stale = {
      ...wastewater,
      sites: wastewater.sites.map((s) => ({ ...s, pathogens: { 'SARS-CoV-2': { ...s.pathogens['SARS-CoV-2']!, last_week: '2024-W51' as const } } })),
    };
    const w = mountHome('de', stale);
    // Only the points table of the map remains; the top table is absent.
    expect(w.findAll('table')).toHaveLength(1);
    expect(w.find('.cf-points-details').exists()).toBe(true);
    expect(w.text()).toContain('Für diesen Erreger liegen derzeit keine aktuellen Werte vor.');
    w.unmount();
  });
});
