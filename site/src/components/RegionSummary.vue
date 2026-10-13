<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { ACTIVITY_THRESHOLDS, type ForecastHorizon } from '@coldfront/forecast-core';
import type { Locale } from '../types';
import RegionLevelBadge from './RegionLevelBadge.vue';
import { formatCount, formatIndex, isAboutUsual, isoWeekNumber } from '../lib/forecast-text';

/** Plain-language reading of the first horizon plus the seasonal-norm explanation. */
export default defineComponent({
  name: 'RegionSummary',
  components: { RegionLevelBadge },
  props: {
    row: { type: Object as PropType<ForecastHorizon>, required: true },
    regionName: { type: String, required: true },
    locale: { type: String as PropType<Locale>, required: true },
  },
  computed: {
    week(): string {
      return this.$t('weekShort', { week: isoWeekNumber(this.row.iso_week) });
    },
    sentence(): string {
      const { q10, q50, q90 } = this.row;
      return this.$t('pages.region.summary.sentence', {
        week: this.week,
        region: this.regionName,
        median: formatCount(q50, this.locale),
        low: formatCount(q10, this.locale),
        high: formatCount(q90, this.locale),
      });
    },
    indexText(): string {
      return isAboutUsual(this.row.index)
        ? this.$t('pages.region.summary.indexSimilar')
        : this.$t('pages.region.summary.indexTimes', { index: formatIndex(this.row.index, this.locale) });
    },
    levelText(): string {
      return this.$t(`pages.region.levels.${this.row.level}`);
    },
    normText(): string {
      return this.$t('pages.region.norm.text', {
        elevated: formatIndex(ACTIVITY_THRESHOLDS.elevated, this.locale),
        high: formatIndex(ACTIVITY_THRESHOLDS.high, this.locale),
      });
    },
  },
});
</script>

<template>
  <div class="grid gap-6 md:grid-cols-2">
    <section aria-labelledby="region-summary" class="cf-card space-y-3" aria-live="polite">
      <h2 id="region-summary" class="text-xl font-semibold">{{ $t('pages.region.summary.heading') }}</h2>
      <p class="text-lg font-medium leading-snug">{{ sentence }}</p>
      <p>{{ indexText }}</p>
      <p class="flex flex-wrap items-center gap-2">
        <span>{{ $t('pages.region.summary.level') }}</span>
        <RegionLevelBadge :level="row.level" :text="levelText" />
      </p>
    </section>
    <section aria-labelledby="region-norm" class="cf-card space-y-3">
      <h2 id="region-norm" class="text-xl font-semibold">{{ $t('pages.region.norm.heading') }}</h2>
      <p>{{ normText }}</p>
    </section>
  </div>
</template>
