<template>
  <div class="cf-chart cf-backtest">
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

        <path class="cf-band80" :d="geometry.band80" />
        <path class="cf-band50" :d="geometry.band50" />
        <path class="cf-median" :d="geometry.median" />
        <path class="cf-actual" :d="geometry.actual" />
      </svg>
      <div v-else class="cf-empty" role="img" :aria-label="labels.title">&ndash;</div>
    </div>

    <ul class="cf-legend">
      <li><span class="cf-sw cf-sw-actual" />{{ labels.actual }}</li>
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
              <th scope="col">{{ labels.tableActual }}</th>
              <th scope="col">{{ labels.tableMedian }}</th>
              <th scope="col">{{ labels.tableRange80 }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in tableRows" :key="r.key">
              <th scope="row">{{ r.week }}</th>
              <td>{{ r.actual }}</td>
              <td>{{ r.median }}</td>
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
import { weeksBetween } from '@coldfront/forecast-core';
import type { BacktestChartLabels, BacktestChartPoint } from './backtest-types';

const MARGIN = { top: 12, right: 14, bottom: 40, left: 58 };
const MIN_WIDTH = 280;
const DEFAULT_WIDTH = 640;
const NA = '–';

interface Tick {
  pos: number;
  label: string;
}

interface XY {
  i: number;
  v: number | null;
}

interface Band {
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
  actual: string;
  median: string;
  band50: string;
  band80: string;
}

interface TableRow {
  key: string;
  week: string;
  actual: string;
  median: string;
  range80: string;
}

function makeFormatter(locale: string): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  } catch {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  }
}

export default defineComponent({
  name: 'BacktestChart',
  props: {
    points: { type: Array as PropType<BacktestChartPoint[]>, required: true },
    labels: { type: Object as PropType<BacktestChartLabels>, required: true },
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
    sorted(): BacktestChartPoint[] {
      return [...this.points].sort((a, b) => (a.iso_week < b.iso_week ? -1 : a.iso_week > b.iso_week ? 1 : 0));
    },
    geometry(): Geometry | null {
      const pts = this.sorted;
      const first = pts[0];
      if (!first) return null;

      const { width, height } = this;
      const left = MARGIN.left;
      const right = width - MARGIN.right;
      const top = MARGIN.top;
      const bottom = height - MARGIN.bottom;

      // x position = weeks since the first point, so gaps in the weekly series keep their width
      const xs = pts.map((p) => weeksBetween(first.iso_week, p.iso_week));
      const maxIndex = Math.max(1, ...xs);
      const x = scaleLinear().domain([0, maxIndex]).range([left, right]);

      const values = pts.flatMap((p) => [p.q90, p.actual ?? 0]);
      const y = scaleLinear().domain([0, Math.max(1, ...values)]).range([bottom, top]).nice();

      const pxPerWeek = (right - left) / maxIndex;
      const step = pxPerWeek * 4 >= 34 ? 4 : 8;
      const xTicks: Tick[] = [];
      const seen = new Set<number>();
      pts.forEach((p, k) => {
        if (xs[k]! % step === 0 && !seen.has(xs[k]!)) {
          seen.add(xs[k]!);
          xTicks.push({ pos: x(xs[k]!), label: this.labels.weekShort(p.iso_week) });
        }
      });
      const yTicks: Tick[] = y.ticks(4).map((v) => ({ pos: y(v), label: this.nf.format(v) }));

      const bandArea = (lo: (p: BacktestChartPoint) => number, hi: (p: BacktestChartPoint) => number) =>
        area<Band>()
          .x((d) => x(d.i))
          .y0((d) => y(d.lo))
          .y1((d) => y(d.hi))(pts.map((p, k) => ({ i: xs[k]!, lo: lo(p), hi: hi(p) }))) ?? '';

      const actualLine = line<XY>()
        .x((d) => x(d.i))
        .y((d) => y(d.v ?? 0))
        .defined((d) => d.v !== null);

      return {
        width,
        height,
        left,
        right,
        top,
        bottom,
        xTicks,
        yTicks,
        actual: actualLine(pts.map((p, k) => ({ i: xs[k]!, v: p.actual }))) ?? '',
        median: line<XY>().x((d) => x(d.i)).y((d) => y(d.v ?? 0))(pts.map((p, k) => ({ i: xs[k]!, v: p.q50 }))) ?? '',
        band80: bandArea((p) => p.q10, (p) => p.q90),
        band50: bandArea((p) => p.q25, (p) => p.q75),
      };
    },
    tableRows(): TableRow[] {
      if (!this.geometry) return [];
      const fmt = (v: number) => this.nf.format(v);
      return this.sorted.map<TableRow>((p) => ({
        key: p.iso_week,
        week: p.iso_week,
        actual: p.actual === null ? NA : fmt(p.actual),
        median: fmt(p.q50),
        range80: `${fmt(p.q10)} – ${fmt(p.q90)}`,
      }));
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
  --c-actual: var(--cf-text, #1c2430);
  --c-band50: var(--cf-band50, rgba(11, 95, 138, 0.4));
  --c-band80: var(--cf-band80, rgba(11, 95, 138, 0.2));
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
    --c-actual: var(--cf-text, #e6ebf0);
    --c-band50: var(--cf-band50, rgba(124, 196, 234, 0.4));
    --c-band80: var(--cf-band80, rgba(124, 196, 234, 0.26));
  }
}
:root[data-theme='dark'] .cf-chart {
  --c-text: var(--cf-text, #e6ebf0);
  --c-muted: var(--cf-muted, #a3adb8);
  --c-grid: var(--cf-grid, #2e3742);
  --c-accent: var(--cf-accent, #7cc4ea);
  --c-actual: var(--cf-text, #e6ebf0);
  --c-band50: var(--cf-band50, rgba(124, 196, 234, 0.4));
  --c-band80: var(--cf-band80, rgba(124, 196, 234, 0.26));
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
.cf-actual {
  fill: none;
  stroke: var(--c-actual);
  stroke-width: 2.5;
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
  gap: 4px 14px;
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
  width: 20px;
  height: 0;
  border-top: 2.5px solid var(--c-actual);
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
  white-space: nowrap;
}
.cf-table th:first-child,
.cf-table td:first-child {
  text-align: left;
}
</style>
