<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { IsoWeek, WastewaterExport } from '@coldfront/forecast-core';
import { formatNumber } from '../api';
import { isoWeekNumber } from '../lib/forecast-text';
import {
  WASTEWATER_PATHOGENS,
  isCurrent,
  percentPoints,
  pathogenRecord,
  sparkline,
  trendSymbol,
  type Sparkline,
  type WastewaterPathogen,
} from '../lib/wastewater';
import type { Locale } from '../types';

interface PlantRow {
  key: string;
  site: string;
  pathogen: string;
  week: string;
  current: boolean;
  value: string;
  percentile: string;
  trend: string;
  trendText: string;
  spark: Sparkline | null;
  sparkLabel: string;
}

const SPARK_W = 80;
const SPARK_H = 20;

/** Region page: one row per plant and pathogen with the latest value, percentile, trend and a 26-week sparkline. */
export default defineComponent({
  name: 'RegionWastewater',
  props: {
    /** plants of this federal state only (the page data is filtered at build time) */
    wastewater: { type: Object as PropType<WastewaterExport>, required: true },
    regionName: { type: String, required: true },
    locale: { type: String as PropType<Locale>, required: true },
  },
  computed: {
    rows(): PlantRow[] {
      const exportWeek: IsoWeek = this.wastewater.last_week;
      const out: PlantRow[] = [];
      const sites = [...this.wastewater.sites].sort((a, b) => a.name.localeCompare(b.name));
      for (const site of sites) {
        for (const pathogen of WASTEWATER_PATHOGENS) {
          const record = pathogenRecord(site, pathogen);
          if (!record) continue;
          const current = isCurrent(record, exportWeek);
          const pathogenName = this.$t(`pages.region.wastewater.pathogens.${pathogen}`);
          out.push({
            key: `${site.id}-${pathogen}`,
            site: site.name,
            pathogen: pathogenName,
            week: this.$t('weekShort', { week: isoWeekNumber(record.last_week) }),
            current,
            value: current ? formatNumber(record.value, this.locale, 0) : '–',
            percentile: current ? String(percentPoints(record.percentile)) : '–',
            trend: current ? trendSymbol(record.trend) : '–',
            trendText: current ? this.$t(`pages.region.wastewater.trend.${record.trend}`) : '',
            spark: sparkline(record.recent, SPARK_W, SPARK_H),
            sparkLabel: this.$t('pages.region.wastewater.sparkLabel', {
              weeks: record.recent.length,
              site: site.name,
              pathogen: pathogenName,
            }),
          });
        }
      }
      return out;
    },
    anyCurrent(): boolean {
      return this.rows.some((r) => r.current);
    },
    caption(): string {
      return this.$t('pages.region.wastewater.caption', { region: this.regionName });
    },
    noSites(): string {
      return this.$t('pages.region.wastewater.noSites', { region: this.regionName });
    },
    noCurrent(): string {
      return this.$t('pages.region.wastewater.noCurrent', { region: this.regionName });
    },
    notes(): string[] {
      return [this.$t('pages.region.wastewater.percentileHelp'), this.$t('pages.region.wastewater.staleHint')];
    },
  },
});
</script>

<template>
  <div class="space-y-4">
    <p class="max-w-3xl">{{ $t('pages.region.wastewater.intro') }}</p>
    <ul class="list-disc space-y-1 pl-5 text-sm cf-muted">
      <li v-for="note in notes" :key="note">{{ note }}</li>
    </ul>

    <p v-if="!wastewater.sites.length" role="status" class="cf-card">{{ noSites }}</p>
    <template v-else>
      <p v-if="!anyCurrent" role="status" class="cf-card">{{ noCurrent }}</p>
      <div v-if="rows.length" class="cf-card overflow-x-auto p-0" tabindex="0" role="region" :aria-label="caption">
        <table class="w-full min-w-[40rem] border-collapse text-xs sm:text-sm">
          <caption class="sr-only">{{ caption }}</caption>
          <thead>
            <tr class="text-left">
              <th scope="col" class="border-b border-[var(--cf-border)] px-2 py-2 sm:px-3">{{ $t('pages.region.wastewater.table.site') }}</th>
              <th scope="col" class="border-b border-[var(--cf-border)] px-2 py-2 sm:px-3">{{ $t('pages.region.wastewater.table.pathogen') }}</th>
              <th scope="col" class="border-b border-[var(--cf-border)] px-2 py-2 sm:px-3">{{ $t('pages.region.wastewater.table.week') }}</th>
              <th scope="col" class="border-b border-[var(--cf-border)] px-2 py-2 sm:px-3 text-right">{{ $t('pages.region.wastewater.table.value') }}</th>
              <th scope="col" class="border-b border-[var(--cf-border)] px-2 py-2 sm:px-3 text-right">{{ $t('pages.region.wastewater.table.percentile') }}</th>
              <th scope="col" class="border-b border-[var(--cf-border)] px-2 py-2 sm:px-3">{{ $t('pages.region.wastewater.table.trend') }}</th>
              <th scope="col" class="border-b border-[var(--cf-border)] px-2 py-2 sm:px-3">{{ $t('pages.region.wastewater.table.history') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.key" :class="{ 'cf-muted': !r.current }">
              <th scope="row" class="border-b border-[var(--cf-border)] px-2 py-2 sm:px-3 text-left font-medium">{{ r.site }}</th>
              <td class="border-b border-[var(--cf-border)] px-2 py-2 sm:px-3">{{ r.pathogen }}</td>
              <td class="border-b border-[var(--cf-border)] px-2 py-2 sm:px-3 whitespace-nowrap">
                {{ r.week }}
                <span v-if="!r.current" class="italic">({{ $t('pages.region.wastewater.stale') }})</span>
              </td>
              <td class="border-b border-[var(--cf-border)] px-2 py-2 sm:px-3 text-right tabular-nums">{{ r.value }}</td>
              <td class="border-b border-[var(--cf-border)] px-2 py-2 sm:px-3 text-right tabular-nums">{{ r.percentile }}</td>
              <td class="border-b border-[var(--cf-border)] px-2 py-2 sm:px-3 whitespace-nowrap">
                <span aria-hidden="true">{{ r.trend }}</span>
                <span class="sr-only">{{ r.trendText }}</span>
              </td>
              <td class="border-b border-[var(--cf-border)] px-2 py-2 sm:px-3">
                <svg
                  v-if="r.spark"
                  viewBox="0 0 80 20"
                  width="80"
                  height="20"
                  class="block overflow-visible"
                  role="img"
                  :aria-label="r.sparkLabel"
                >
                  <path :d="r.spark.d" fill="none" stroke="var(--cf-accent)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
                  <circle v-if="r.spark.end" :cx="r.spark.end.x" :cy="r.spark.end.y" r="2.2" fill="var(--cf-accent)" />
                </svg>
                <span v-else class="cf-muted">
                  <span aria-hidden="true">–</span>
                  <span class="sr-only">{{ $t('pages.region.wastewater.noSpark') }}</span>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <p class="text-sm cf-muted">{{ wastewater.attribution }}</p>
  </div>
</template>
