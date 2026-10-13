<script lang="ts">
import { defineComponent, type PropType } from 'vue';

export interface DocHeader {
  label: string;
  /** right-aligned numeric column */
  numeric?: boolean;
}

/** Data table with caption, column headers (scope col) and a source line. Wide tables scroll inside their box. */
export default defineComponent({
  name: 'DocTable',
  props: {
    caption: { type: String, required: true },
    headers: { type: Array as PropType<DocHeader[]>, required: true },
    source: { type: String, default: '' },
  },
});
</script>

<template>
  <figure class="my-4">
    <div
      class="cf-doc-scroll overflow-x-auto rounded-lg border border-[var(--cf-border)] bg-[var(--cf-surface)]"
      role="region"
      :aria-label="caption"
      tabindex="0"
    >
      <table class="w-full min-w-[30rem] border-collapse text-sm">
        <caption class="px-3 py-2 text-left font-semibold">{{ caption }}</caption>
        <thead>
          <tr>
            <th
              v-for="(h, i) in headers"
              :key="i"
              scope="col"
              :class="['border-b border-[var(--cf-border)] px-3 py-2 font-semibold', h.numeric ? 'text-right' : 'text-left']"
            >
              {{ h.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <slot />
        </tbody>
      </table>
    </div>
    <figcaption v-if="source" class="mt-1 text-xs cf-muted">{{ source }}</figcaption>
  </figure>
</template>

<style scoped>
/* Cells are supplied by the parent page through the default slot. */
tbody :deep(td),
tbody :deep(th) {
  border-top: 1px solid var(--cf-border);
  padding: 0.5rem 0.75rem;
  vertical-align: top;
}
tbody :deep(th[scope='row']) {
  font-weight: 600;
  text-align: left;
}
tbody :deep(.num) {
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
</style>
