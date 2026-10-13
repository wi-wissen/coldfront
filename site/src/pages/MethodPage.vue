<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { REGIONS, type MetricSummary } from '@coldfront/forecast-core';
import { formatNumber } from '../api';
import DocTable, { type DocHeader } from '../components/DocTable.vue';
import type { PageContext } from '../types';

/** Model names in the published files mapped to message keys (pages.method.modelNames.*). */
const MODEL_KEY: Record<string, string> = {
  'baseline-seasonal': 'baseline',
  persistence: 'persistence',
  'regional-model': 'regional',
  ensemble: 'ensemble',
};
/** Comparison keys of the published files mapped to message keys (pages.method.cmp.*). */
const CMP_KEY: Record<string, string> = {
  'ensemble vs baseline-seasonal': 'ensembleBaseline',
  'ensemble vs persistence': 'ensemblePersistence',
  'regional-model vs baseline-seasonal': 'regionalBaseline',
};
const PHASES = ['low', 'rise', 'peak', 'decline'] as const;
const GROUPS = ['dynamics', 'season', 'holiday', 'weather', 'wastewater'] as const;

type Cell = number | null | undefined;

export default defineComponent({
  name: 'MethodPage',
  components: { DocTable },
  props: { ctx: { type: Object as PropType<PageContext>, required: true } },
  computed: {
    bt() {
      return this.ctx.data.backtest;
    },
    tn() {
      return this.ctx.data.tuning;
    },
    groupKeys() {
      return GROUPS;
    },
    overallHeaders(): DocHeader[] {
      return [
        { label: this.$t('pages.method.overallHead.model') },
        { label: this.$t('pages.method.overallHead.n'), numeric: true },
        { label: this.$t('pages.method.overallHead.mae'), numeric: true },
        { label: this.$t('pages.method.overallHead.wis'), numeric: true },
        { label: this.$t('pages.method.overallHead.cov50'), numeric: true },
        { label: this.$t('pages.method.overallHead.cov80'), numeric: true },
      ];
    },
    overallRows() {
      const bt = this.bt;
      if (!bt) return [];
      return bt.models
        .filter((m) => bt.overall[m])
        .map((m) => {
          const s = bt.overall[m] as MetricSummary;
          return { model: m, label: this.modelLabel(m), n: s.n, mae: s.mae, wis: s.wis, c50: s.coverage50, c80: s.coverage80 };
        });
    },
    gateText(): string {
      const bt = this.bt;
      if (!bt) return '';
      const g = bt.gate;
      const rel = g.rel_wis_improvement;
      const threshold = this.pct(g.threshold, 0);
      if (rel === null || rel === undefined) return this.$t('pages.method.gateNoValue');
      if (g.shipped === 'ensemble') return this.$t('pages.method.gateShipEnsemble', { rel: this.pct(rel), threshold });
      return this.$t('pages.method.gateShipBaseline', { rel: this.pct(rel), threshold });
    },
    comparisonHeaders(): DocHeader[] {
      return [
        { label: this.$t('pages.method.comparisonsHead.pair') },
        { label: this.$t('pages.method.comparisonsHead.diff'), numeric: true },
        { label: this.$t('pages.method.comparisonsHead.rel'), numeric: true },
        { label: this.$t('pages.method.comparisonsHead.ci') },
        { label: this.$t('pages.method.comparisonsHead.seasons'), numeric: true },
        { label: this.$t('pages.method.comparisonsHead.n'), numeric: true },
      ];
    },
    comparisonRows() {
      const bt = this.bt;
      if (!bt) return [];
      return Object.keys(bt.comparisons).map((key) => {
        const c = bt.comparisons[key];
        return {
          key,
          label: this.cmpLabel(key),
          diff: c ? c.meanDiff : null,
          rel: c ? c.relImprovement : null,
          ci: c ? this.$t('pages.method.ciFormat', { lo: this.num(c.ci95[0]), hi: this.num(c.ci95[1]) }) : '–',
          seasons: c ? this.$t('pages.method.seasonsOf', { won: c.seasonsBetter, total: c.seasonsTotal }) : '–',
          n: c ? c.n : null,
        };
      });
    },
    phaseHeaders(): DocHeader[] {
      return [{ label: this.$t('pages.method.phaseHead.phase') }, ...this.modelColumns.map((m) => ({ label: this.modelLabel(m), numeric: true }))];
    },
    modelColumns(): string[] {
      return this.bt ? this.bt.models : [];
    },
    phaseRows() {
      const bt = this.bt;
      if (!bt) return [];
      return PHASES.filter((p) => bt.by_phase[p]).map((p) => ({
        key: p,
        label: this.$t(`pages.method.phases.${p}`),
        cells: this.modelColumns.map((m) => bt.by_phase[p]?.[m]?.wis),
      }));
    },
    horizonRows() {
      const bt = this.bt;
      if (!bt) return [];
      return Object.keys(bt.by_horizon)
        .sort()
        .map((h) => ({ key: h, label: h.replace(/^h/, ''), cells: this.modelColumns.map((m) => bt.by_horizon[h]?.[m]?.wis) }));
    },
    regionRows() {
      const bt = this.bt;
      if (!bt) return [];
      return Object.keys(bt.by_region)
        .sort()
        .map((id) => ({ key: id, label: this.regionLabel(id), cells: this.modelColumns.map((m) => bt.by_region[id]?.[m]?.wis) }));
    },
    peakRows() {
      const bt = this.bt;
      if (!bt) return [];
      return bt.models
        .filter((m) => bt.peak[m])
        .map((m) => {
          const p = bt.peak[m]!;
          return { key: m, label: this.modelLabel(m), n: p.n, timing: p.median_abs_timing_weeks, height: p.mean_height_rel };
        });
    },
    tuningText(): string {
      const tn = this.tn;
      if (!tn) return '';
      return this.$t('pages.method.tuningText', {
        tuned: tn.tuned_on.join(', '),
        candidate: tn.chosen.candidate,
        k: this.num(tn.chosen.spread_factor),
      });
    },
    tuningReference(): string {
      const tn = this.tn;
      if (!tn) return '';
      return this.$t('pages.method.tuningReference', { baseline: this.num(tn.baseline_wis), persistence: this.num(tn.persistence_wis) });
    },
    candidateHeaders(): DocHeader[] {
      return [
        { label: this.$t('pages.method.tuningHead.candidate') },
        { label: this.$t('pages.method.tuningHead.groups') },
        { label: this.$t('pages.method.tuningHead.ensemble'), numeric: true },
        { label: this.$t('pages.method.tuningHead.model'), numeric: true },
        { label: this.$t('pages.method.tuningHead.n'), numeric: true },
      ];
    },
    spreadHeaders(): DocHeader[] {
      return [
        { label: this.$t('pages.method.spreadHead.k'), numeric: true },
        { label: this.$t('pages.method.spreadHead.wis'), numeric: true },
        { label: this.$t('pages.method.spreadHead.cov50'), numeric: true },
        { label: this.$t('pages.method.spreadHead.cov80'), numeric: true },
      ];
    },
  },
  methods: {
    /** Number in the locale of the page; dash when missing. */
    num(v: Cell, digits = 2): string {
      return typeof v === 'number' && Number.isFinite(v) ? formatNumber(v, this.ctx.locale, digits) : '–';
    },
    /** Percentage in the locale of the page; dash when missing. */
    pct(v: Cell, digits = 1): string {
      if (typeof v !== 'number' || !Number.isFinite(v)) return '–';
      return new Intl.NumberFormat(this.ctx.locale, { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
    },
    modelLabel(m: string): string {
      const k = MODEL_KEY[m];
      return k ? this.$t(`pages.method.modelNames.${k}`) : m;
    },
    cmpLabel(key: string): string {
      const k = CMP_KEY[key];
      return k ? this.$t(`pages.method.cmp.${k}`) : key;
    },
    regionLabel(id: string): string {
      const r = REGIONS.find((x) => x.id === id);
      return r ? (this.ctx.locale === 'de' ? r.name_de : r.name_en) : id;
    },
    groupNames(groups: string[]): string {
      return groups.map((g) => this.$t(`pages.method.groupNames.${g}`)).join(', ');
    },
    isChosen(name: string): boolean {
      return this.tn?.chosen.candidate === name;
    },
    isChosenK(k: number): boolean {
      return this.tn?.chosen.spread_factor === k;
    },
    cellWis(c: Cell): string {
      return this.num(c, 2);
    },
  },
});
</script>

<template>
  <article class="space-y-2">
    <h1 class="text-2xl font-bold">{{ $t('pages.method.heading') }}</h1>

    <section aria-labelledby="m-what">
      <h2 id="m-what" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.method.whatHeading') }}</h2>
      <p>{{ $t('pages.method.whatText') }}</p>
    </section>

    <section aria-labelledby="m-models">
      <h2 id="m-models" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.method.modelsHeading') }}</h2>
      <p>{{ $t('pages.method.modelsText') }}</p>
      <ul class="mt-2 list-disc space-y-2 pl-6">
        <li>{{ $t('pages.method.modelsList.baseline') }}</li>
        <li>{{ $t('pages.method.modelsList.persistence') }}</li>
        <li>{{ $t('pages.method.modelsList.regional') }}</li>
        <li>{{ $t('pages.method.modelsList.ensemble') }}</li>
      </ul>
      <p class="mt-3">{{ $t('pages.method.spreadText') }}</p>
    </section>

    <section aria-labelledby="m-groups">
      <h2 id="m-groups" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.method.groupsHeading') }}</h2>
      <DocTable
        :caption="$t('pages.method.groupsCaption')"
        :headers="[{ label: $t('pages.method.groupsHead.group') }, { label: $t('pages.method.groupsHead.content') }]"
        :source="$t('pages.method.groupsSource')"
      >
        <tr v-for="g in groupKeys" :key="g">
          <th scope="row">{{ $t(`pages.method.groupNames.${g}`) }}</th>
          <td>{{ $t(`pages.method.groups.${g}`) }}</td>
        </tr>
      </DocTable>
    </section>

    <section aria-labelledby="m-season">
      <h2 id="m-season" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.method.seasonHeading') }}</h2>
      <p>{{ $t('pages.method.seasonText') }}</p>
    </section>

    <section aria-labelledby="m-protocol">
      <h2 id="m-protocol" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.method.protocolHeading') }}</h2>
      <p>{{ $t('pages.method.protocolIntro') }}</p>
      <ul class="mt-2 list-disc space-y-2 pl-6">
        <li>{{ $t('pages.method.protocol.rolling') }}</li>
        <li>{{ $t('pages.method.protocol.seasons') }}</li>
        <li>{{ $t('pages.method.protocol.pandemic') }}</li>
        <li>{{ $t('pages.method.protocol.metrics') }}</li>
        <li>{{ $t('pages.method.protocol.breakdowns') }}</li>
        <li>{{ $t('pages.method.protocol.bootstrap') }}</li>
        <li>{{ $t('pages.method.protocol.peaks') }}</li>
        <li>{{ $t('pages.method.protocol.gate') }}</li>
      </ul>
    </section>

    <section aria-labelledby="m-results">
      <h2 id="m-results" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.method.resultsHeading') }}</h2>
      <template v-if="bt">
        <p>{{ $t('pages.method.resultsIntro', { season: bt.season }) }}</p>

        <DocTable :caption="$t('pages.method.overallCaption')" :headers="overallHeaders" :source="$t('pages.method.source')">
          <tr v-for="r in overallRows" :key="r.model">
            <th scope="row">{{ r.label }}</th>
            <td class="num">{{ r.n }}</td>
            <td class="num">{{ num(r.mae) }}</td>
            <td class="num">{{ num(r.wis) }}</td>
            <td class="num">{{ pct(r.c50) }}</td>
            <td class="num">{{ pct(r.c80) }}</td>
          </tr>
        </DocTable>

        <h3 class="mt-6 mb-2 text-lg font-semibold">{{ $t('pages.method.gateHeading') }}</h3>
        <p class="cf-card">{{ gateText }}</p>

        <h3 class="mt-6 mb-2 text-lg font-semibold">{{ $t('pages.method.comparisonsHeading') }}</h3>
        <DocTable :caption="$t('pages.method.comparisonsCaption')" :headers="comparisonHeaders" :source="$t('pages.method.source')">
          <tr v-for="r in comparisonRows" :key="r.key">
            <th scope="row">{{ r.label }}</th>
            <td class="num">{{ num(r.diff) }}</td>
            <td class="num">{{ pct(r.rel) }}</td>
            <td>{{ r.ci }}</td>
            <td class="num">{{ r.seasons }}</td>
            <td class="num">{{ r.n ?? '–' }}</td>
          </tr>
        </DocTable>
        <p class="cf-muted text-sm">{{ $t('pages.method.comparisonsNote') }}</p>

        <h3 class="mt-6 mb-2 text-lg font-semibold">{{ $t('pages.method.phaseHeading') }}</h3>
        <DocTable :caption="$t('pages.method.phaseCaption')" :headers="phaseHeaders" :source="$t('pages.method.source')">
          <tr v-for="r in phaseRows" :key="r.key">
            <th scope="row">{{ r.label }}</th>
            <td v-for="(c, i) in r.cells" :key="i" class="num">{{ cellWis(c) }}</td>
          </tr>
        </DocTable>

        <h3 class="mt-6 mb-2 text-lg font-semibold">{{ $t('pages.method.horizonHeading') }}</h3>
        <DocTable
          :caption="$t('pages.method.horizonCaption')"
          :headers="[{ label: $t('pages.method.horizonHead.weeks') }, ...modelColumns.map((m) => ({ label: modelLabel(m), numeric: true }))]"
          :source="$t('pages.method.source')"
        >
          <tr v-for="r in horizonRows" :key="r.key">
            <th scope="row">{{ r.label }}</th>
            <td v-for="(c, i) in r.cells" :key="i" class="num">{{ cellWis(c) }}</td>
          </tr>
        </DocTable>

        <h3 class="mt-6 mb-2 text-lg font-semibold">{{ $t('pages.method.regionHeading') }}</h3>
        <DocTable
          :caption="$t('pages.method.regionCaption')"
          :headers="[{ label: $t('pages.method.regionHead.region') }, ...modelColumns.map((m) => ({ label: modelLabel(m), numeric: true }))]"
          :source="$t('pages.method.source')"
        >
          <tr v-for="r in regionRows" :key="r.key">
            <th scope="row">{{ r.label }}</th>
            <td v-for="(c, i) in r.cells" :key="i" class="num">{{ cellWis(c) }}</td>
          </tr>
        </DocTable>

        <h3 class="mt-6 mb-2 text-lg font-semibold">{{ $t('pages.method.peakHeading') }}</h3>
        <DocTable
          :caption="$t('pages.method.peakCaption')"
          :headers="[
            { label: $t('pages.method.peakHead.model') },
            { label: $t('pages.method.peakHead.n'), numeric: true },
            { label: $t('pages.method.peakHead.timing'), numeric: true },
            { label: $t('pages.method.peakHead.height'), numeric: true },
          ]"
          :source="$t('pages.method.source')"
        >
          <tr v-for="r in peakRows" :key="r.key">
            <th scope="row">{{ r.label }}</th>
            <td class="num">{{ r.n }}</td>
            <td class="num">{{ num(r.timing, 1) }}</td>
            <td class="num">{{ pct(r.height) }}</td>
          </tr>
        </DocTable>
      </template>
      <p v-else class="cf-card cf-muted">{{ $t('pages.method.unavailableBacktest') }}</p>
    </section>

    <section aria-labelledby="m-tuning">
      <h2 id="m-tuning" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.method.tuningHeading') }}</h2>
      <template v-if="tn">
        <p>{{ tuningText }}</p>
        <p class="mt-2">{{ tuningReference }}</p>

        <DocTable :caption="$t('pages.method.tuningCaption')" :headers="candidateHeaders" :source="$t('pages.method.source')">
          <tr v-for="c in tn.candidates" :key="c.name">
            <th scope="row">
              {{ c.name }}
              <span v-if="isChosen(c.name)" class="font-normal">({{ $t('pages.method.tuningChosen') }})</span>
            </th>
            <td>{{ groupNames(c.groups) }}</td>
            <td class="num">{{ num(c.wis_ensemble) }}</td>
            <td class="num">{{ num(c.wis_model) }}</td>
            <td class="num">{{ c.n }}</td>
          </tr>
        </DocTable>

        <DocTable :caption="$t('pages.method.spreadCaption')" :headers="spreadHeaders" :source="$t('pages.method.source')">
          <tr v-for="s in tn.spread_grid" :key="s.k">
            <th scope="row">
              {{ num(s.k) }}
              <span v-if="isChosenK(s.k)" class="font-normal">({{ $t('pages.method.tuningChosen') }})</span>
            </th>
            <td class="num">{{ num(s.wis) }}</td>
            <td class="num">{{ pct(s.coverage50) }}</td>
            <td class="num">{{ pct(s.coverage80) }}</td>
          </tr>
        </DocTable>
      </template>
      <p v-else class="cf-card cf-muted">{{ $t('pages.method.unavailableTuning') }}</p>
    </section>

    <section aria-labelledby="m-limits">
      <h2 id="m-limits" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.method.limitsHeading') }}</h2>
      <ul class="list-disc space-y-2 pl-6">
        <li>{{ $t('pages.method.limits.seasons') }}</li>
        <li>{{ $t('pages.method.limits.vintage') }}</li>
        <li>{{ $t('pages.method.limits.external') }}</li>
        <li>{{ $t('pages.method.limits.start') }}</li>
        <li>{{ $t('pages.method.limits.scope') }}</li>
      </ul>
    </section>
  </article>
</template>
