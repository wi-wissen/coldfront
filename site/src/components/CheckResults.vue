<template>
  <section class="mt-6 space-y-6" :aria-labelledby="'check-result-title'">
    <div>
      <h2 id="check-result-title" class="text-lg font-semibold">{{ $t('pages.check.result.heading') }}</h2>
      <p class="text-sm cf-muted">
        {{ $t('pages.check.result.summary', { region: regionName, season: result.season, horizon: horizonLabel }) }}
        · {{ $t('pages.check.result.scored', { n: result.metrics[ensembleName]?.n ?? 0 }) }}
      </p>
      <p class="text-sm cf-muted">{{ $t('pages.check.result.computeTime', { seconds: seconds }) }}</p>
    </div>

    <figure class="cf-card m-0">
      <figcaption class="mb-3 font-medium">
        {{ $t('pages.check.chart.title', { region: regionName, horizon: horizonLabel }) }}
      </figcaption>
      <BacktestChart
        :points="result.chart"
        :labels="chartLabels"
        :locale="locale"
        :source-line="$t('pages.check.chart.source')"
      />
    </figure>

    <div class="cf-card">
      <h3 class="mb-2 font-semibold">{{ $t('pages.check.metrics.heading') }}</h3>
      <div class="check-table-wrap">
        <table class="check-table">
          <caption class="mb-2 text-left text-xs cf-muted">{{ $t('pages.check.metrics.caption') }}</caption>
          <thead>
            <tr>
              <th scope="col" class="p-1 text-left">{{ $t('pages.check.metrics.model') }}</th>
              <th scope="col" class="p-1">{{ $t('pages.check.metrics.n') }}</th>
              <th scope="col" class="p-1">{{ $t('pages.check.metrics.mae') }}</th>
              <th scope="col" class="p-1">{{ $t('pages.check.metrics.wis') }}</th>
              <th scope="col" class="p-1">{{ $t('pages.check.metrics.cov50') }}</th>
              <th scope="col" class="p-1">{{ $t('pages.check.metrics.cov80') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.model">
              <th scope="row" class="p-1 text-left font-medium">{{ row.label }}</th>
              <td class="p-1">{{ row.n }}</td>
              <td class="p-1">{{ row.mae }}</td>
              <td class="p-1">{{ row.wis }}</td>
              <td class="p-1">{{ row.cov50 }}</td>
              <td class="p-1">{{ row.cov80 }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="cf-card">
      <p class="font-medium" data-testid="verdict">{{ verdictText }}</p>
      <p class="mt-1 text-sm cf-muted">{{ $t('pages.check.verdict.explain') }}</p>
    </div>
  </section>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { REGIONS, type Horizon } from '@coldfront/forecast-core';
import { BacktestChart, type BacktestChartLabels } from '@coldfront/charts';
import { formatNumber } from '../api';
import type { CheckResult } from '../check/compute';
import { modelKey, verdictOf } from '../check/helpers';
import type { Locale } from '../types';

const ENSEMBLE = 'ensemble';

export default defineComponent({
  name: 'CheckResults',
  components: { BacktestChart },
  props: {
    result: { type: Object as PropType<CheckResult>, required: true },
    locale: { type: String as PropType<Locale>, required: true },
  },
  computed: {
    regionName(): string {
      const r = REGIONS.find((x) => x.id === this.result.region);
      return r ? (this.locale === 'de' ? r.name_de : r.name_en) : this.result.region;
    },
    horizonLabel(): string {
      return this.$t(`pages.check.form.horizon${this.result.horizon as Horizon}`);
    },
    seconds(): string {
      return formatNumber(this.result.computeMs / 1000, this.locale, 1);
    },
    ensembleName(): string {
      return ENSEMBLE;
    },
    chartLabels(): BacktestChartLabels {
      const t = (k: string) => this.$t(`pages.check.chart.${k}`);
      return {
        title: this.$t('pages.check.chart.title', { region: this.regionName, horizon: this.horizonLabel }),
        actual: t('actual'),
        forecast: t('forecast'),
        band50: t('band50'),
        band80: t('band80'),
        yAxis: t('yAxis'),
        showTable: t('showTable'),
        tableWeek: t('tableWeek'),
        tableActual: t('tableActual'),
        tableMedian: t('tableMedian'),
        tableRange80: t('tableRange80'),
        weekShort: (w: string) => this.$t('weekShort', { week: Number(w.slice(-2)) }),
      };
    },
    rows(): { model: string; label: string; n: string; mae: string; wis: string; cov50: string; cov80: string }[] {
      return this.result.models
        .filter((m) => this.result.metrics[m])
        .map((m) => {
          const s = this.result.metrics[m]!;
          const key = modelKey(m);
          return {
            model: m,
            label: key ? this.$t(`pages.check.metrics.${key}`) : m,
            n: formatNumber(s.n, this.locale, 0),
            mae: formatNumber(s.mae, this.locale, 1),
            wis: formatNumber(s.wis, this.locale, 1),
            cov50: `${formatNumber(s.coverage50 * 100, this.locale, 0)} %`,
            cov80: `${formatNumber(s.coverage80 * 100, this.locale, 0)} %`,
          };
        });
    },
    verdictText(): string {
      const v = verdictOf(this.result.improvementVsBaseline);
      if (v.kind === 'none') return this.$t('pages.check.verdict.none');
      return this.$t(`pages.check.verdict.${v.kind}`, { pct: formatNumber(v.pct, this.locale, 0) });
    },
  },
});
</script>

<style scoped>
/* Scoped fallbacks so the metrics table stays readable and scrolls inside its card on narrow screens. */
.check-table-wrap {
  overflow-x: auto;
}
.check-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.check-table th,
.check-table td {
  padding: 6px 8px;
  text-align: right;
  white-space: nowrap;
  border-top: 1px solid var(--cf-border);
}
.check-table th:first-child,
.check-table td:first-child {
  text-align: left;
}
.check-table caption {
  caption-side: top;
  text-align: left;
  font-size: 12px;
  color: var(--cf-muted);
  margin-bottom: 8px;
  white-space: normal;
}
</style>
