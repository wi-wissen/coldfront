<template>
  <div class="cf-chart cf-forecast">
    <div ref="box" class="cf-box">
      <svg
        v-if="geometry"
        class="cf-svg"
        role="img"
        :aria-label="labels.title"
        :viewBox="`0 0 ${geometry.width} ${geometry.height}`"
      >
        <g class="cf-grid">
          <line
            v-for="t in geometry.yTicks"
            :key="`g${t.label}`"
            :x1="geometry.left"
            :x2="geometry.right"
            :y1="t.pos"
            :y2="t.pos"
          />
        </g>

        <g class="cf-axis-y">
          <text
            v-for="t in geometry.yTicks"
            :key="`y${t.label}`"
            :x="geometry.left - 8"
            :y="t.pos"
            dy="0.32em"
            text-anchor="end"
          >{{ t.label }}</text>
          <text
            class="cf-caption"
            :transform="`translate(14 ${(geometry.top + geometry.bottom) / 2}) rotate(-90)`"
            text-anchor="middle"
          >{{ labels.yAxis }}</text>
        </g>

        <g class="cf-axis-x">
          <line :x1="geometry.left" :x2="geometry.right" :y1="geometry.bottom" :y2="geometry.bottom" />
          <g v-for="t in geometry.xTicks" :key="`x${t.pos}`">
            <line :x1="t.pos" :x2="t.pos" :y1="geometry.bottom" :y2="geometry.bottom + 4" />
            <text :x="t.pos" :y="geometry.bottom + 17" text-anchor="middle">{{ t.label }}</text>
          </g>
        </g>

        <path v-for="(d, i) in geometry.previous" :key="`p${i}`" class="cf-prev-line" :d="d" />
        <path class="cf-band80" :d="geometry.band80" />
        <path class="cf-band50" :d="geometry.band50" />
        <path class="cf-current" :d="geometry.current" />
        <path class="cf-median" :d="geometry.median" />
        <circle class="cf-origin" :cx="geometry.origin.x" :cy="geometry.origin.y" r="3.5" />
      </svg>
      <div v-else class="cf-empty" role="img" :aria-label="labels.title">&ndash;</div>
    </div>

    <ul class="cf-legend">
      <li><span class="cf-sw cf-sw-current" />{{ labels.currentSeason }}</li>
      <li><span class="cf-sw cf-sw-prev" />{{ labels.previousSeasons }}</li>
      <li><span class="cf-sw cf-sw-forecast" />{{ labels.forecast }}</li>
      <li><span class="cf-sw cf-sw-band50" />{{ labels.band50 }}</li>
      <li><span class="cf-sw cf-sw-band80" />{{ labels.band80 }}</li>
    </ul>

    <p class="cf-source">{{ sourceLine }}</p>

    <details v-if="geometry" class="cf-details">
      <summary>{{ labels.showTable }}</summary>
      <div class="cf-table-wrap">
        <table class="cf-table">
          <thead>
            <tr>
              <th scope="col">{{ labels.tableWeek }}</th>
              <th scope="col">{{ labels.tableObserved }}</th>
              <th scope="col">{{ labels.tableMedian }}</th>
              <th scope="col">{{ labels.tableRange50 }}</th>
              <th scope="col">{{ labels.tableRange80 }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in tableRows" :key="r.key">
              <th scope="row">{{ r.week }}</th>
              <td>{{ r.observed }}</td>
              <td>{{ r.median }}</td>
              <td>{{ r.range50 }}</td>
              <td>{{ r.range80 }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { scaleLinear } from 'd3-scale';
import { area, line } from 'd3-shape';
import type { ObservedPoint, QuantileSet } from '@coldfront/forecast-core';
import type { ForecastChartLabels } from './types';
import { buildAxis, splitSeasons, type SeasonAxis } from './season';

const MARGIN = { top: 12, right: 14, bottom: 40, left: 58 };
const MIN_WIDTH = 280;
const DEFAULT_WIDTH = 640;
const MAX_TABLE_OBSERVED = 12;
const NA = '–';

interface Tick {
  pos: number;
  label: string;
}

interface AreaPoint {
  i: number;
  lo: number;
  hi: number;
}

interface Geometry {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  xTicks: Tick[];
  yTicks: Tick[];
  previous: string[];
  current: string;
  median: string;
  band50: string;
  band80: string;
  origin: { x: number; y: number };
}

interface TableRow {
  key: string;
  week: string;
  observed: string;
  median: string;
  range50: string;
  range80: string;
}

function makeFormatter(locale: string): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  } catch {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  }
}

function byWeek<T extends { iso_week: string }>(a: T, b: T): number {
  return a.iso_week < b.iso_week ? -1 : a.iso_week > b.iso_week ? 1 : 0;
}

export default defineComponent({
  name: 'ForecastChart',
  props: {
    observed: { type: Array as PropType<ObservedPoint[]>, required: true },
    horizons: { type: Array as PropType<QuantileSet[]>, required: true },
    labels: { type: Object as PropType<ForecastChartLabels>, required: true },
    locale: { type: String, required: true },
    sourceLine: { type: String, required: true },
  },
  data() {
    return {
      width: DEFAULT_WIDTH,
      observer: null as ResizeObserver | null,
    };
  },
  computed: {
    height(): number {
      return Math.round(Math.min(340, Math.max(230, this.width * 0.6)));
    },
    nf(): Intl.NumberFormat {
      return makeFormatter(this.locale);
    },
    sortedHorizons(): QuantileSet[] {
      return [...this.horizons].sort(byWeek);
    },
    axis(): SeasonAxis | null {
      return buildAxis(
        this.observed,
        this.horizons.map((h) => h.iso_week),
      );
    },
    geometry(): Geometry | null {
      const axis = this.axis;
      if (!axis) return null;

      const { width, height } = this;
      const left = MARGIN.left;
      const right = width - MARGIN.right;
      const top = MARGIN.top;
      const bottom = height - MARGIN.bottom;

      const x = scaleLinear().domain([0, axis.maxIndex]).range([left, right]);
      const yMax = Math.max(
        1,
        ...this.observed.map((p) => p.value),
        ...this.horizons.map((h) => h.q90),
      );
      const y = scaleLinear().domain([0, yMax]).range([bottom, top]).nice();

      const seasons = splitSeasons(this.observed);
      const current = seasons.find((s) => s.startYear === axis.startYear);
      const previous = seasons.filter((s) => s.startYear !== axis.startYear);
      const points = current?.points ?? [];
      const last = points[points.length - 1];
      if (!last) return null;

      const lineGen = line<[number, number]>()
        .x((d) => x(d[0]))
        .y((d) => y(d[1]));
      const areaGen = area<AreaPoint>()
        .x((d) => x(d.i))
        .y0((d) => y(d.lo))
        .y1((d) => y(d.hi));

      const fc = this.sortedHorizons.map((h) => ({ h, i: axis.indexOf(h.iso_week) }));
      const origin = { i: last.index, v: last.value };

      const bandPoints = (lo: (h: QuantileSet) => number, hi: (h: QuantileSet) => number): AreaPoint[] => [
        { i: origin.i, lo: origin.v, hi: origin.v },
        ...fc.map(({ h, i }) => ({ i, lo: lo(h), hi: hi(h) })),
      ];

      const pxPerWeek = (right - left) / Math.max(axis.maxIndex, 1);
      const step = pxPerWeek * 4 >= 34 ? 4 : 8;
      const xTicks: Tick[] = [];
      for (let i = 0; i <= axis.maxIndex; i += step) {
        xTicks.push({ pos: x(i), label: this.labels.weekShort(axis.weekAt(i)) });
      }
      const yTicks: Tick[] = y.ticks(4).map((v) => ({ pos: y(v), label: this.nf.format(v) }));

      return {
        width,
        height,
        left,
        right,
        top,
        bottom,
        xTicks,
        yTicks,
        previous: previous.map((s) => lineGen(s.points.map((p) => [p.index, p.value] as [number, number])) ?? ''),
        current: lineGen(points.map((p) => [p.index, p.value] as [number, number])) ?? '',
        median:
          lineGen([[origin.i, origin.v], ...fc.map(({ h, i }) => [i, h.q50] as [number, number])]) ?? '',
        band80: areaGen(bandPoints((h) => h.q10, (h) => h.q90)) ?? '',
        band50: areaGen(bandPoints((h) => h.q25, (h) => h.q75)) ?? '',
        origin: { x: x(origin.i), y: y(origin.v) },
      };
    },
    tableRows(): TableRow[] {
      if (!this.geometry) return [];
      const fmt = (v: number) => this.nf.format(v);
      const observed = [...this.observed]
        .sort(byWeek)
        .slice(-MAX_TABLE_OBSERVED)
        .map<TableRow>((p) => ({
          key: `o${p.iso_week}`,
          week: p.iso_week,
          observed: fmt(p.value),
          median: NA,
          range50: NA,
          range80: NA,
        }));
      const forecast = this.sortedHorizons.map<TableRow>((h) => ({
        key: `f${h.iso_week}`,
        week: h.iso_week,
        observed: NA,
        median: fmt(h.q50),
        range50: `${fmt(h.q25)} – ${fmt(h.q75)}`,
        range80: `${fmt(h.q10)} – ${fmt(h.q90)}`,
      }));
      return [...observed, ...forecast];
    },
  },
  mounted() {
    const el = this.$refs.box as HTMLElement | undefined;
    if (!el) return;
    const initial = el.clientWidth;
    if (initial > 0) this.width = Math.max(MIN_WIDTH, Math.round(initial));
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver((entries) => {
        const w = entries[0]?.contentRect.width ?? 0;
        if (w > 0) this.width = Math.max(MIN_WIDTH, Math.round(w));
      });
      this.observer.observe(el);
    }
  },
  beforeUnmount() {
    this.observer?.disconnect();
    this.observer = null;
  },
});
</script>

<style scoped>
.cf-chart {
  --c-text: var(--cf-text, #1c2430);
  --c-muted: var(--cf-muted, #5c6670);
  --c-grid: var(--cf-grid, #e4e8ed);
  --c-accent: var(--cf-accent, #0b5f8a);
  --c-prev: var(--cf-prev, #adb5be);
  --c-band50: var(--cf-band50, rgba(11, 95, 138, 0.4));
  --c-band80: var(--cf-band80, rgba(11, 95, 138, 0.16));
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
    --c-prev: var(--cf-prev, #5d6772);
    --c-band50: var(--cf-band50, rgba(124, 196, 234, 0.4));
    --c-band80: var(--cf-band80, rgba(124, 196, 234, 0.16));
  }
}
:root[data-theme='dark'] .cf-chart {
  --c-text: var(--cf-text, #e6ebf0);
  --c-muted: var(--cf-muted, #a3adb8);
  --c-grid: var(--cf-grid, #2e3742);
  --c-accent: var(--cf-accent, #7cc4ea);
  --c-prev: var(--cf-prev, #5d6772);
  --c-band50: var(--cf-band50, rgba(124, 196, 234, 0.4));
  --c-band80: var(--cf-band80, rgba(124, 196, 234, 0.16));
}

.cf-svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
.cf-grid line {
  stroke: var(--c-grid);
  stroke-width: 1;
}
.cf-axis-x line {
  stroke: var(--c-muted);
}
.cf-axis-y text,
.cf-axis-x text {
  fill: var(--c-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.cf-axis-y text.cf-caption {
  font-size: 12px;
}
.cf-prev-line {
  fill: none;
  stroke: var(--c-prev);
  stroke-width: 1.25;
  stroke-linejoin: round;
}
.cf-current {
  fill: none;
  stroke: var(--c-accent);
  stroke-width: 2.75;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.cf-median {
  fill: none;
  stroke: var(--c-accent);
  stroke-width: 2.25;
  stroke-dasharray: 6 4;
  stroke-linecap: round;
}
.cf-band80 {
  fill: var(--c-band80);
}
.cf-band50 {
  fill: var(--c-band50);
}
.cf-origin {
  fill: var(--c-accent);
}

.cf-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  border: 1px dashed var(--c-grid);
  border-radius: 6px;
  color: var(--c-muted);
}

.cf-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
  color: var(--c-muted);
}
.cf-legend li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.cf-sw {
  display: inline-block;
  width: 22px;
  height: 0;
  border-top: 2.5px solid var(--c-accent);
}
.cf-sw-prev {
  border-top: 1.25px solid var(--c-prev);
}
.cf-sw-forecast {
  border-top: 2.25px dashed var(--c-accent);
}
.cf-sw-band50,
.cf-sw-band80 {
  height: 10px;
  border: 0;
  border-radius: 2px;
}
.cf-sw-band50 {
  background: var(--c-band50);
}
.cf-sw-band80 {
  background: var(--c-band80);
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
  font-variant-numeric: tabular-nums;
}
.cf-table th,
.cf-table td {
  padding: 4px 8px;
  text-align: right;
  border-bottom: 1px solid var(--c-grid);
  vertical-align: top;
}
.cf-table th:first-child,
.cf-table td:first-child {
  text-align: left;
  white-space: nowrap;
}
</style>
