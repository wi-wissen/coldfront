import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CheckPage from '../src/pages/CheckPage.vue';
import { createCfI18n } from '../src/i18n/setup';
import { EMPTY_DATA, type Locale, type PageContext } from '../src/types';
import type { CheckResult } from '../src/check/compute';
import type { CheckRequest, CheckResponse } from '../src/check/protocol';

/** Stub of the module worker: records messages and lets the test emit responses. */
class FakeWorker {
  static instances: FakeWorker[] = [];
  posted: CheckRequest[] = [];
  terminated = false;
  onmessage: ((ev: MessageEvent<CheckResponse>) => void) | null = null;
  onerror: ((ev: ErrorEvent) => void) | null = null;
  constructor(_url: URL, _opts?: WorkerOptions) {
    FakeWorker.instances.push(this);
  }
  postMessage(msg: CheckRequest): void {
    this.posted.push(msg);
  }
  terminate(): void {
    this.terminated = true;
  }
  emit(data: CheckResponse): void {
    this.onmessage?.({ data } as MessageEvent<CheckResponse>);
  }
}

const result: CheckResult = {
  region: 'de-sn',
  season: '2024/25',
  horizon: 2,
  models: ['baseline-seasonal', 'persistence', 'regional-model', 'ensemble'],
  metrics: {
    'baseline-seasonal': { n: 52, mae: 307.1, wis: 230.8, coverage50: 0.35, coverage80: 0.5 },
    persistence: { n: 52, mae: 327.4, wis: 245.4, coverage50: 0.44, coverage80: 0.79 },
    'regional-model': { n: 52, mae: 280, wis: 200, coverage50: 0.5, coverage80: 0.8 },
    ensemble: { n: 52, mae: 272.1, wis: 194.1, coverage50: 0.56, coverage80: 0.77 },
  },
  improvementVsBaseline: 0.159,
  chart: [
    { iso_week: '2024-W42', actual: 900, q10: 500, q25: 600, q50: 700, q75: 800, q90: 900 },
    { iso_week: '2024-W43', actual: null, q10: 600, q25: 700, q50: 800, q75: 900, q90: 1000 },
    { iso_week: '2024-W44', actual: 1100, q10: 700, q25: 800, q50: 900, q75: 1000, q90: 1100 },
  ],
  computeMs: 17832,
  refitEvery: 4,
};

function ctx(locale: Locale): PageContext {
  return { entry: { page: 'check', locale, path: locale === 'de' ? 'check.html' : 'en/check.html' }, locale, data: EMPTY_DATA };
}

function mountPage(locale: Locale = 'de') {
  return mount(CheckPage, { props: { ctx: ctx(locale) }, global: { plugins: [createCfI18n(locale)] }, attachTo: document.body });
}

async function fillAndSubmit(w: ReturnType<typeof mountPage>) {
  await w.find('#check-region').setValue('de-sn');
  await w.find('#check-season').setValue('2024/25');
  await w.find('#check-horizon').setValue('2');
  await w.find('form').trigger('submit');
}

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('CheckPage (de)', () => {
  it('renders the initial form with the honesty note and no worker', () => {
    const w = mountPage('de');
    expect(w.find('h1').text()).toBe('Selbst prüfen');
    expect(w.find('#check-region').exists()).toBe(true);
    expect(w.findAll('#check-region option')).toHaveLength(18); // placeholder + 17 regions
    expect(w.findAll('#check-season option')).toHaveLength(4);
    expect(w.findAll('#check-horizon option')).toHaveLength(4);
    expect(w.find('[data-testid="honesty-note"]').text()).toContain('nachträglich korrigierten Daten');
    expect(w.find('button[type="submit"]').text()).toBe('Nachrechnen');
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it('validates the selection and creates no worker when invalid', async () => {
    const w = mountPage('de');
    await w.find('form').trigger('submit');
    const alert = w.find('[role="alert"]');
    expect(alert.text()).toContain('Bitte wählen Sie eine Region.');
    expect(alert.text()).toContain('Bitte wählen Sie eine Saison.');
    expect(w.find('#check-region').attributes('aria-invalid')).toBe('true');
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it('starts the worker with the site base URL and renders progress', async () => {
    const w = mountPage('de');
    await fillAndSubmit(w);
    expect(FakeWorker.instances).toHaveLength(1);
    const worker = FakeWorker.instances[0]!;
    expect(worker.posted[0]).toMatchObject({ type: 'start', region: 'de-sn', season: '2024/25', horizon: 2 });
    expect(worker.posted[0]!.base).toMatch(/^https?:\/\//);

    worker.emit({ type: 'progress', done: 3, total: 10 });
    await w.vm.$nextTick();
    expect(w.find('progress').attributes('value')).toBe('3');
    expect(w.find('progress').attributes('max')).toBe('10');
    expect(w.find('[aria-live="polite"]').text()).toContain('3 von 10');
  });

  it('renders the result with chart, metrics table and verdict', async () => {
    const w = mountPage('de');
    await fillAndSubmit(w);
    FakeWorker.instances[0]!.emit({ type: 'result', result });
    await w.vm.$nextTick();
    expect(w.find('svg[role="img"]').exists()).toBe(true);
    expect(w.findAll('table')).toHaveLength(2); // metrics + chart data table
    expect(w.find('[data-testid="verdict"]').text()).toBe('Das Modell war über diese Saison im Mittel 16 % besser als die saisonale Baseline.');
    expect(w.text()).toContain('Veröffentlichtes Modell (Ensemble)');
    expect(w.text()).toContain('Sachsen');
    expect(FakeWorker.instances[0]!.terminated).toBe(true);
  });

  it('shows worker errors and allows cancelling', async () => {
    const w = mountPage('de');
    await fillAndSubmit(w);
    FakeWorker.instances[0]!.emit({ type: 'error', message: 'GET series.json -> 404' });
    await w.vm.$nextTick();
    expect(w.find('[role="alert"]').text()).toContain('GET series.json -> 404');

    await fillAndSubmit(w);
    await w.find('button:not([type="submit"])').trigger('click');
    expect(FakeWorker.instances[1]!.terminated).toBe(true);
    expect(w.find('[role="status"]').text()).toBe('Die Berechnung wurde abgebrochen.');
  });
});

describe('CheckPage (en)', () => {
  it('renders English labels and the English honesty note', async () => {
    const w = mountPage('en');
    expect(w.find('h1').text()).toBe('Check it yourself');
    expect(w.find('[data-testid="honesty-note"]').text()).toContain('today’s data');
    await fillAndSubmit(w);
    FakeWorker.instances[0]!.emit({ type: 'result', result });
    await w.vm.$nextTick();
    expect(w.find('[data-testid="verdict"]').text()).toBe('Over this season, the model was on average 16 % better than the seasonal baseline.');
    expect(w.text()).toContain('Saxony');
  });
});
