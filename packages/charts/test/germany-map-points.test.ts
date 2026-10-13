import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import GermanyMap from '../src/GermanyMap.vue';
import type { GermanyMapLabels, MapPoint, MapPointsLegend, MapValue } from '../src/types';

/** Same hand-made squares as germany-map.test.ts: Alpha spans lon/lat 0..1, Beta 2..3, Gamma 0..1 in y from 2..3. */
const topology = {
  type: 'Topology',
  arcs: [
    [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
    [[2, 0], [3, 0], [3, 1], [2, 1], [2, 0]],
    [[0, 2], [1, 2], [1, 3], [0, 3], [0, 2]],
  ],
  objects: {
    laender: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', arcs: [[0]], properties: { id: 'de-aa', name: 'Alpha' } },
        { type: 'Polygon', arcs: [[1]], properties: { id: 'de-bb', name: 'Beta' } },
        { type: 'Polygon', arcs: [[2]], properties: { id: 'de-cc', name: 'Gamma' } },
      ],
    },
  },
};

const labels: GermanyMapLabels = {
  title: 'Activity by state',
  legendTitle: 'Index',
  legendLow: 'low',
  legendHigh: 'high',
  noData: 'no colour value',
  showTable: 'Show table',
  tableRegion: 'Region',
  tableValue: 'Value',
  levels: { normal: 'normal', elevated: 'elevated', high: 'high' },
};

const values: MapValue[] = [
  { id: 'de-aa', name: 'Alpha', value: null, level: null, label: '' },
  { id: 'de-bb', name: 'Beta', value: null, level: null, label: '' },
  { id: 'de-cc', name: 'Gamma', value: null, level: null, label: '' },
];

const points: MapPoint[] = [
  { id: 'ww-low', lon: 0.2, lat: 0.2, name: 'Lowtown', label: 'percentile 6', level: 'low' },
  { id: 'ww-med', lon: 2.5, lat: 0.5, name: 'Medtown', label: 'percentile 60', level: 'medium' },
  { id: 'ww-high', lon: 0.5, lat: 2.5, name: 'Hightown', label: 'percentile 93', level: 'high', radius: 11 },
  { id: 'ww-none', lon: 2.2, lat: 2.8, name: 'Stale', label: 'no current data', level: 'none' },
  { id: 'ww-nan', lon: Number.NaN, lat: 1, name: 'Broken', label: 'x', level: 'low' },
];

const pointsLegend: MapPointsLegend = {
  title: 'Sites',
  low: 'low percentile',
  medium: 'medium percentile',
  high: 'high percentile',
  none: 'no current data',
};

function mountMap(extra: Record<string, unknown> = {}, selected: string | null = null) {
  return mount(GermanyMap, {
    props: { topology, values, labels, selected, sourceLine: 'Source: test', ...extra },
  });
}

describe('GermanyMap points', () => {
  it('renders nothing point-related when points are not given (backward compatible)', () => {
    const w = mountMap();
    expect(w.find('.cf-points').exists()).toBe(false);
    expect(w.find('.cf-points-legend').exists()).toBe(false);
    expect(w.find('.cf-points-details').exists()).toBe(false);
    expect(w.findAll('path.cf-region')).toHaveLength(3);
  });

  it('draws one marker per valid point and skips non-finite coordinates', () => {
    const w = mountMap({ points });
    expect(w.findAll('.cf-point')).toHaveLength(4);
    expect(w.find('[data-point="ww-nan"]').exists()).toBe(false);
  });

  it('encodes the level by shape and class, not only by colour', () => {
    const w = mountMap({ points });
    const low = w.find('[data-point="ww-low"]');
    const med = w.find('[data-point="ww-med"]');
    const high = w.find('[data-point="ww-high"]');
    const none = w.find('[data-point="ww-none"]');
    expect(low.classes()).toContain('cf-point-low');
    expect(low.find('circle').attributes('r')).toBe('3.5');
    expect(med.find('circle').attributes('r')).toBe('5.5');
    expect(Number(high.find('circle').attributes('r'))).toBeGreaterThan(Number(med.find('circle').attributes('r')));
    expect(high.find('circle').attributes('r')).toBe('11');
    expect(none.classes()).toContain('cf-point-none');
    expect(none.find('circle').exists()).toBe(false);
    expect(none.find('path').attributes('d')).toMatch(/^M-3 -3L3 3M-3 3L3 -3$/);
  });

  it('gives each point an accessible name and a title, without keyboard focus', () => {
    const w = mountMap({ points });
    const low = w.find('[data-point="ww-low"]');
    expect(low.attributes('role')).toBe('img');
    expect(low.attributes('aria-label')).toBe('Lowtown: percentile 6');
    expect(low.find('title').text()).toBe('Lowtown: percentile 6');
    expect(low.attributes('tabindex')).toBeUndefined();
    expect(w.findAll('.cf-point[tabindex]')).toHaveLength(0);
  });

  it('projects points with the same projection as the states', () => {
    const w = mountMap({ points: [{ id: 'origin', lon: 0, lat: 0, name: 'Origin', label: 'x', level: 'low' }] });
    const alphaStart = /^M([-\d.]+),([-\d.]+)/.exec(w.find('[data-region="de-aa"]').attributes('d') ?? '');
    expect(alphaStart).not.toBeNull();
    const transform = w.find('[data-point="origin"]').attributes('transform') ?? '';
    const m = /^translate\(([-\d.e]+) ([-\d.e]+)\)$/.exec(transform);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeCloseTo(Number(alphaStart![1]), 2);
    expect(Number(m![2])).toBeCloseTo(Number(alphaStart![2]), 2);
  });

  it('keeps the region paths as the first children, with the points drawn after them', () => {
    const w = mountMap({ points });
    const svg = w.find('svg');
    const children = Array.from(svg.element.children).map((el) => el.tagName.toLowerCase());
    const lastRegion = children.lastIndexOf('path');
    const pointsGroup = children.indexOf('g');
    expect(pointsGroup).toBeGreaterThan(-1);
    expect(pointsGroup).toBeGreaterThan(lastRegion - 1);
  });

  it('keeps states clickable and keyboard-selectable with points shown', async () => {
    const w = mountMap({ points });
    await w.find('[data-region="de-aa"]').trigger('click');
    await w.find('[data-region="de-cc"]').trigger('keydown', { key: 'Enter' });
    expect(w.emitted('select')).toEqual([['de-aa'], ['de-cc']]);
  });

  it('renders a points legend with the level texts when pointsLegend is given', () => {
    const w = mountMap({ points, pointsLegend });
    const legend = w.find('.cf-points-legend');
    expect(legend.exists()).toBe(true);
    expect(legend.find('p.cf-legend-title').text()).toBe('Sites');
    const items = legend.findAll('li').map((li) => li.text());
    expect(items).toEqual(['low percentile', 'medium percentile', 'high percentile', 'no current data']);
    for (const svg of legend.findAll('svg.cf-key')) expect(svg.attributes('aria-hidden')).toBe('true');
  });

  it('renders a points table with the given headers and level texts, sorted by name', () => {
    const w = mountMap({
      points,
      pointsLegend,
      pointsTableLabels: { name: 'Site', value: 'Percentile', summary: 'Show sites' },
    });
    const details = w.find('details.cf-points-details');
    expect(details.find('summary').text()).toBe('Show sites');
    const headers = details.findAll('thead th').map((th) => th.text());
    expect(headers).toEqual(['Site', 'Percentile']);
    const names = details.findAll('tbody th').map((th) => th.text());
    // Points without a valid position stay in the table, sorted by name.
    expect(names).toEqual(['Broken', 'Hightown', 'Lowtown', 'Medtown', 'Stale']);
    expect(details.findAll('tbody tr')[2]!.find('td').text()).toBe('percentile 6 · low percentile');
  });

  it('falls back to the shared labels for the points table when no table labels are given', () => {
    const w = mountMap({ points });
    const details = w.find('details.cf-points-details');
    expect(details.find('summary').text()).toBe('Show table');
    expect(details.findAll('thead th').map((th) => th.text())).toEqual(['Region', 'Value']);
  });

  it('hides the colour scale and the states table when asked, keeping the no-data key', () => {
    const w = mountMap({ showScale: false, showStateTable: false, points, pointsLegend });
    expect(w.find('.cf-bar').exists()).toBe(false);
    expect(w.find('.cf-bar-labels').exists()).toBe(false);
    expect(w.find('.cf-nodata-key').text()).toContain('no colour value');
    expect(w.find('details.cf-points-details').exists()).toBe(true);
    expect(w.findAll('details').filter((d) => !d.classes().includes('cf-points-details'))).toHaveLength(0);
  });

  it('keeps the colour scale and the states table by default', () => {
    const w = mountMap({ points });
    expect(w.find('.cf-bar').exists()).toBe(true);
    expect(w.findAll('details')).toHaveLength(2);
  });
});
