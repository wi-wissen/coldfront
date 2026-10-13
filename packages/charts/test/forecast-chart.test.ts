import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ForecastChart from '../src/ForecastChart.vue';
import { addWeeks } from '@coldfront/forecast-core';
import { chartLabels, syntheticHorizons, syntheticObserved } from './fixtures';

const SOURCE = 'Source: Robert Koch-Institut; own calculation';

function props(locale: string, observed = syntheticObserved('2023-W40', 110, 1234.5)) {
  return {
    observed,
    horizons: syntheticHorizons(observed.length ? observed[observed.length - 1]!.iso_week : '2026-W43', 1234.5),
    labels: chartLabels,
    locale,
    sourceLine: SOURCE,
  };
}

describe('ForecastChart', () => {
  it('renders an accessible SVG image labelled with the title', () => {
    const w = mount(ForecastChart, { props: props('en') });
    const svg = w.find('svg[role="img"]');
    expect(svg.exists()).toBe(true);
    expect(svg.attributes('aria-label')).toBe(chartLabels.title);
    expect(svg.attributes('viewBox')).toMatch(/^0 0 \d+ \d+$/);
  });

  it('renders the data table with the last 12 observed weeks and all forecast weeks', () => {
    const w = mount(ForecastChart, { props: props('en') });
    const observed = syntheticObserved('2023-W40', 110);
    const last = observed[observed.length - 1]!.iso_week;
    const rows = w.findAll('table tbody tr');
    expect(rows).toHaveLength(12 + 4);
    expect(rows[0]!.find('th').text()).toBe(observed[observed.length - 12]!.iso_week);
    expect(rows[11]!.find('th').text()).toBe(last);
    expect(rows[12]!.find('th').text()).toBe(addWeeks(last, 1));
    expect(rows[15]!.find('th').text()).toBe(addWeeks(last, 4));
  });

  it('renders the source line below the chart', () => {
    const w = mount(ForecastChart, { props: props('en') });
    expect(w.find('p.cf-source').text()).toBe(SOURCE);
  });

  it('formats numbers with the locale', () => {
    const de = mount(ForecastChart, { props: props('de') }).find('table').text();
    const en = mount(ForecastChart, { props: props('en') }).find('table').text();
    expect(de).toContain('1.234,5');
    expect(en).toContain('1,234.5');
    expect(de).not.toContain('1,234.5');
  });

  it('draws previous seasons as paths', () => {
    const w = mount(ForecastChart, { props: props('en') });
    expect(w.findAll('path.cf-prev-line').length).toBeGreaterThanOrEqual(1);
    expect(w.find('path.cf-current').attributes('d')).toBeTruthy();
    expect(w.find('path.cf-median').attributes('d')).toBeTruthy();
  });

  it('handles empty observations without throwing', () => {
    const w = mount(ForecastChart, {
      props: props('en', []),
    });
    expect(w.find('svg').exists()).toBe(false);
    expect(w.find('.cf-empty').exists()).toBe(true);
    expect(w.find('p.cf-source').text()).toBe(SOURCE);
  });
});
