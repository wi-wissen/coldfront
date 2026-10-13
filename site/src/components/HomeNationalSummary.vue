<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { ACTIVITY_THRESHOLDS, type ForecastHorizon } from '@coldfront/forecast-core';
import type { Locale } from '../types';
import RegionLevelBadge from './RegionLevelBadge.vue';
import { formatCount, formatIndex, isAboutUsual, isoWeekNumber } from '../lib/forecast-text';

/** Plain-language summary of one horizon of the national forecast. */
export default defineComponent({
  name: 'HomeNationalSummary',
  components: { RegionLevelBadge },
  props: {
    row: { type: Object as PropType<ForecastHorizon>, required: true },
    locale: { type: String as PropType<Locale>, required: true },
  },
  computed: {
    week(): string {
      return this.$t('weekShort', { week: isoWeekNumber(this.row.iso_week) });
    },
    sentence(): string {
      const { q10, q50, q90 } = this.row;
      return this.$t('pages.index.hero.sentence', {
        week: this.week,
        median: formatCount(q50, this.locale),
        low: formatCount(q10, this.locale),
        high: formatCount(q90, this.locale),
      });
    },
    indexText(): string {
      return isAboutUsual(this.row.index)
        ? this.$t('pages.index.hero.indexSimilar')
        : this.$t('pages.index.hero.indexTimes', { index: formatIndex(this.row.index, this.locale) });
    },
    indexExplain(): string {
      return this.$t('pages.index.hero.indexExplain', { index: formatIndex(this.row.index, this.locale) });
    },
    levelText(): string {
      return this.$t(`pages.index.levels.${this.row.level}`);
    },
    thresholds(): string {
      return this.$t('pages.index.hero.thresholds', {
        elevated: formatIndex(ACTIVITY_THRESHOLDS.elevated, this.locale),
        high: formatIndex(ACTIVITY_THRESHOLDS.high, this.locale),
      });
    },
  },
});
</script>

<template>
  <div class="space-y-3" aria-live="polite">
    <p class="text-lg font-medium leading-snug">{{ sentence }}</p>
    <p>{{ indexText }}</p>
    <p class="text-sm cf-muted">{{ indexExplain }}</p>
    <p class="flex flex-wrap items-center gap-2">
      <span>{{ $t('pages.index.hero.level') }}</span>
      <RegionLevelBadge :level="row.level" :text="levelText" />
    </p>
    <p class="text-sm cf-muted">{{ thresholds }}</p>
  </div>
</template>
