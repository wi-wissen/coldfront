import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import GermanyMap from '../src/GermanyMap.vue';
import type { GermanyMapLabels, MapValue } from '../src/types';

/** Three hand-made square regions, absolute coordinates (no transform). */
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
  noData: 'no data',
  showTable: 'Show table',
  tableRegion: 'Region',
  tableValue: 'Value',
  levels: { normal: 'normal', elevated: 'elevated', high: 'high' },
};

const values: MapValue[] = [
  { id: 'de-aa', name: 'Alpha', value: 2, level: 'high', label: 'index 2.0' },
  { id: 'de-bb', name: 'Beta', value: 0.5, level: 'normal', label: 'index 0.5' },
  { id: 'de-cc', name: 'Gamma', value: null, level: null, label: '' },
];

function mountMap(selected: string | null = null, vals: MapValue[] = values) {
  return mount(GermanyMap, {
    props: { topology, values: vals, labels, selected, sourceLine: 'Source: test' },
  });
}

describe('GermanyMap', () => {
  it('renders one path per region with an accessible name', () => {
    const w = mountMap();
    const paths = w.findAll('path.cf-region');
    expect(paths).toHaveLength(3);
    for (const p of paths) {
      expect(p.attributes('role')).toBe('button');
      expect(p.attributes('tabindex')).toBe('0');
      expect(p.attributes('d')).toBeTruthy();
    }
    expect(w.find('[data-region="de-aa"]').attributes('aria-label')).toBe('Alpha: index 2.0');
  });

  it('colours a high value differently from a low value', () => {
    const w = mountMap();
    const high = w.find('[data-region="de-aa"]').attributes('fill');
    const low = w.find('[data-region="de-bb"]').attributes('fill');
    // d3-scale returns rgb() strings for the clamped end stops
    expect(high).toBe('rgb(253, 231, 37)');
    expect(low).toBe('rgb(68, 1, 84)');
    expect(high).not.toBe(low);
  });

  it('renders null values with the hatch fill and the noData label', () => {
    const w = mountMap();
    const nd = w.find('[data-region="de-cc"]');
    expect(nd.attributes('fill')).toMatch(/^url\(#cf-hatch-\d+\)$/);
    expect(nd.classes()).toContain('cf-nodata');
    expect(nd.attributes('aria-label')).toBe('Gamma: no data');
  });

  it('emits select with the region id on click', async () => {
    const w = mountMap();
    await w.find('[data-region="de-bb"]').trigger('click');
    expect(w.emitted('select')).toEqual([['de-bb']]);
  });

  it('emits select on Enter and Space', async () => {
    const w = mountMap();
    await w.find('[data-region="de-cc"]').trigger('keydown', { key: 'Enter' });
    await w.find('[data-region="de-aa"]').trigger('keydown', { key: ' ' });
    expect(w.emitted('select')).toEqual([['de-cc'], ['de-aa']]);
  });

  it('marks the selected region with a CSS class only', () => {
    const w = mountMap('de-cc');
    expect(w.find('[data-region="de-cc"]').classes()).toContain('cf-selected');
    expect(w.find('[data-region="de-aa"]').classes()).not.toContain('cf-selected');
    expect(w.find('[data-region="de-cc"]').attributes('aria-pressed')).toBe('true');
  });

  it('renders the data table and source line', () => {
    const w = mountMap();
    expect(w.findAll('table tbody tr')).toHaveLength(3);
    expect(w.find('p.cf-source').text()).toBe('Source: test');
  });
});
