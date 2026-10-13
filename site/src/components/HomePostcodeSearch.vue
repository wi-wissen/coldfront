<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { regionById } from '@coldfront/forecast-core';
import { pageHref } from '../../scripts/pages';
import { getJson, rootOf } from '../api';
import type { Locale } from '../types';
import { checkPostcode, lookupPostcode, type PlzTable } from '../lib/postcode';

// Loaded at most once per browser session, and only after the first submit.
let plzTable: Promise<PlzTable> | null = null;

function loadPlzTable(): Promise<PlzTable> {
  if (!plzTable) {
    plzTable = getJson<PlzTable>(rootOf(), 'geo/plz.json').catch((err: unknown) => {
      plzTable = null;
      throw err;
    });
  }
  return plzTable;
}

/** Postcode to region page. The lookup runs in the browser; the postcode itself is never sent. */
export default defineComponent({
  name: 'HomePostcodeSearch',
  props: {
    path: { type: String, required: true },
    locale: { type: String as PropType<Locale>, required: true },
  },
  data() {
    return { input: '', message: '', messageIsError: false, busy: false };
  },
  methods: {
    show(text: string, isError: boolean): void {
      this.message = text;
      this.messageIsError = isError;
    },
    async submit(): Promise<void> {
      if (this.busy) return;
      const check = checkPostcode(this.input);
      if (!check.ok) {
        this.show(this.$t('pages.index.postcode.invalid'), true);
        return;
      }
      this.busy = true;
      this.show(this.$t('pages.index.postcode.loading'), false);
      try {
        const table = await loadPlzTable();
        const id = lookupPostcode(table, check.plz);
        const region = id ? regionById(id) : undefined;
        if (!region || region.id === 'de') {
          this.show(this.$t('pages.index.postcode.unknown', { plz: check.plz }), true);
          return;
        }
        const name = this.locale === 'en' ? region.name_en : region.name_de;
        this.show(this.$t('pages.index.postcode.found', { region: name }), false);
        this.navigate(pageHref(this.path, { page: 'region', locale: this.locale, region: region.id }));
      } catch {
        this.show(this.$t('pages.index.postcode.loadFailed'), true);
      } finally {
        this.busy = false;
      }
    },
    navigate(href: string): void {
      window.location.href = href;
    },
  },
});
</script>

<template>
  <section aria-labelledby="home-postcode" class="space-y-3">
    <h2 id="home-postcode" class="text-xl font-semibold">{{ $t('pages.index.postcode.heading') }}</h2>
    <p id="cf-plz-hint" class="cf-muted">{{ $t('pages.index.postcode.intro') }}</p>
    <form novalidate class="flex flex-wrap items-end gap-3" @submit.prevent="submit">
      <div class="min-w-0 basis-48 flex-1">
        <label for="cf-plz" class="block text-sm font-medium">{{ $t('pages.index.postcode.label') }}</label>
        <input
          id="cf-plz"
          v-model="input"
          type="text"
          inputmode="numeric"
          autocomplete="postal-code"
          aria-describedby="cf-plz-hint cf-plz-status"
          :aria-invalid="messageIsError ? 'true' : undefined"
          class="mt-1 w-full rounded-md border border-[var(--cf-border)] bg-[var(--cf-surface)] px-3 py-2 text-base text-[var(--cf-text)]"
        />
      </div>
      <button
        type="submit"
        class="rounded-md bg-[var(--cf-accent)] px-4 py-2 font-semibold text-[var(--cf-accent-text)]"
      >{{ $t('pages.index.postcode.submit') }}</button>
    </form>
    <p id="cf-plz-status" aria-live="polite" class="min-h-6 text-sm" :class="messageIsError ? 'font-medium text-[var(--cf-high)]' : ''">{{ message }}</p>
  </section>
</template>
