<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { ForecastChart, GermanyMap, type ForecastChartLabels, type GermanyMapLabels, type MapValue } from '@coldfront/charts';
import type { ActivityLevel, BacktestPublic, ForecastFile, ForecastHorizon, ForecastIndex, RegionIndexEntry } from '@coldfront/forecast-core';
import { pageHref } from '../../scripts/pages';
import { formatDate } from '../api';
import HomeHorizonPicker, { type HorizonOption } from '../components/HomeHorizonPicker.vue';
import HomeNationalSummary from '../components/HomeNationalSummary.vue';
import HomePostcodeSearch from '../components/HomePostcodeSearch.vue';
import HomeQualityNote from '../components/HomeQualityNote.vue';
import HomeRegionList, { type RegionListRow } from '../components/HomeRegionList.vue';
import { formatCount, formatIndex, isStale, isoWeekNumber } from '../lib/forecast-text';
import type { Locale, PageContext } from '../types';

interface StateSummary {
  entry: RegionIndexEntry;
  summary: RegionIndexEntry['summary'][number];
}

/** Start page: national forecast, state map and list, postcode lookup, quality note. All data is embedded at build time. */
export default defineComponent({
  name: 'IndexPage',
  components: {
    ForecastChart,
    GermanyMap,
    HomeHorizonPicker,
    HomeNationalSummary,
    HomePostcodeSearch,
    HomeQualityNote,
    HomeRegionList,
  },
  props: { ctx: { type: Object as PropType<PageContext>, required: true } },
  data() {
    return { horizon: 1, stale: false };
  },
  // Client only: SSR and hydration render identical markup; the warning appears after mount.
  mounted() {
    const version = this.index?.data_version;
    if (version) this.stale = isStale(version, new Date().toISOString().slice(0, 10));
  },
  computed: {
    index(): ForecastIndex | null {
      return this.ctx.data.index;
    },
    national(): ForecastFile | null {
      return this.ctx.data.national;
    },
    backtestGate(): BacktestPublic['gate'] | null {
      return this.ctx.data.backtest?.gate ?? null;
    },
    locale(): Locale {
      return this.ctx.locale;
    },
    selectedRow(): ForecastHorizon | null {
      return this.national?.horizons.find((h) => h.h === this.horizon) ?? null;
    },
    horizonOptions(): HorizonOption[] {
      return (this.national?.horizons ?? []).map((h) => ({
        value: h.h,
        label: this.$t('pages.index.hero.horizon', { n: h.h, week: this.weekLabel(h.iso_week) }, h.h),
      }));
    },
    chartLabels(): ForecastChartLabels {
      const t = (key: string): string => this.$t(`pages.index.chart.${key}`);
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
        weekShort: (week: string) => this.weekLabel(week),
      };
    },
    sourceLine(): string {
      return this.$t('pages.index.chart.sourceLine');
    },
    stateSummaries(): StateSummary[] {
      const out: StateSummary[] = [];
      for (const entry of this.index?.regions ?? []) {
        if (entry.level !== 'bundesland') continue;
        const summary = entry.summary.find((s) => s.h === this.horizon);
        if (summary) out.push({ entry, summary });
      }
      return out;
    },
    mapLabels(): GermanyMapLabels {
      const t = (key: string): string => this.$t(`pages.index.map.${key}`);
      return {
        title: t('title'),
        legendTitle: t('legendTitle'),
        legendLow: t('legendLow'),
        legendHigh: t('legendHigh'),
        noData: t('noData'),
        showTable: t('showTable'),
        tableRegion: t('tableRegion'),
        tableValue: t('tableValue'),
        // The level word is already part of each value label; empty strings are skipped by the map table.
        levels: { normal: '', elevated: '', high: '' },
      };
    },
    mapValues(): MapValue[] {
      return this.stateSummaries.map(({ entry, summary }) => ({
        id: entry.id,
        value: summary.index,
        level: summary.level,
        label: this.$t('pages.index.map.valueLabel', {
          index: formatIndex(summary.index, this.locale),
          level: this.levelName(summary.level),
        }),
        name: this.nameOf(entry),
      }));
    },
    regionRows(): RegionListRow[] {
      return this.stateSummaries.map(({ entry, summary }) => ({
        id: entry.id,
        name: this.nameOf(entry),
        href: this.regionHref(entry.id),
        level: summary.level,
        levelText: this.levelName(summary.level),
        rangeText: this.$t('pages.index.list.range80', {
          low: formatCount(summary.q10, this.locale),
          high: formatCount(summary.q90, this.locale),
        }),
      }));
    },
    methodHref(): string {
      return pageHref(this.ctx.entry.path, { page: 'method', locale: this.locale });
    },
    dataLine(): string {
      if (!this.index) return '';
      return this.$t('pages.index.dataLine', {
        data: formatDate(this.index.data_version, this.locale),
        issued: formatDate(this.index.issued, this.locale),
      });
    },
  },
  methods: {
    weekLabel(week: string): string {
      return this.$t('weekShort', { week: isoWeekNumber(week) });
    },
    levelName(level: ActivityLevel): string {
      return this.$t(`pages.index.levels.${level}`);
    },
    nameOf(entry: RegionIndexEntry): string {
      return this.locale === 'en' ? entry.name_en : entry.name_de;
    },
    regionHref(id: string): string {
      return pageHref(this.ctx.entry.path, { page: 'region', locale: this.locale, region: id });
    },
    goRegion(id: string): void {
      window.location.href = this.regionHref(id);
    },
  },
});
</script>

<template>
  <div class="space-y-10">
    <header class="space-y-3">
      <h1 class="text-3xl font-bold leading-tight">{{ $t('pages.index.heading') }}</h1>
      <p class="max-w-3xl text-lg">{{ $t('pages.index.intro') }}</p>
      <p v-if="dataLine" class="text-sm cf-muted">{{ dataLine }}</p>
      <p v-if="stale" role="status" class="rounded-lg border border-[var(--cf-elevated)] p-3 font-medium">
        {{ $t('pages.index.staleNotice') }}
      </p>
    </header>

    <p v-if="!national || !index" role="alert" class="cf-card">{{ $t('error') }}</p>

    <template v-else>
      <section aria-labelledby="home-national" class="space-y-4">
        <h2 id="home-national" class="text-xl font-semibold">{{ $t('pages.index.hero.heading') }}</h2>
        <div class="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div class="cf-card min-w-0">
            <ForecastChart
              :observed="national.observed"
              :horizons="national.horizons"
              :labels="chartLabels"
              :locale="locale"
              :source-line="sourceLine"
            />
          </div>
          <div class="cf-card min-w-0 space-y-5">
            <HomeHorizonPicker
              :model-value="horizon"
              :options="horizonOptions"
              :legend="$t('pages.index.hero.horizonLegend')"
              @update:model-value="horizon = $event"
            />
            <HomeNationalSummary v-if="selectedRow" :row="selectedRow" :locale="locale" />
          </div>
        </div>
      </section>

      <section aria-labelledby="home-map" class="space-y-4">
        <h2 id="home-map" class="text-xl font-semibold">{{ $t('pages.index.map.heading') }}</h2>
        <p class="max-w-3xl">{{ $t('pages.index.map.intro') }}</p>
        <div class="grid items-start gap-6 md:grid-cols-2">
          <div class="cf-card min-w-0">
            <GermanyMap
              :topology="ctx.data.topology"
              :values="mapValues"
              :labels="mapLabels"
              :selected="null"
              :source-line="sourceLine"
              @select="goRegion"
            />
          </div>
          <div class="cf-card min-w-0">
            <HomeRegionList :rows="regionRows" />
          </div>
        </div>
      </section>

      <HomePostcodeSearch :path="ctx.entry.path" :locale="locale" />

      <HomeQualityNote :gate="backtestGate" :locale="locale" :method-href="methodHref" />
    </template>
  </div>
</template>
