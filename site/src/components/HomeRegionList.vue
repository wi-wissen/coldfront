<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { ActivityLevel } from '@coldfront/forecast-core';
import RegionLevelBadge from './RegionLevelBadge.vue';

export interface RegionListRow {
  id: string;
  name: string;
  href: string;
  level: ActivityLevel;
  levelText: string;
  rangeText: string;
}

/** Plain links to the 16 region pages (works without JavaScript). */
export default defineComponent({
  name: 'HomeRegionList',
  components: { RegionLevelBadge },
  props: {
    rows: { type: Array as PropType<RegionListRow[]>, required: true },
  },
});
</script>

<template>
  <div>
    <h3 class="text-base font-semibold">{{ $t('pages.index.list.heading') }}</h3>
    <p class="text-sm cf-muted">{{ $t('pages.index.list.intro') }}</p>
    <ul class="mt-2 divide-y divide-[var(--cf-border)]">
      <li v-for="r in rows" :key="r.id" class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
        <a :href="r.href" class="font-medium">{{ r.name }}</a>
        <span class="flex flex-wrap items-center gap-2 text-sm">
          <RegionLevelBadge :level="r.level" :text="r.levelText" />
          <span class="cf-muted">{{ r.rangeText }}</span>
        </span>
      </li>
    </ul>
  </div>
</template>
