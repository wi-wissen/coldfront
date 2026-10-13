<template>
  <section class="cf-card mt-6" :aria-labelledby="'check-progress-title'">
    <h2 id="check-progress-title" class="text-lg font-semibold">{{ $t('pages.check.progress.label') }}</h2>
    <progress class="mt-3 w-full" :value="done" :max="total > 0 ? total : 1" :aria-labelledby="'check-progress-title'" />
    <p class="mt-2 text-sm cf-muted" aria-live="polite">
      {{ $t('pages.check.progress.detail', { done, total }) }}
    </p>
    <button type="button" class="mt-3 rounded border border-[var(--cf-border)] px-3 py-1 text-sm" @click="$emit('cancel')">
      {{ $t('pages.check.progress.cancel') }}
    </button>
  </section>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'CheckProgress',
  props: {
    done: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  emits: ['cancel'],
});
</script>
