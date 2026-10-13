<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { ActivityLevel, ForecastHorizon } from '@coldfront/forecast-core';
import type { Locale } from '../types';
import RegionLevelBadge from './RegionLevelBadge.vue';
import { formatCount, formatIndex, isoWeekNumber } from '../lib/forecast-text';

interface TableRow {
  key: number;
  ahead: number;
  week: string;
  median: string;
  range50: string;
  range80: string;
  index: string;
  level: ActivityLevel;
  levelText: string;
}

/** The four forecast horizons with quantile ranges, index and classification. */
export default defineComponent({
  name: 'RegionHorizonTable',
  components: { RegionLevelBadge },
  props: {
    horizons: { type: Array as PropType<ForecastHorizon[]>, required: true },
    locale: { type: String as PropType<Locale>, required: true },
  },
  computed: {
    rows(): TableRow[] {
      const range = (lo: number, hi: number): string => `${formatCount(lo, this.locale)} – ${formatCount(hi, this.locale)}`;
      return [...this.horizons]
        .sort((a, b) => a.h - b.h)
        .map((h) => ({
          key: h.h,
          ahead: h.h,
          week: this.$t('weekShort', { week: isoWeekNumber(h.iso_week) }),
          median: formatCount(h.q50, this.locale),
          range50: range(h.q25, h.q75),
          range80: range(h.q10, h.q90),
          index: formatIndex(h.index, this.locale),
          level: h.level,
          levelText: this.$t(`pages.region.levels.${h.level}`),
        }));
    },
  },
});
</script>

<template>
  <div class="cf-card overflow-x-auto p-0">
    <table class="w-full min-w-[40rem] border-collapse text-sm">
      <caption class="sr-only">{{ $t('pages.region.table.caption') }}</caption>
      <thead>
        <tr class="border-b border-[var(--cf-border)] text-left">
          <th scope="col" class="px-3 py-2">{{ $t('pages.region.table.ahead') }}</th>
          <th scope="col" class="px-3 py-2">{{ $t('pages.region.table.target') }}</th>
          <th scope="col" class="px-3 py-2 text-right">{{ $t('pages.region.table.median') }}</th>
          <th scope="col" class="px-3 py-2 text-right">{{ $t('pages.region.table.range50') }}</th>
          <th scope="col" class="px-3 py-2 text-right">{{ $t('pages.region.table.range80') }}</th>
          <th scope="col" class="px-3 py-2 text-right">{{ $t('pages.region.table.index') }}</th>
          <th scope="col" class="px-3 py-2">{{ $t('pages.region.table.level') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.key" class="border-b border-[var(--cf-border)] last:border-0">
          <th scope="row" class="px-3 py-2 text-left font-medium">{{ r.ahead }}</th>
          <td class="px-3 py-2">{{ r.week }}</td>
          <td class="px-3 py-2 text-right tabular-nums">{{ r.median }}</td>
          <td class="px-3 py-2 text-right tabular-nums">{{ r.range50 }}</td>
          <td class="px-3 py-2 text-right tabular-nums">{{ r.range80 }}</td>
          <td class="px-3 py-2 text-right tabular-nums">{{ r.index }}</td>
          <td class="px-3 py-2"><RegionLevelBadge :level="r.level" :text="r.levelText" /></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
