<template>
  <div class="cf-chart cf-map">
    <svg class="cf-svg" role="group" :aria-label="labels.title" :viewBox="viewBox">
      <defs>
        <pattern :id="hatchId" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" class="cf-hatch-bg" />
          <line x1="0" y1="0" x2="0" y2="6" class="cf-hatch-line" />
        </pattern>
      </defs>
      <path
        v-for="r in regions"
        :key="r.id"
        :d="r.d"
        :fill="r.fill"
        :data-region="r.id"
        :class="['cf-region', { 'cf-selected': r.selected, 'cf-nodata': r.value === null }]"
        role="button"
        tabindex="0"
        :aria-label="r.ariaLabel"
        :aria-pressed="r.selected ? 'true' : 'false'"
        @click="pick(r.id)"
        @keydown.enter.prevent="pick(r.id)"
        @keydown.space.prevent="pick(r.id)"
      >
        <title>{{ r.ariaLabel }}</title>
      </path>
    </svg>

    <div class="cf-legend-map">
      <p class="cf-legend-title">{{ labels.legendTitle }}</p>
      <div class="cf-bar" role="img" :aria-label="labels.legendTitle" :style="{ background: gradient }" />
      <div class="cf-bar-labels">
        <span>{{ labels.legendLow }}</span>
        <span>{{ labels.legendHigh }}</span>
      </div>
      <p class="cf-nodata-key">
        <span class="cf-nodata-swatch" aria-hidden="true" />{{ labels.noData }}
      </p>
    </div>

    <p class="cf-source">{{ sourceLine }}</p>

    <details class="cf-details">
      <summary>{{ labels.showTable }}</summary>
      <div class="cf-table-wrap">
        <table class="cf-table">
          <thead>
            <tr>
              <th scope="col">{{ labels.tableRegion }}</th>
              <th scope="col">{{ labels.tableValue }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in tableRows" :key="r.id">
              <th scope="row">{{ r.name }}</th>
              <td>{{ r.text }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { geoConicConformal, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Geometry, FeatureCollection } from 'geojson';
import type { ActivityLevel } from '@coldfront/forecast-core';
import type { GermanyMapLabels, MapValue } from './types';
import { VIRIDIS_STOPS, viridisScale } from './viridis';

const PROJECTION_SIZE: [number, number] = [460, 560];
const VIEW_PAD = 6;

interface RegionProps {
  id: string;
  name?: string;
}

interface RegionShape {
  id: string;
  name: string;
  d: string;
}

let instanceSeq = 0;

export default defineComponent({
  name: 'GermanyMap',
  props: {
    topology: { type: Object as PropType<unknown>, required: true },
    values: { type: Array as PropType<MapValue[]>, required: true },
    labels: { type: Object as PropType<GermanyMapLabels>, required: true },
    selected: { type: String as PropType<string | null>, required: true },
    sourceLine: { type: String, required: true },
    domain: {
      type: Array as unknown as PropType<[number, number]>,
      default: (): [number, number] => [0.5, 2],
    },
  },
  emits: ['select'],
  data() {
    instanceSeq += 1;
    return { hatchId: `cf-hatch-${instanceSeq}` };
  },
  computed: {
    geo(): { shapes: RegionShape[]; viewBox: string } {
      const empty = { shapes: [], viewBox: `0 0 ${PROJECTION_SIZE[0]} ${PROJECTION_SIZE[1]}` };
      if (!this.topology || typeof this.topology !== 'object' || !('objects' in this.topology)) return empty;
      type Topo = Parameters<typeof feature>[0];
      type Obj = Parameters<typeof feature>[1];
      const topo = this.topology as Topo;
      const obj = (topo as unknown as { objects: Record<string, Obj> }).objects['laender'];
      if (!obj) return empty;
      const fc = feature(topo, obj) as unknown as FeatureCollection<Geometry, RegionProps>;
      const projection = geoConicConformal()
        .parallels([48.5, 53.5])
        .rotate([-10.5, 0])
        .fitSize(PROJECTION_SIZE, fc as GeoPermissibleObjects);
      const path = geoPath(projection);
      const [[x0, y0], [x1, y1]] = path.bounds(fc as GeoPermissibleObjects);
      const shapes = fc.features.map((f) => ({
        id: f.properties.id,
        name: f.properties.name ?? f.properties.id,
        d: path(f as GeoPermissibleObjects) ?? '',
      }));
      const viewBox = `${x0 - VIEW_PAD} ${y0 - VIEW_PAD} ${x1 - x0 + 2 * VIEW_PAD} ${y1 - y0 + 2 * VIEW_PAD}`;
      return { shapes, viewBox };
    },
    shapes(): RegionShape[] {
      return this.geo.shapes;
    },
    viewBox(): string {
      return this.geo.viewBox;
    },
    colour(): (value: number) => string {
      return viridisScale(this.domain);
    },
    gradient(): string {
      return `linear-gradient(to right, ${VIRIDIS_STOPS.join(', ')})`;
    },
    valueById(): Map<string, MapValue> {
      return new Map(this.values.map((v) => [v.id, v]));
    },
    regions(): Array<{
      id: string;
      d: string;
      fill: string;
      value: number | null;
      selected: boolean;
      ariaLabel: string;
    }> {
      const out = this.shapes.map((s) => {
        const v = this.valueById.get(s.id);
        const value = v && v.value !== null && Number.isFinite(v.value) ? v.value : null;
        const name = v?.name || s.name;
        const text = value === null ? this.labels.noData : v?.label ?? this.labels.noData;
        return {
          id: s.id,
          d: s.d,
          fill: value === null ? `url(#${this.hatchId})` : this.colour(value),
          value,
          selected: s.id === this.selected,
          ariaLabel: `${name}: ${text}`,
        };
      });
      // Selected region is drawn last so its outline is not covered by neighbours.
      return [...out.filter((r) => !r.selected), ...out.filter((r) => r.selected)];
    },
    tableRows(): Array<{ id: string; name: string; text: string }> {
      return this.shapes
        .map((s) => {
          const v = this.valueById.get(s.id);
          const hasValue = v !== undefined && v.value !== null && Number.isFinite(v.value);
          const level = v?.level as ActivityLevel | null | undefined;
          const parts = hasValue ? [v?.label ?? '', level ? this.labels.levels[level] : ''] : [this.labels.noData];
          return { id: s.id, name: v?.name || s.name, text: parts.filter(Boolean).join(' · ') };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  },
  methods: {
    pick(id: string): void {
      this.$emit('select', id);
    },
  },
});
</script>

<style scoped>
.cf-chart {
  --c-text: var(--cf-text, #1c2430);
  --c-muted: var(--cf-muted, #5c6670);
  --c-grid: var(--cf-grid, #e4e8ed);
  --c-accent: var(--cf-accent, #0b5f8a);
  --c-surface: var(--cf-surface, #ffffff);
  --c-nodata: var(--cf-nodata, #d5dbe1);
  --c-hatch: var(--cf-hatch, #8b95a0);
  --c-focus: var(--cf-focus, #0b5f8a);
  color: var(--c-text);
  font: 14px/1.4 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  margin: 0;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .cf-chart {
    --c-text: var(--cf-text, #e6ebf0);
    --c-muted: var(--cf-muted, #a3adb8);
    --c-grid: var(--cf-grid, #2e3742);
    --c-accent: var(--cf-accent, #7cc4ea);
    --c-surface: var(--cf-surface, #161b22);
    --c-nodata: var(--cf-nodata, #2b333d);
    --c-hatch: var(--cf-hatch, #5d6772);
    --c-focus: var(--cf-focus, #7cc4ea);
  }
}
:root[data-theme='dark'] .cf-chart {
  --c-text: var(--cf-text, #e6ebf0);
  --c-muted: var(--cf-muted, #a3adb8);
  --c-grid: var(--cf-grid, #2e3742);
  --c-accent: var(--cf-accent, #7cc4ea);
  --c-surface: var(--cf-surface, #161b22);
  --c-nodata: var(--cf-nodata, #2b333d);
  --c-hatch: var(--cf-hatch, #5d6772);
  --c-focus: var(--cf-focus, #7cc4ea);
}

.cf-svg {
  display: block;
  width: 100%;
  max-width: 520px;
  height: auto;
  margin: 0 auto;
}
.cf-region {
  stroke: var(--c-surface);
  stroke-width: 0.8;
  stroke-linejoin: round;
  cursor: pointer;
  outline: none;
  transition: stroke-width 0.1s;
}
.cf-region:hover {
  stroke: var(--c-text);
  stroke-width: 1.6;
}
.cf-region:focus-visible {
  stroke: var(--c-focus);
  stroke-width: 2.6;
}
.cf-region.cf-selected {
  stroke: var(--c-text);
  stroke-width: 3;
}
.cf-hatch-bg {
  fill: var(--c-nodata);
}
.cf-hatch-line {
  stroke: var(--c-hatch);
  stroke-width: 1.5;
}

.cf-legend-map {
  max-width: 420px;
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--c-muted);
}
.cf-legend-title {
  margin: 0 0 4px;
  color: var(--c-text);
  font-size: 13px;
}
.cf-bar {
  height: 12px;
  border-radius: 3px;
}
.cf-bar-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 2px;
}
.cf-nodata-key {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0 0;
}
.cf-nodata-swatch {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 2px;
  background: repeating-linear-gradient(45deg, var(--c-hatch) 0 2px, var(--c-nodata) 2px 6px);
}

.cf-source {
  margin: 8px 0 12px;
  font-size: 12px;
  color: var(--c-muted);
}

.cf-details summary {
  cursor: pointer;
  color: var(--c-accent);
  font-size: 13px;
  padding: 4px 0;
}
.cf-table-wrap {
  overflow-x: auto;
  margin-top: 6px;
}
.cf-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.cf-table th,
.cf-table td {
  padding: 4px 8px;
  text-align: left;
  border-bottom: 1px solid var(--c-grid);
}
</style>
