<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { ACTIVITY_THRESHOLDS, REGIONS } from '@coldfront/forecast-core';
import { formatDate, formatNumber } from '../api';
import DocCode from '../components/DocCode.vue';
import DocTable, { type DocHeader } from '../components/DocTable.vue';
import { API_BASE } from '../site-config';
import type { PageContext } from '../types';

/** Rows of the endpoint table: message key, file path, and the link target (regions use Germany as example). */
const ENDPOINTS: { key: string; file: string; href: string }[] = [
  { key: 'index', file: 'index.json', href: 'index.json' },
  { key: 'regions', file: 'regions/<id>.json', href: 'regions/de.json' },
  { key: 'series', file: 'series.json', href: 'series.json' },
  { key: 'backtestTest', file: 'backtest/test.json', href: 'backtest/test.json' },
  { key: 'backtestTuning', file: 'backtest/tuning.json', href: 'backtest/tuning.json' },
  { key: 'backtestEvaluation', file: 'backtest/evaluation.json', href: 'backtest/evaluation.json' },
  { key: 'backtestModel', file: 'backtest/model.json', href: 'backtest/model.json' },
  { key: 'geoLaender', file: 'geo/laender.topo.json', href: 'geo/laender.topo.json' },
  { key: 'geoPlz', file: 'geo/plz.json', href: 'geo/plz.json' },
  { key: 'wastewater', file: 'wastewater-sites.json', href: 'wastewater-sites.json' },
  { key: 'sources', file: 'sources.json', href: 'sources.json' },
  { key: 'archive', file: 'archive/<date>.json.gz', href: '' },
  { key: 'holidays', file: 'holidays/<year>.json', href: 'holidays/2026.json' },
];

/** ForecastFile fields with their TypeScript type and the message key of their meaning. */
const FIELDS: { field: string; type: string; key: string }[] = [
  { field: 'schema_version', type: 'number', key: 'schema_version' },
  { field: 'region', type: 'string', key: 'region' },
  { field: 'level', type: 'string', key: 'level' },
  { field: 'indicator', type: 'string', key: 'indicator' },
  { field: 'unit', type: 'string', key: 'unit' },
  { field: 'issued', type: 'string (YYYY-MM-DD)', key: 'issued' },
  { field: 'data_version', type: 'string (YYYY-MM-DD)', key: 'data_version' },
  { field: 'last_observed_week', type: 'string (ISO-Woche)', key: 'last_observed_week' },
  { field: 'model', type: 'string', key: 'model' },
  { field: 'gate', type: '{ shipped, reason }', key: 'gate' },
  { field: 'sources', type: 'string[]', key: 'sources' },
  { field: 'attribution', type: 'string', key: 'attribution' },
  { field: 'observed', type: '{ iso_week, value }[]', key: 'observed' },
  { field: 'normal', type: '{ week_number, q10 … q90 }[]', key: 'normal' },
  { field: 'horizons', type: 'ForecastHorizon[]', key: 'horizons' },
  { field: 'horizons[].h', type: '1 | 2 | 3 | 4', key: 'hz_h' },
  { field: 'horizons[].iso_week', type: 'string (ISO-Woche)', key: 'hz_iso_week' },
  { field: 'horizons[].q10 … q90', type: 'number', key: 'hz_quantiles' },
  { field: 'horizons[].index', type: 'number', key: 'hz_index' },
  { field: 'horizons[].level', type: 'normal | elevated | high', key: 'hz_level' },
];

export default defineComponent({
  name: 'ApiPage',
  components: { DocCode, DocTable },
  props: { ctx: { type: Object as PropType<PageContext>, required: true } },
  computed: {
    apiBase(): string {
      return API_BASE;
    },
    currentLine(): string {
      const idx = this.ctx.data.index;
      if (!idx) return '';
      return this.$t('pages.api.currentLine', {
        dataVersion: formatDate(idx.data_version, this.ctx.locale),
        issued: formatDate(idx.issued, this.ctx.locale),
        model: idx.model,
        regions: idx.regions.length,
      });
    },
    levelsText(): string {
      return this.$t('pages.api.levelsText', {
        elevated: formatNumber(ACTIVITY_THRESHOLDS.elevated, this.ctx.locale, 2),
        high: formatNumber(ACTIVITY_THRESHOLDS.high, this.ctx.locale, 2),
      });
    },
    endpointHeaders(): DocHeader[] {
      return [
        { label: this.$t('pages.api.endpointsHead.file') },
        { label: this.$t('pages.api.endpointsHead.purpose') },
        { label: this.$t('pages.api.endpointsHead.update') },
        { label: this.$t('pages.api.endpointsHead.size') },
      ];
    },
    regionHeaders(): DocHeader[] {
      return [
        { label: this.$t('pages.api.regionsHead.id') },
        { label: this.$t('pages.api.regionsHead.name') },
        { label: this.$t('pages.api.regionsHead.file') },
      ];
    },
    fieldHeaders(): DocHeader[] {
      return [
        { label: this.$t('pages.api.fieldsHead.field') },
        { label: this.$t('pages.api.fieldsHead.type') },
        { label: this.$t('pages.api.fieldsHead.meaning') },
      ];
    },
    endpoints() {
      return ENDPOINTS;
    },
    fields() {
      return FIELDS;
    },
    regions() {
      return REGIONS.map((r) => ({
        id: r.id,
        name: this.ctx.locale === 'de' ? r.name_de : r.name_en,
        href: `${API_BASE}regions/${r.id}.json`,
      }));
    },
    curlIndex(): string {
      return `curl -s "${API_BASE}index.json"`;
    },
    fetchRegion(): string {
      return [
        `const res = await fetch("${API_BASE}regions/de-sn.json");`,
        'if (!res.ok) throw new Error(`HTTP ${res.status}`);',
        'const forecast = await res.json();',
        'for (const h of forecast.horizons) {',
        '  console.log(h.iso_week, h.q25, h.q50, h.q75);',
        '}',
      ].join('\n');
    },
    horizonExample(): string {
      return JSON.stringify(
        { h: 1, iso_week: 'YYYY-Www', q10: 0, q25: 0, q50: 0, q75: 0, q90: 0, index: 0, level: 'normal' },
        null,
        2,
      );
    },
  },
});
</script>

<template>
  <article class="space-y-2">
    <h1 class="text-2xl font-bold">{{ $t('pages.api.heading') }}</h1>
    <p>{{ $t('pages.api.intro') }}</p>

    <section aria-labelledby="api-base">
      <h2 id="api-base" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.api.baseHeading') }}</h2>
      <DocCode :label="$t('pages.api.baseHeading')" :code="apiBase" />
    </section>

    <section aria-labelledby="api-current">
      <h2 id="api-current" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.api.currentHeading') }}</h2>
      <p v-if="ctx.data.index" class="cf-card">{{ currentLine }}</p>
      <p v-else class="cf-card cf-muted">{{ $t('pages.api.currentFallback') }}</p>
    </section>

    <section aria-labelledby="api-files">
      <h2 id="api-files" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.api.endpointsHeading') }}</h2>
      <DocTable :caption="$t('pages.api.endpointsCaption')" :headers="endpointHeaders" :source="$t('pages.api.endpointsSource')">
        <tr v-for="e in endpoints" :key="e.key">
          <th scope="row" class="whitespace-nowrap font-mono text-xs">
            <a v-if="e.href" :href="`${apiBase}${e.href}`" class="underline">{{ e.file }}</a>
            <template v-else>{{ e.file }}</template>
          </th>
          <td>{{ $t(`pages.api.endpoints.${e.key}.purpose`) }}</td>
          <td>{{ $t(`pages.api.endpoints.${e.key}.update`) }}</td>
          <td>{{ $t(`pages.api.endpoints.${e.key}.size`) }}</td>
        </tr>
      </DocTable>
    </section>

    <section aria-labelledby="api-regions">
      <h2 id="api-regions" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.api.regionsHeading') }}</h2>
      <DocTable :caption="$t('pages.api.regionsCaption')" :headers="regionHeaders" :source="$t('pages.api.regionsSource')">
        <tr v-for="r in regions" :key="r.id">
          <th scope="row" class="font-mono text-xs">{{ r.id }}</th>
          <td>{{ r.name }}</td>
          <td>
            <a :href="r.href" class="underline font-mono text-xs">regions/{{ r.id }}.json</a>
          </td>
        </tr>
      </DocTable>
    </section>

    <section aria-labelledby="api-fields">
      <h2 id="api-fields" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.api.fieldsHeading') }}</h2>
      <p>{{ $t('pages.api.fieldsText') }}</p>
      <DocTable :caption="$t('pages.api.fieldsCaption')" :headers="fieldHeaders" :source="$t('pages.api.fieldsSource')">
        <tr v-for="f in fields" :key="f.field">
          <th scope="row" class="whitespace-nowrap font-mono text-xs">{{ f.field }}</th>
          <td class="font-mono text-xs">{{ f.type }}</td>
          <td>{{ $t(`pages.api.fields.${f.key}`) }}</td>
        </tr>
      </DocTable>
    </section>

    <section aria-labelledby="api-quantiles">
      <h2 id="api-quantiles" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.api.quantilesHeading') }}</h2>
      <p>{{ $t('pages.api.quantilesText') }}</p>
    </section>

    <section aria-labelledby="api-levels">
      <h2 id="api-levels" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.api.levelsHeading') }}</h2>
      <p>{{ levelsText }}</p>
    </section>

    <section aria-labelledby="api-examples">
      <h2 id="api-examples" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.api.examplesHeading') }}</h2>
      <DocCode :label="$t('pages.api.curlLabel')" :code="curlIndex" />
      <DocCode :label="$t('pages.api.fetchLabel')" :code="fetchRegion" />
      <DocCode :label="$t('pages.api.horizonLabel')" :code="horizonExample" />
    </section>

    <section aria-labelledby="api-cors">
      <h2 id="api-cors" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.api.corsHeading') }}</h2>
      <p>{{ $t('pages.api.corsText') }}</p>
    </section>

    <section aria-labelledby="api-version">
      <h2 id="api-version" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.api.versionHeading') }}</h2>
      <p>{{ $t('pages.api.versionText') }}</p>
    </section>

    <section aria-labelledby="api-reuse">
      <h2 id="api-reuse" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.api.reuseHeading') }}</h2>
      <p>{{ $t('pages.api.reuseText') }}</p>
      <blockquote class="cf-card mt-3 break-words">{{ $t('pages.api.attributionText') }}</blockquote>
    </section>
  </article>
</template>
