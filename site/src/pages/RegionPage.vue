<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { ForecastChart, type ForecastChartLabels } from '@coldfront/charts';
import { regionById, type ForecastFile } from '@coldfront/forecast-core';
import { pageHref } from '../../scripts/pages';
import { formatDate } from '../api';
import RegionHorizonTable from '../components/RegionHorizonTable.vue';
import RegionSummary from '../components/RegionSummary.vue';
import RegionWastewater from '../components/RegionWastewater.vue';
import { isoWeekNumber } from '../lib/forecast-text';
import type { PageContext } from '../types';

/** Region page: one federal state, prerendered per state (regions/<id>.html). */
export default defineComponent({
  name: 'RegionPage',
  components: { ForecastChart, RegionHorizonTable, RegionSummary, RegionWastewater },
  props: { ctx: { type: Object as PropType<PageContext>, required: true } },
  computed: {
    region(): ForecastFile | null {
      return this.ctx.data.region;
    },
    regionName(): string {
      const info = regionById(this.region?.region ?? this.ctx.entry.region ?? '');
      if (!info) return this.region?.region ?? '';
      return this.ctx.locale === 'en' ? info.name_en : info.name_de;
    },
    chartLabels(): ForecastChartLabels {
      const t = (key: string): string => this.$t(`pages.region.chart.${key}`, { region: this.regionName });
      return {
        title: t('title'),
        currentSeason: t('currentSeason'),
        previousSeasons: t('previousSeasons'),
        forecast: t('forecast'),
        band50: t('band50'),
        band80: t('band80'),
        yAxis: t('yAxis'),
        showTable: t('showTable'),
        tableWeek: t('tableWeek'),
        tableObserved: t('tableObserved'),
        tableMedian: t('tableMedian'),
        tableRange50: t('tableRange50'),
        tableRange80: t('tableRange80'),
        weekShort: (week: string) => this.$t('weekShort', { week: isoWeekNumber(week) }),
      };
    },
    sourceLine(): string {
      return this.$t('pages.region.chart.sourceLine');
    },
    horizon1(): ForecastFile['horizons'][number] | null {
      return this.region?.horizons.find((h) => h.h === 1) ?? null;
    },
    dataLine(): string {
      if (!this.region) return '';
      return this.$t('pages.region.dataLine', {
        data: formatDate(this.region.data_version, this.ctx.locale),
        issued: formatDate(this.region.issued, this.ctx.locale),
      });
    },
    homeHref(): string {
      return pageHref(this.ctx.entry.path, { page: 'index', locale: this.ctx.locale });
    },
  },
});
</script>

<template>
  <div class="space-y-10">
    <template v-if="region && horizon1">
      <nav :aria-label="$t('pages.region.breadcrumb')">
        <ol class="flex flex-wrap gap-x-2 text-sm">
          <li><a :href="homeHref">{{ $t('nav.home') }}</a> <span aria-hidden="true" class="cf-muted">/</span></li>
          <li aria-current="page" class="font-semibold">{{ regionName }}</li>
        </ol>
      </nav>

      <header class="space-y-2">
        <h1 class="text-3xl font-bold leading-tight">{{ $t('pages.region.heading', { region: regionName }) }}</h1>
        <p class="text-sm cf-muted">{{ dataLine }}</p>
      </header>

      <section aria-labelledby="region-chart" class="space-y-4">
        <h2 id="region-chart" class="sr-only">{{ $t('pages.region.chart.title', { region: regionName }) }}</h2>
        <div class="cf-card min-w-0">
          <ForecastChart
            :observed="region.observed"
            :horizons="region.horizons"
            :labels="chartLabels"
            :locale="ctx.locale"
            :source-line="sourceLine"
          />
        </div>
      </section>

      <section aria-labelledby="region-table" class="space-y-3">
        <h2 id="region-table" class="text-xl font-semibold">{{ $t('pages.region.table.heading') }}</h2>
        <RegionHorizonTable :horizons="region.horizons" :locale="ctx.locale" />
      </section>

      <section v-if="ctx.data.wastewater" aria-labelledby="region-wastewater" class="space-y-3">
        <h2 id="region-wastewater" class="text-xl font-semibold">{{ $t('pages.region.wastewater.heading') }}</h2>
        <RegionWastewater :wastewater="ctx.data.wastewater" :region-name="regionName" :locale="ctx.locale" />
      </section>

      <RegionSummary :row="horizon1" :region-name="regionName" :locale="ctx.locale" />

      <section class="space-y-3">
        <p class="max-w-3xl text-sm cf-muted">{{ $t('pages.region.notice') }}</p>
        <p><a :href="homeHref">{{ $t('pages.region.nationalLink') }}</a></p>
        <p class="text-sm cf-muted">{{ region.attribution }}</p>
      </section>
    </template>

    <section v-else class="space-y-3">
      <h1 class="text-2xl font-bold">{{ $t('pages.region.title') }}</h1>
      <p role="alert" class="cf-card">{{ $t('pages.region.missing') }}</p>
      <p><a :href="homeHref">{{ $t('pages.region.backToStart') }}</a></p>
    </section>
  </div>
</template>
