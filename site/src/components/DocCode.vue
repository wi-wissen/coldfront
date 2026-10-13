<script lang="ts">
import { defineComponent } from 'vue';

/** Monospace example block. Scrolls horizontally and is keyboard-focusable. */
export default defineComponent({
  name: 'DocCode',
  props: {
    label: { type: String, required: true },
    code: { type: String, required: true },
  },
});
</script>

<template>
  <figure class="my-4">
    <pre
      class="overflow-x-auto rounded-lg border border-[var(--cf-border)] bg-[var(--cf-surface)] p-3 text-sm leading-relaxed"
      role="region"
      :aria-label="label"
      tabindex="0"
    ><code>{{ code }}</code></pre>
    <figcaption class="mt-1 text-xs cf-muted">{{ label }}</figcaption>
  </figure>
</template>
