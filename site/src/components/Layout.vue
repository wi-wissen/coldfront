<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { pageHref } from '../../scripts/pages';
import type { PageContext } from '../types';

export default defineComponent({
  name: 'CfLayout',
  props: { ctx: { type: Object as PropType<PageContext>, required: true } },
  computed: {
    nav() {
      const e = this.ctx.entry;
      const to = (page: 'index' | 'check' | 'sources' | 'api' | 'method', key: string) => ({
        href: pageHref(e.path, { page, locale: this.ctx.locale }),
        label: this.$t(`nav.${key}`),
        current: e.page === page,
      });
      return [to('index', 'home'), to('check', 'check'), to('method', 'method'), to('sources', 'sources'), to('api', 'api')];
    },
    otherLocale(): { href: string; label: string; lang: string } {
      const e = this.ctx.entry;
      const other = this.ctx.locale === 'de' ? 'en' : 'de';
      return { href: pageHref(e.path, { page: e.page, locale: other, region: e.region }), label: other.toUpperCase(), lang: other };
    },
    logoSrc(): string {
      return `${pageHref(this.ctx.entry.path, { page: 'index', locale: 'de' }).replace(/index\.html$/, '')}brand/logo.svg`;
    },
    homeHref(): string {
      return pageHref(this.ctx.entry.path, { page: 'index', locale: this.ctx.locale });
    },
    sourcesHref(): string {
      return pageHref(this.ctx.entry.path, { page: 'sources', locale: this.ctx.locale });
    },
    legalHref(): string {
      return pageHref(this.ctx.entry.path, { page: 'legal', locale: this.ctx.locale });
    },
    dataVersion(): string {
      return this.ctx.data.index?.data_version ?? '';
    },
  },
});
</script>

<template>
  <a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-[var(--cf-surface)] focus:p-2">{{ $t('skip') }}</a>
  <header class="border-b border-[var(--cf-border)] bg-[var(--cf-surface)]">
    <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
      <a :href="homeHref" class="flex items-center no-underline" :aria-label="$t('brand')"><img :src="logoSrc" alt="" width="148" height="34" class="h-8 w-auto" /></a>
      <nav :aria-label="$t('nav.menu')" class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <a v-for="n in nav" :key="n.href" :href="n.href" :aria-current="n.current ? 'page' : undefined" :class="n.current ? 'font-semibold' : ''">{{ n.label }}</a>
      </nav>
      <a :href="otherLocale.href" :hreflang="otherLocale.lang" :lang="otherLocale.lang" class="ml-auto text-sm" :aria-label="`${$t('nav.switchTo')} (${otherLocale.label})`">{{ otherLocale.label }}</a>
    </div>
  </header>
  <main id="main" class="mx-auto max-w-6xl px-4 py-6">
    <slot />
  </main>
  <footer class="mt-8 border-t border-[var(--cf-border)] bg-[var(--cf-surface)]">
    <div class="mx-auto max-w-6xl space-y-2 px-4 py-4 text-sm cf-muted">
      <p>{{ $t('footer.disclaimer') }}</p>
      <p>
        <a :href="sourcesHref">{{ $t('footer.sources') }}</a> ·
        <a :href="legalHref">{{ $t('nav.legal') }}</a>
        <template v-if="dataVersion"> · {{ $t('footer.dataVersion') }}: {{ dataVersion }}</template>
      </p>
      <p>{{ $t('footer.code') }}</p>
    </div>
  </footer>
</template>
