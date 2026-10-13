<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { ActivityLevel } from '@coldfront/forecast-core';
import { levelSymbol } from '../lib/forecast-text';

const COLOURS: Record<ActivityLevel, string> = {
  normal: 'var(--cf-normal)',
  elevated: 'var(--cf-elevated)',
  high: 'var(--cf-high)',
};

/** Activity level as symbol plus text (colour is decoration, never the only signal). */
export default defineComponent({
  name: 'RegionLevelBadge',
  props: {
    level: { type: String as PropType<ActivityLevel>, required: true },
    text: { type: String, required: true },
  },
  computed: {
    symbol(): string {
      return levelSymbol(this.level);
    },
    colour(): string {
      return COLOURS[this.level];
    },
  },
});
</script>

<template>
  <span
    class="inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-sm font-semibold"
    :style="{ color: colour, borderColor: colour }"
  ><span aria-hidden="true">{{ symbol }}</span>{{ text }}</span>
</template>
