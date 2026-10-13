<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { PageContext } from '../types';

export default defineComponent({
  name: 'RegionPage',
  props: { ctx: { type: Object as PropType<PageContext>, required: true } },
});
</script>

<template>
  <h1 class="text-2xl font-bold">{{ $t('pages.region.heading') }}</h1>
</template>
