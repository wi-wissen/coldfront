import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import RegionWastewater from '../src/components/RegionWastewater.vue';
import { createCfI18n } from '../src/i18n/setup';
import type { Locale } from '../src/types';
import { plantsOf, wastewater } from './wastewater-helpers';
import type { WastewaterExport } from '@coldfront/forecast-core';

function mountRegion(data: WastewaterExport = plantsOf('de-sn'), locale: Locale = 'de') {
  return mount(RegionWastewater, {
    props: { wastewater: data, regionName: locale === 'de' ? 'Sachsen' : 'Saxony', locale },
    global: { plugins: [createCfI18n(locale)] },
  });
}

describe('RegionWastewater (de)', () => {
  it('has one row per plant and pathogen it measures (Saxony: 27 rows, 21 of them outdated)', () => {
    const w = mountRegion();
    expect(w.findAll('tbody tr')).toHaveLength(27);
    expect(w.text().match(/\(veraltet\)/g)).toHaveLength(21);
    w.unmount();
  });

  it('shows the latest value, percentile and trend for a current plant', () => {
    const w = mountRegion();
    const leipzigSars = w.findAll('tbody tr').find((tr) => tr.find('th').text() === 'Leipzig' && tr.text().includes('SARS-CoV-2'))!;
    expect(leipzigSars.findAll('td')[0]!.text()).toBe('SARS-CoV-2');
    expect(leipzigSars.findAll('td')[1]!.text()).toBe('KW 40');
    expect(leipzigSars.findAll('td')[3]!.text()).toBe('60');
    expect(leipzigSars.find('.sr-only').text()).toBe('steigend');
    w.unmount();
  });

  it('marks outdated rows with dashes instead of values', () => {
    const w = mountRegion();
    const bautzen = w.findAll('tbody tr').find((tr) => tr.find('th').text() === 'Bautzen')!;
    expect(bautzen.text()).toContain('KW 51');
    expect(bautzen.text()).toContain('(veraltet)');
    expect(bautzen.findAll('td')[2]!.text()).toBe('–');
    w.unmount();
  });

  it('renders a sparkline for every row (the window ends at each plant\'s own last week), with an accessible name', () => {
    const w = mountRegion();
    const svgs = w.findAll('svg[role="img"]');
    expect(svgs.length).toBeGreaterThanOrEqual(20);
    expect(svgs.map((s) => s.attributes('aria-label'))).toContain('Verlauf der letzten 26 Wochen: Dresden, SARS-CoV-2');
    expect(svgs[0]!.find('path').attributes('d')).toMatch(/^M/);
    w.unmount();
  });

  it('shows the attribution line of the export', () => {
    const w = mountRegion();
    expect(w.text()).toContain(wastewater.attribution);
    w.unmount();
  });

  it('shows a note when the state has no current data', () => {
    const bautzen = { ...plantsOf('de-sn'), sites: plantsOf('de-sn').sites.filter((s) => s.name === 'Bautzen') };
    const w = mountRegion(bautzen);
    expect(w.find('[role="status"]').text()).toContain('Für Sachsen liegen derzeit keine aktuellen Messwerte vor.');
    w.unmount();
  });

  it('shows a note when the state has no plants', () => {
    const w = mountRegion({ ...wastewater, sites: [] });
    expect(w.find('[role="status"]').text()).toBe('Für Sachsen sind keine Abwasserstandorte erfasst.');
    expect(w.find('table').exists()).toBe(false);
    w.unmount();
  });
});

describe('RegionWastewater (en)', () => {
  it('uses English labels, sparkline names and trend words', () => {
    const w = mountRegion(plantsOf('de-sn'), 'en');
    expect(w.findAll('svg[role="img"]').map((s) => s.attributes('aria-label'))).toContain('History of the last 26 weeks: Dresden, SARS-CoV-2');
    expect(w.find('thead').text()).toContain('Percentile');
    expect(w.text()).toContain('(outdated)');
    w.unmount();
  });
});
