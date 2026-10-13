<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { BacktestPublic } from '@coldfront/forecast-core';
import type { Locale } from '../types';
import { formatPercent } from '../lib/forecast-text';

type Gate = BacktestPublic['gate'];

/** Short quality note linking to the method page, built from the backtest gate. */
export default defineComponent({
  name: 'HomeQualityNote',
  props: {
    gate: { type: Object as PropType<Gate | null>, default: null },
    locale: { type: String as PropType<Locale>, required: true },
    methodHref: { type: String, required: true },
  },
  computed: {
    gateText(): string {
      const g = this.gate;
      if (!g) return this.$t('pages.index.quality.none');
      if (g.shipped === 'baseline') {
        return this.$t('pages.index.quality.baseline', { threshold: formatPercent(g.threshold, this.locale, 0) });
      }
      if (g.rel_wis_improvement === null) return this.$t('pages.index.quality.none');
      return this.$t('pages.index.quality.shipped', {
        pct: formatPercent(g.rel_wis_improvement, this.locale),
        threshold: formatPercent(g.threshold, this.locale, 0),
      });
    },
  },
});
</script>

<template>
  <section class="space-y-2">
    <p class="text-lg font-semibold"><a :href="methodHref">{{ $t('pages.index.quality.link') }}</a></p>
    <p>{{ gateText }}</p>
    <p class="text-sm cf-muted">{{ $t('pages.index.quality.evaluationNote') }}</p>
  </section>
</template>
