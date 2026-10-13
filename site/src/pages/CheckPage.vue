<script lang="ts">
import { defineComponent, markRaw, type PropType } from 'vue';
import { HORIZONS, REGIONS } from '@coldfront/forecast-core';
import { rootOf } from '../api';
import CheckProgress from '../components/CheckProgress.vue';
import CheckResults from '../components/CheckResults.vue';
import type { CheckResult } from '../check/compute';
import { SEASON_OPTIONS, validateSelection, type SelectionField } from '../check/helpers';
import type { CheckResponse } from '../check/protocol';
import type { PageContext } from '../types';

type Phase = 'idle' | 'running' | 'done' | 'cancelled' | 'error';

export default defineComponent({
  name: 'CheckPage',
  components: { CheckProgress, CheckResults },
  props: { ctx: { type: Object as PropType<PageContext>, required: true } },
  data() {
    return {
      region: '',
      season: '',
      horizon: 1,
      errors: [] as SelectionField[],
      phase: 'idle' as Phase,
      done: 0,
      total: 0,
      result: null as CheckResult | null,
      errorMessage: '',
      worker: null as Worker | null,
    };
  },
  computed: {
    regionOptions(): { id: string; name: string }[] {
      return REGIONS.map((r) => ({ id: r.id, name: this.ctx.locale === 'de' ? r.name_de : r.name_en }));
    },
    seasonOptions(): readonly string[] {
      return SEASON_OPTIONS;
    },
    horizonOptions(): number[] {
      return [...HORIZONS];
    },
    running(): boolean {
      return this.phase === 'running';
    },
  },
  methods: {
    /** Starts the worker. Only called from the button, so nothing runs during SSR. */
    start(): void {
      this.errors = validateSelection({ region: this.region, season: this.season, horizon: this.horizon });
      if (this.errors.length > 0 || this.running) return;
      this.result = null;
      this.errorMessage = '';
      if (typeof Worker === 'undefined') {
        this.phase = 'error';
        this.errorMessage = this.$t('pages.check.errors.noWorker');
        return;
      }
      this.terminate();
      const worker = markRaw(new Worker(new URL('../check/check.worker.ts', import.meta.url), { type: 'module' }));
      worker.onmessage = (ev: MessageEvent<CheckResponse>) => this.onMessage(ev.data);
      worker.onerror = (ev: ErrorEvent) => this.fail(ev.message || 'worker error');
      this.worker = worker;
      this.phase = 'running';
      this.done = 0;
      this.total = 0;
      worker.postMessage({
        type: 'start',
        base: new URL(rootOf(), location.href).href,
        region: this.region,
        season: this.season,
        horizon: this.horizon,
      });
    },
    onMessage(msg: CheckResponse): void {
      if (msg.type === 'progress') {
        this.done = msg.done;
        this.total = msg.total;
      } else if (msg.type === 'result') {
        this.result = msg.result;
        this.phase = 'done';
        this.terminate();
      } else {
        this.fail(msg.message);
      }
    },
    fail(message: string): void {
      this.phase = 'error';
      this.errorMessage = this.$t('pages.check.errors.failed', { message });
      this.terminate();
    },
    cancel(): void {
      this.terminate();
      this.phase = 'cancelled';
    },
    terminate(): void {
      this.worker?.terminate();
      this.worker = null;
    },
    fieldError(f: SelectionField): string {
      return this.$t(`pages.check.errors.${f}`);
    },
  },
  beforeUnmount() {
    this.terminate();
  },
});
</script>

<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-2xl font-bold">{{ $t('pages.check.heading') }}</h1>
      <p class="mt-2 max-w-3xl">{{ $t('pages.check.intro') }}</p>
    </header>

    <p class="cf-card text-sm" data-testid="honesty-note">{{ $t('pages.check.note') }}</p>

    <form class="cf-card grid gap-4 sm:grid-cols-3" novalidate @submit.prevent="start">
      <div>
        <label for="check-region" class="block text-sm font-medium">{{ $t('pages.check.form.region') }}</label>
        <select
          id="check-region"
          v-model="region"
          class="mt-1 w-full rounded border border-[var(--cf-border)] bg-[var(--cf-surface)] p-2"
          :aria-invalid="errors.includes('region') ? 'true' : undefined"
          aria-describedby="check-err-region"
        >
          <option value="">{{ $t('pages.check.form.placeholder') }}</option>
          <option v-for="r in regionOptions" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
        <p v-if="errors.includes('region')" id="check-err-region" class="mt-1 text-sm text-[var(--cf-high)]">{{ fieldError('region') }}</p>
      </div>

      <div>
        <label for="check-season" class="block text-sm font-medium">{{ $t('pages.check.form.season') }}</label>
        <select
          id="check-season"
          v-model="season"
          class="mt-1 w-full rounded border border-[var(--cf-border)] bg-[var(--cf-surface)] p-2"
          :aria-invalid="errors.includes('season') ? 'true' : undefined"
          aria-describedby="check-err-season"
        >
          <option value="">{{ $t('pages.check.form.placeholder') }}</option>
          <option v-for="s in seasonOptions" :key="s" :value="s">{{ s }}</option>
        </select>
        <p v-if="errors.includes('season')" id="check-err-season" class="mt-1 text-sm text-[var(--cf-high)]">{{ fieldError('season') }}</p>
      </div>

      <div>
        <label for="check-horizon" class="block text-sm font-medium">{{ $t('pages.check.form.horizon') }}</label>
        <select
          id="check-horizon"
          v-model.number="horizon"
          class="mt-1 w-full rounded border border-[var(--cf-border)] bg-[var(--cf-surface)] p-2"
          :aria-invalid="errors.includes('horizon') ? 'true' : undefined"
          aria-describedby="check-err-horizon"
        >
          <option v-for="h in horizonOptions" :key="h" :value="h">{{ $t(`pages.check.form.horizon${h}`) }}</option>
        </select>
        <p v-if="errors.includes('horizon')" id="check-err-horizon" class="mt-1 text-sm text-[var(--cf-high)]">{{ fieldError('horizon') }}</p>
      </div>

      <div class="sm:col-span-3">
        <button
          type="submit"
          class="rounded bg-[var(--cf-accent)] px-4 py-2 font-medium text-[var(--cf-accent-text)] disabled:opacity-60"
          :disabled="running"
        >{{ $t('pages.check.form.submit') }}</button>
      </div>
    </form>

    <div v-if="errors.length > 0" class="cf-card border-[var(--cf-high)]" role="alert">
      <p class="font-medium">{{ $t('pages.check.errors.title') }}</p>
      <ul class="mt-1 list-disc pl-5 text-sm">
        <li v-for="f in errors" :key="f">{{ fieldError(f) }}</li>
      </ul>
    </div>

    <CheckProgress v-if="running" :done="done" :total="total" @cancel="cancel" />

    <p v-if="phase === 'cancelled'" role="status" class="cf-muted">{{ $t('pages.check.progress.cancelled') }}</p>
    <p v-if="phase === 'error'" role="alert" class="cf-card text-[var(--cf-high)]">{{ errorMessage }}</p>

    <CheckResults v-if="phase === 'done' && result" :result="result" :locale="ctx.locale" />
  </div>
</template>
