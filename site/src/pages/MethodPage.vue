<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { REGIONS, type MetricSummary } from '@coldfront/forecast-core';
import { formatNumber } from '../api';
import DocTable, { type DocHeader } from '../components/DocTable.vue';
import type { PageContext } from '../types';

/** Model names in the published files mapped to message keys (pages.method.modelNames.*). */
const MODEL_KEY: Record<string, string> = {
  'baseline-seasonal': 'baseline',
  'baseline-plain': 'baselinePlain',
  persistence: 'persistence',
  'regional-model': 'regional',
  ensemble: 'ensemble',
};
/** Comparison keys of the published files mapped to message keys (pages.method.cmp.*). */
const CMP_KEY: Record<string, string> = {
  'ensemble vs baseline-seasonal': 'ensembleBaseline',
  'ensemble vs baseline-plain': 'ensembleBaselinePlain',
  'ensemble vs persistence': 'ensemblePersistence',
  'regional-model vs baseline-seasonal': 'regionalBaseline',
};
const EXTERNAL_PREFIX = 'respinow:';
const PHASES = ['low', 'rise', 'peak', 'decline'] as const;
const GROUPS = ['dynamics', 'season', 'holiday', 'weather', 'wastewater'] as const;
const HORIZONS = ['h1', 'h2', 'h3', 'h4'] as const;
/** Below this relative gain the national ensemble counts as "about equal" to the baseline (display wording only). */
const EQUAL_BAND = 0.05;

type Cell = number | null | undefined;
/** Live-monitor summary (forecasts/backtest/live.json); optional page data, not part of the typed PageData. */
interface LiveData {
  evaluated_runs: number;
  min_runs: number;
  fallback: boolean;
}

export default defineComponent({
  name: 'MethodPage',
  components: { DocTable },
  props: { ctx: { type: Object as PropType<PageContext>, required: true } },
  computed: {
    bt() {
      return this.ctx.data.backtest;
    },
    bt1() {
      return this.ctx.data.backtestV1;
    },
    tn() {
      return this.ctx.data.tuning;
    },
    vt() {
      return this.ctx.data.vintage;
    },
    ext() {
      return this.ctx.data.external;
    },
    live(): LiveData | null {
      const l = (this.ctx.data as unknown as { live?: LiveData | null }).live;
      return l && typeof l.evaluated_runs === 'number' && typeof l.min_runs === 'number' ? l : null;
    },
    groupKeys() {
      return GROUPS;
    },
    horizonKeys() {
      return HORIZONS;
    },
    resultsIntro(): string {
      const bt = this.bt;
      if (!bt) return '';
      return this.$t('pages.method.resultsIntro', {
        season: bt.season,
        n: formatNumber(bt.overall['ensemble']?.n ?? 0, this.ctx.locale, 0),
        candidate: bt.model_choice.candidate,
        weight: this.num(bt.model_choice.model_weight),
        k: this.num(bt.model_choice.spread_factor),
      });
    },
    versionsHeaders(): DocHeader[] {
      const h = (k: string) => ({ label: this.$t(`pages.method.versionsHead.${k}`), numeric: true });
      return [{ label: this.$t('pages.method.versionsHead.model') }, h('wis1'), h('wis2'), h('mae1'), h('mae2'), h('c501'), h('c502'), h('c801'), h('c802')];
    },
    /** One row per model: v1 (first protocol) next to v2. The v1 baseline is the plain baseline of v2. */
    versionsRows() {
      const bt = this.bt;
      if (!bt) return [];
      const v1 = this.bt1;
      return bt.models
        .filter((m) => bt.overall[m])
        .map((m) => {
          const a = v1 ? v1.overall[m === 'baseline-plain' ? 'baseline-seasonal' : m === 'baseline-seasonal' ? '' : m] : undefined;
          const b = bt.overall[m] as MetricSummary;
          return { model: m, label: this.modelLabel(m), a, b };
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
      return Object.keys(bt.comparisons).map((key) => this.comparisonRow(key, bt.comparisons[key], this.cmpLabel(key)));
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
    /** Germany first (highlighted), then the federal states alphabetically; gain = 1 - WIS(ensemble) / WIS(baseline). */
    regionRows() {
      const bt = this.bt;
      if (!bt) return [];
      const ids = Object.keys(bt.by_region);
      const label = (id: string) => this.regionLabel(id);
      const sorted = [...ids.filter((i) => i === 'de'), ...ids.filter((i) => i !== 'de').sort((a, b) => label(a).localeCompare(label(b), this.ctx.locale))];
      return sorted.map((id) => {
        const r = bt.by_region[id]!;
        const base = r['baseline-seasonal']?.wis;
        const ens = r['ensemble']?.wis;
        const gain = typeof base === 'number' && typeof ens === 'number' && base > 0 ? 1 - ens / base : null;
        return { key: id, national: id === 'de', label: label(id), cells: this.modelColumns.map((m) => r[m]?.wis), gain };
      });
    },
    regionSummary(): string {
      const rows = this.regionRows;
      const nat = rows.find((r) => r.national);
      const states = rows.filter((r) => !r.national && r.gain !== null).map((r) => r.gain as number);
      if (!nat || nat.gain === null || states.length === 0) return '';
      if (Math.abs(nat.gain) < EQUAL_BAND) return this.$t('pages.method.regionSummaryEqual');
      return this.$t('pages.method.regionSummary', { nat: this.pct(nat.gain), min: this.pct(Math.min(...states)), max: this.pct(Math.max(...states)) });
    },
    peakRows() {
      const bt = this.bt;
      if (!bt) return [];
      return bt.models
        .filter((m) => bt.peak[m])
        .map((m) => {
          const p = bt.peak[m]!;
          return { key: m, label: this.modelLabel(m), n: p.n, timing: p.median_abs_timing_weeks, within: p.within_one_week_share, ambiguous: p.ambiguous, height: p.mean_height_rel, byHorizon: p.by_horizon };
        });
    },
    peakHorizonHeaders(): DocHeader[] {
      return [
        { label: this.$t('pages.method.peakHead.model') },
        ...HORIZONS.map((h) => ({ label: this.$t('pages.method.horizonHead.weeks') + ' ' + h.slice(1), numeric: true })),
      ];
    },
    /** Plain-language statement about the ensemble, read from the per-horizon numbers (null if the v2 structure is missing). */
    peakHonest(): string {
      const e = this.bt?.peak['ensemble']?.by_horizon;
      if (!e || !e['h1']) return '';
      const later = (['h2', 'h3', 'h4'] as const).map((h) => e[h]?.median_abs_timing_weeks).filter((v): v is number => typeof v === 'number');
      if (later.length === 0) return '';
      return this.$t('pages.method.peakHonest', {
        share1: this.pct(e['h1'].within_one_week_share, 0),
        med1: this.num(e['h1'].median_abs_timing_weeks, 1),
        lo: this.num(Math.min(...later), 0),
        hi: this.num(Math.max(...later), 0),
      });
    },
    tuningText(): string {
      const tn = this.tn;
      if (!tn) return '';
      return this.$t('pages.method.tuningText', {
        tuned: tn.tuned_on.join(', '),
        candidate: tn.chosen.candidate,
        weight: this.num(tn.chosen.model_weight),
        k: this.num(tn.chosen.spread_factor),
      });
    },
    tuningReference(): string {
      const tn = this.tn;
      if (!tn) return '';
      return this.$t('pages.method.tuningReference', {
        baseline: this.num(tn.baseline_wis),
        plain: this.num(tn.baseline_plain_wis),
        persistence: this.num(tn.persistence_wis),
      });
    },
    candidateHeaders(): DocHeader[] {
      return [
        { label: this.$t('pages.method.tuningHead.candidate') },
        { label: this.$t('pages.method.tuningHead.groups') },
        { label: this.$t('pages.method.tuningHead.weight'), numeric: true },
        { label: this.$t('pages.method.tuningHead.k'), numeric: true },
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
    vintageHeaders(): DocHeader[] {
      return [
        { label: this.$t('pages.method.vintageHead.model') },
        { label: this.$t('pages.method.vintageHead.final'), numeric: true },
        { label: this.$t('pages.method.vintageHead.vintage'), numeric: true },
        { label: this.$t('pages.method.vintageHead.rel'), numeric: true },
        { label: this.$t('pages.method.vintageHead.n'), numeric: true },
      ];
    },
    /** One group per entry of vintage.seasons, models in the order of the main evaluation. */
    vintageGroups() {
      const vt = this.vt;
      if (!vt) return [];
      const order = this.bt?.models ?? [];
      return Object.keys(vt.seasons).map((key) => {
        const g = vt.seasons[key]!;
        const names = Object.keys(g.models).sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
        return {
          key,
          title: this.$t('pages.method.vintageGroup', {
            seasons: g.seasons && g.seasons.length ? g.seasons.join(', ') : key,
            vintage: g.origins_vintage,
            total: g.origins_total,
            fallback: g.origins_fallback,
          }),
          rows: names.map((m) => ({ model: m, label: this.modelLabel(m), final: g.models[m]!.final.wis, vintage: g.models[m]!.vintage.wis, rel: g.models[m]!.rel_degradation, n: g.n_cells })),
        };
      });
    },
    extPanel() {
      return this.ext?.panels['core'] ?? null;
    },
    externalIntro(): string {
      const e = this.ext;
      if (!e) return '';
      return this.$t('pages.method.externalIntro', { name: e.source.name, ratio: this.num(e.unit_ratio.ratio, 1) });
    },
    externalRows() {
      const p = this.extPanel;
      if (!p) return [];
      return p.models
        .filter((m) => p.overall[m])
        .map((m) => {
          const s = p.overall[m] as MetricSummary;
          return { model: m, label: this.modelLabel(m), external: m.startsWith(EXTERNAL_PREFIX), n: s.n, mae: s.mae, wis: s.wis, c50: s.coverage50, c80: s.coverage80 };
        });
    },
    externalCmpRows() {
      const p = this.extPanel;
      if (!p) return [];
      return Object.keys(p.comparisons)
        .filter((k) => k.startsWith(`ensemble vs ${EXTERNAL_PREFIX}`))
        .map((k) => this.comparisonRow(k, p.comparisons[k], this.$t('pages.method.externalCmpPair', { name: this.modelLabel(k.slice('ensemble vs '.length)) })));
    },
    externalCells(): string {
      const p = this.extPanel;
      if (!p) return '';
      const cells = Object.keys(p.cells_by_season)
        .sort()
        .map((s) => `${s}: ${formatNumber(p.cells_by_season[s]!, this.ctx.locale, 0)}`)
        .join('; ');
      return (
        this.$t('pages.method.externalCells', { cells }) +
        ' ' +
        this.$t('pages.method.externalCellsOf', { n: formatNumber(p.n_cells, this.ctx.locale, 0), origins: formatNumber(p.n_origins, this.ctx.locale, 0) })
      );
    },
    externalCiCount(): string {
      const p = this.extPanel;
      if (!p) return '';
      const cs = this.externalCmpRows.map((r) => r.zero);
      return this.$t('pages.method.externalCiCount', {
        zero: formatNumber(cs.filter(Boolean).length, this.ctx.locale, 0),
        total: formatNumber(cs.length, this.ctx.locale, 0),
      });
    },
    externalSourceLine(): string {
      const e = this.ext;
      return e ? this.$t('pages.method.externalSource', { name: e.source.name, license: e.source.license }) : '';
    },
    externalAttribution(): string {
      const e = this.ext;
      return e ? this.$t('pages.method.externalAttribution', { attribution: e.source.attribution }) : '';
    },
    liveText(): string {
      const l = this.live;
      if (!l) return this.$t('pages.method.liveTextShort');
      return this.$t('pages.method.liveText', { min: formatNumber(l.min_runs, this.ctx.locale, 0), runs: formatNumber(l.evaluated_runs, this.ctx.locale, 0) });
    },
    noticeText(): string {
      return this.$t('pages.method.noticeText', { season: this.bt ? this.bt.season : '2025/26' });
    },
    versionsCaption(): string {
      return this.$t('pages.method.versionsCaption', { season: this.bt ? this.bt.season : '' });
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
    /** Signed percentage ("+3.1 %"); the sign is part of the text, so colour is never the only signal. */
    spct(v: Cell, digits = 1): string {
      if (typeof v !== 'number' || !Number.isFinite(v)) return '–';
      return new Intl.NumberFormat(this.ctx.locale, { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay: 'exceptZero' }).format(v);
    },
    comparisonRow(key: string, c: { meanDiff: number; relImprovement: number; ci95: [number, number]; seasonsBetter: number; seasonsTotal: number; n: number } | null | undefined, label: string) {
      return {
        key,
        label,
        diff: c ? c.meanDiff : null,
        rel: c ? c.relImprovement : null,
        ci: c ? this.$t('pages.method.ciFormat', { lo: this.num(c.ci95[0]), hi: this.num(c.ci95[1]) }) : '–',
        seasons: c ? this.$t('pages.method.seasonsOf', { won: c.seasonsBetter, total: c.seasonsTotal }) : '–',
        n: c ? c.n : null,
        zero: c ? c.ci95[0] <= 0 && c.ci95[1] >= 0 : false,
      };
    },
    modelLabel(m: string): string {
      if (m.startsWith(EXTERNAL_PREFIX)) return `${m.slice(EXTERNAL_PREFIX.length)} (${this.$t('pages.method.external')})`;
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
    horizonCell(by: Record<string, { median_abs_timing_weeks: number; within_one_week_share: number }> | undefined, h: string, what: 'median' | 'share'): string {
      const x = by?.[h];
      if (!x) return '–';
      return what === 'median' ? this.num(x.median_abs_timing_weeks, 1) : this.pct(x.within_one_week_share, 0);
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
        <li>{{ $t('pages.method.modelsList.baselinePlain') }}</li>
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

      <h3 id="m-amendment" class="mt-6 mb-2 scroll-mt-4 text-lg font-semibold">{{ $t('pages.method.amendmentHeading') }}</h3>
      <p>{{ $t('pages.method.amendmentWhy') }}</p>
      <ul class="mt-2 list-disc space-y-2 pl-6">
        <li>{{ $t('pages.method.amendment.calendar') }}</li>
        <li>{{ $t('pages.method.amendment.lags') }}</li>
        <li>{{ $t('pages.method.amendment.joint') }}</li>
        <li>{{ $t('pages.method.amendment.peak') }}</li>
        <li>{{ $t('pages.method.amendment.reference') }}</li>
        <li>{{ $t('pages.method.amendment.vacation') }}</li>
      </ul>
      <p class="mt-3">{{ $t('pages.method.amendmentStatus') }}</p>
    </section>

    <section aria-labelledby="m-results">
      <h2 id="m-results" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.method.resultsHeading') }}</h2>
      <aside class="cf-card cf-notice" role="note" aria-labelledby="m-notice-title" data-test="notice">
        <p id="m-notice-title" class="font-semibold">{{ $t('pages.method.noticeTitle') }}</p>
        <p class="mt-1">{{ noticeText }}</p>
      </aside>
      <template v-if="bt">
        <p class="mt-3">{{ resultsIntro }}</p>

        <h3 class="mt-6 mb-2 text-lg font-semibold">{{ $t('pages.method.versionsHeading') }}</h3>
        <DocTable :caption="versionsCaption" :headers="versionsHeaders" :source="$t('pages.method.source')">
          <tr v-for="r in versionsRows" :key="r.model">
            <th scope="row">{{ r.label }}</th>
            <td class="num">{{ num(r.a?.wis) }}</td>
            <td class="num">{{ num(r.b.wis) }}</td>
            <td class="num">{{ num(r.a?.mae) }}</td>
            <td class="num">{{ num(r.b.mae) }}</td>
            <td class="num">{{ pct(r.a?.coverage50) }}</td>
            <td class="num">{{ pct(r.b.coverage50) }}</td>
            <td class="num">{{ pct(r.a?.coverage80) }}</td>
            <td class="num">{{ pct(r.b.coverage80) }}</td>
          </tr>
        </DocTable>
        <p class="cf-muted text-sm">{{ $t('pages.method.versionsNote') }}</p>

        <h3 class="mt-6 mb-2 text-lg font-semibold">{{ $t('pages.method.gateHeading') }}</h3>
        <p class="cf-card" data-test="gate">{{ gateText }}</p>
        <p class="cf-muted mt-2 text-sm">{{ $t('pages.method.gateScope') }}</p>

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
        <p v-if="regionSummary" data-test="region-summary">{{ regionSummary }}</p>
        <DocTable
          :caption="$t('pages.method.regionCaption')"
          :headers="[
            { label: $t('pages.method.regionHead.region') },
            ...modelColumns.map((m) => ({ label: modelLabel(m), numeric: true })),
            { label: $t('pages.method.regionHead.gain'), numeric: true },
          ]"
          :source="$t('pages.method.source')"
        >
          <tr v-for="r in regionRows" :key="r.key" :class="{ 'cf-row-national': r.national }">
            <th scope="row">
              {{ r.label }}
              <span v-if="r.national" class="font-normal">({{ $t('pages.method.nationalTag') }})</span>
            </th>
            <td v-for="(c, i) in r.cells" :key="i" class="num" :class="{ 'font-semibold': r.national }">{{ cellWis(c) }}</td>
            <td class="num" :class="{ 'font-semibold': r.national }">{{ spct(r.gain) }}</td>
          </tr>
        </DocTable>
        <p class="cf-muted text-sm">{{ $t('pages.method.regionNote') }}</p>

        <h3 class="mt-6 mb-2 text-lg font-semibold">{{ $t('pages.method.peakHeading') }}</h3>
        <p>{{ $t('pages.method.peakDefinition') }}</p>
        <p class="mt-2">{{ $t('pages.method.peakReference') }}</p>
        <p v-if="peakHonest" class="cf-card mt-3" data-test="peak-honest">{{ peakHonest }}</p>
        <p class="cf-muted mt-2 text-sm">{{ $t('pages.method.peakOld') }}</p>
        <DocTable
          :caption="$t('pages.method.peakCaption')"
          :headers="[
            { label: $t('pages.method.peakHead.model') },
            { label: $t('pages.method.peakHead.n'), numeric: true },
            { label: $t('pages.method.peakHead.timing'), numeric: true },
            { label: $t('pages.method.peakHead.within'), numeric: true },
            { label: $t('pages.method.peakHead.ambiguous'), numeric: true },
            { label: $t('pages.method.peakHead.height'), numeric: true },
          ]"
          :source="$t('pages.method.source')"
        >
          <tr v-for="r in peakRows" :key="r.key">
            <th scope="row">{{ r.label }}</th>
            <td class="num">{{ r.n }}</td>
            <td class="num">{{ num(r.timing, 1) }}</td>
            <td class="num">{{ pct(r.within, 0) }}</td>
            <td class="num">{{ r.ambiguous ?? '–' }}</td>
            <td class="num">{{ pct(r.height) }}</td>
          </tr>
        </DocTable>
        <p class="cf-muted text-sm">{{ $t('pages.method.peakAmbiguousNote') }}</p>
        <DocTable :caption="$t('pages.method.peakTimingCaption')" :headers="peakHorizonHeaders" :source="$t('pages.method.source')">
          <tr v-for="r in peakRows" :key="r.key">
            <th scope="row">{{ r.label }}</th>
            <td v-for="h in horizonKeys" :key="h" class="num">{{ horizonCell(r.byHorizon, h, 'median') }}</td>
          </tr>
        </DocTable>
        <DocTable :caption="$t('pages.method.peakWithinCaption')" :headers="peakHorizonHeaders" :source="$t('pages.method.source')">
          <tr v-for="r in peakRows" :key="r.key">
            <th scope="row">{{ r.label }}</th>
            <td v-for="h in horizonKeys" :key="h" class="num">{{ horizonCell(r.byHorizon, h, 'share') }}</td>
          </tr>
        </DocTable>
      </template>
      <p v-else class="cf-card cf-muted mt-3">{{ $t('pages.method.unavailableBacktest') }}</p>
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
            <td class="num">{{ num(c.model_weight) }}</td>
            <td class="num">{{ num(c.spread_factor) }}</td>
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

    <section aria-labelledby="m-vintage">
      <h2 id="m-vintage" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.method.vintageHeading') }}</h2>
      <p>{{ $t('pages.method.vintageIntro') }}</p>
      <template v-if="vt">
        <DocTable :caption="$t('pages.method.vintageCaption')" :headers="vintageHeaders" :source="$t('pages.method.source')">
          <template v-for="g in vintageGroups" :key="g.key">
            <tr>
              <th scope="rowgroup" colspan="5" class="cf-row-group">{{ g.title }}</th>
            </tr>
            <tr v-for="r in g.rows" :key="g.key + r.model">
              <th scope="row">{{ r.label }}</th>
              <td class="num">{{ num(r.final) }}</td>
              <td class="num">{{ num(r.vintage) }}</td>
              <td class="num">{{ spct(r.rel) }}</td>
              <td class="num">{{ r.n }}</td>
            </tr>
          </template>
        </DocTable>
        <p class="cf-muted text-sm">{{ $t('pages.method.vintageNote') }}</p>
      </template>
      <p v-else class="cf-card cf-muted mt-3">{{ $t('pages.method.vintageUnavailable') }}</p>
    </section>

    <section aria-labelledby="m-external">
      <h2 id="m-external" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.method.externalHeading') }}</h2>
      <template v-if="ext && extPanel">
        <p>{{ externalIntro }}</p>
        <p class="mt-2">{{ $t('pages.method.externalRespicast') }}</p>

        <DocTable
          :caption="$t('pages.method.externalOverallCaption')"
          :headers="[
            { label: $t('pages.method.overallHead.model') },
            { label: $t('pages.method.overallHead.n'), numeric: true },
            { label: $t('pages.method.overallHead.mae'), numeric: true },
            { label: $t('pages.method.overallHead.wis'), numeric: true },
            { label: $t('pages.method.overallHead.cov50'), numeric: true },
            { label: $t('pages.method.overallHead.cov80'), numeric: true },
          ]"
          :source="externalSourceLine"
        >
          <tr v-for="r in externalRows" :key="r.model">
            <th scope="row">{{ r.label }}</th>
            <td class="num">{{ r.n }}</td>
            <td class="num">{{ num(r.mae) }}</td>
            <td class="num">{{ num(r.wis) }}</td>
            <td class="num">{{ pct(r.c50) }}</td>
            <td class="num">{{ pct(r.c80) }}</td>
          </tr>
        </DocTable>
        <p class="cf-muted text-sm">{{ externalCells }}</p>

        <DocTable :caption="$t('pages.method.externalCmpCaption')" :headers="comparisonHeaders" :source="externalSourceLine">
          <tr v-for="r in externalCmpRows" :key="r.key">
            <th scope="row">{{ r.label }}</th>
            <td class="num">{{ num(r.diff) }}</td>
            <td class="num">{{ pct(r.rel) }}</td>
            <td>{{ r.ci }}</td>
            <td class="num">{{ r.seasons }}</td>
            <td class="num">{{ r.n ?? '–' }}</td>
          </tr>
        </DocTable>
        <p>{{ externalCiCount }}</p>
        <p class="cf-muted mt-1 text-sm" data-test="external-attribution">
          {{ externalAttribution }}
          <a :href="ext.source.url" rel="noopener">{{ ext.source.name }}</a>,
          {{ $t('pages.method.externalLicense') }}
          <a :href="ext.source.license_url" rel="noopener">{{ ext.source.license }}</a>.
        </p>

        <h3 class="mt-6 mb-2 text-lg font-semibold">{{ $t('pages.method.externalCaveatsHeading') }}</h3>
        <ul class="list-disc space-y-2 pl-6">
          <li>{{ $t('pages.method.externalCaveats.vintage') }}</li>
          <li>{{ $t('pages.method.externalCaveats.insample') }}</li>
          <li>{{ $t('pages.method.externalCaveats.wis') }}</li>
          <li>{{ $t('pages.method.externalCaveats.small') }}</li>
        </ul>
      </template>
      <p v-else class="cf-card cf-muted">{{ $t('pages.method.externalUnavailable') }}</p>
    </section>

    <section aria-labelledby="m-live">
      <h2 id="m-live" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.method.liveHeading') }}</h2>
      <p>{{ liveText }}</p>
    </section>

    <section aria-labelledby="m-limits">
      <h2 id="m-limits" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.method.limitsHeading') }}</h2>
      <ul class="list-disc space-y-2 pl-6">
        <li>{{ $t('pages.method.limits.seasons') }}</li>
        <li>{{ $t('pages.method.limits.vintage') }}</li>
        <li>{{ $t('pages.method.limits.external') }}</li>
        <li>{{ $t('pages.method.limits.peak') }}</li>
        <li>{{ $t('pages.method.limits.start') }}</li>
        <li>{{ $t('pages.method.limits.scope') }}</li>
      </ul>
    </section>
  </article>
</template>

<style scoped>
/* Notice about the amended protocol: a thick accent edge in addition to the heading text. */
.cf-notice {
  border-left: 5px solid var(--cf-accent);
}
/* Germany row of the state table and group rows of the data-version table (rows live in DocTable's slot). */
:deep(.cf-row-national th),
:deep(.cf-row-national td) {
  background: color-mix(in srgb, var(--cf-border) 35%, transparent);
}
:deep(.cf-row-group) {
  font-weight: 600;
  font-size: 0.8125rem;
  background: color-mix(in srgb, var(--cf-border) 35%, transparent);
}
</style>
