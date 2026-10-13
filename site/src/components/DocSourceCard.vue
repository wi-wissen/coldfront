<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { formatDate } from '../api';
import type { Locale, SourceRecord } from '../types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[0-9a-f]{64}$/i;

/** Provenance card of one data source (licence, retrieval date, reference, checksum, attribution). */
export default defineComponent({
  name: 'DocSourceCard',
  props: {
    source: { type: Object as PropType<SourceRecord>, required: true },
    locale: { type: String as PropType<Locale>, required: true },
  },
  computed: {
    hasDoi(): boolean {
      return (this.source.doi ?? '') !== '';
    },
    doiHref(): string {
      const d = this.source.doi ?? '';
      return d.startsWith('http') ? d : `https://doi.org/${d}`;
    },
    retrieved(): string {
      return ISO_DATE.test(this.source.retrieved) ? formatDate(this.source.retrieved, this.locale) : '–';
    },
    isHash(): boolean {
      return SHA256.test(this.source.sha256 ?? '');
    },
    shaShort(): string {
      return this.isHash ? `${this.source.sha256.slice(0, 12)}…` : this.source.sha256 || '–';
    },
  },
});
</script>

<template>
  <article class="cf-card h-full min-w-0">
    <h3 class="font-semibold">{{ source.name }}</h3>
    <dl class="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
      <dt class="cf-muted">{{ $t('pages.sources.card.licence') }}</dt>
      <dd>
        <a v-if="source.license_url" :href="source.license_url" class="underline">{{ source.license }}</a>
        <span v-else>{{ source.license }}</span>
      </dd>

      <dt class="cf-muted">{{ $t('pages.sources.card.retrieved') }}</dt>
      <dd>
        <time :datetime="source.retrieved">{{ retrieved }}</time>
      </dd>

      <dt class="cf-muted">{{ $t('pages.sources.card.reference') }}</dt>
      <dd class="min-w-0 break-all">
        <a v-if="hasDoi" :href="doiHref" class="break-all underline">{{ source.doi }}</a>
        <template v-if="hasDoi"> · </template>
        <a v-if="source.url" :href="source.url" class="break-all underline">{{ source.url }}</a>
      </dd>

      <dt class="cf-muted">{{ $t('pages.sources.card.sha256') }}</dt>
      <dd>
        <code class="break-all" :title="source.sha256">{{ shaShort }}</code>
      </dd>

      <dt class="cf-muted">{{ $t('pages.sources.card.attribution') }}</dt>
      <dd class="min-w-0 break-words">{{ source.attribution }}</dd>
    </dl>
  </article>
</template>
