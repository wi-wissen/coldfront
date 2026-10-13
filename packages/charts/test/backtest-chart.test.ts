import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import BacktestChart from '../src/BacktestChart.vue';
import type { BacktestChartLabels, BacktestChartPoint } from '../src/backtest-types';

const SOURCE = 'Quelle: Robert Koch-Institut; eigene Berechnung';

const labels: BacktestChartLabels = {
  title: 'Forecast against actual values for Saxony',
  actual: 'Actual',
  forecast: 'Forecast median',
  band50: '50 % range',
  band80: '80 % range',
  yAxis: 'Consultations per 100,000',
  showTable: 'Show data table',
  tableWeek: 'Week',
  tableActual: 'Actual',
  tableMedian: 'Median',
  tableRange80: '80 % range',
  weekShort: (w: string) => `KW ${Number(w.slice(-2))}`,
};

function points(n = 6, actualAt?: number): BacktestChartPoint[] {
  const out: BacktestChartPoint[] = [];
  for (let i = 0; i < n; i++) {
    const week = 40 + i;
    const iso = `2024-W${String(week).padStart(2, '0')}`;
    const med = 1000 + 100 * i;
    out.push({
      iso_week: iso,
      actual: i === actualAt ? null : 900 + 120 * i + 0.5,
      q10: med - 300,
      q25: med - 150,
      q50: med,
      q75: med + 150,
      q90: med + 300,
    });
  }
  return out;
}

function props(locale: string, pts = points()) {
  return { points: pts, labels, locale, sourceLine: SOURCE };
}

describe('BacktestChart', () => {
  it('renders an accessible SVG image labelled with the title', () => {
    const svg = mount(BacktestChart, { props: props('en') }).find('svg[role="img"]');
    expect(svg.exists()).toBe(true);
    expect(svg.attributes('aria-label')).toBe(labels.title);
    expect(svg.attributes('viewBox')).toMatch(/^0 0 \d+ \d+$/);
  });

  it('draws actual, median and both bands as paths', () => {
    const w = mount(BacktestChart, { props: props('en') });
    for (const sel of ['path.cf-actual', 'path.cf-median', 'path.cf-band50', 'path.cf-band80']) {
      expect(w.find(sel).attributes('d')).toBeTruthy();
    }
  });

  it('renders one table row per scored week', () => {
    const w = mount(BacktestChart, { props: props('en') });
    const rows = w.findAll('table tbody tr');
    expect(rows).toHaveLength(6);
    expect(rows[0]!.find('th').text()).toBe('2024-W40');
    expect(rows[5]!.find('th').text()).toBe('2024-W45');
  });

  it('formats numbers with the locale', () => {
    const de = mount(BacktestChart, { props: props('de', [{ ...points(1)[0]!, actual: 1234.5 }]) }).find('table').text();
    const en = mount(BacktestChart, { props: props('en', [{ ...points(1)[0]!, actual: 1234.5 }]) }).find('table').text();
    expect(de).toContain('1.234,5');
    expect(en).toContain('1,234.5');
    expect(de).not.toContain('1,234.5');
  });

  it('shows a dash for null actuals and keeps the chart', () => {
    const w = mount(BacktestChart, { props: props('en', points(6, 2)) });
    const rows = w.findAll('table tbody tr');
    expect(rows[2]!.findAll('td')[0]!.text()).toBe('–');
    expect(rows[3]!.findAll('td')[0]!.text()).not.toBe('–');
    expect(w.find('svg').exists()).toBe(true);
  });

  it('renders the source line below the chart', () => {
    expect(mount(BacktestChart, { props: props('en') }).find('p.cf-source').text()).toBe(SOURCE);
  });

  it('handles empty points without throwing', () => {
    const w = mount(BacktestChart, { props: props('en', []) });
    expect(w.find('svg').exists()).toBe(false);
    expect(w.find('.cf-empty').attributes('role')).toBe('img');
    expect(w.find('details').exists()).toBe(false);
    expect(w.find('p.cf-source').text()).toBe(SOURCE);
  });

  it('uses the week labels passed in', () => {
    const w = mount(BacktestChart, { props: props('de') });
    expect(w.find('table tbody tr th').text()).toBe('2024-W40');
    expect(w.text()).toContain('KW 40');
  });
});
