import { mount } from '@vue/test-utils';
import type { BacktestPublic, MetricSummary, TuningPublic } from '@coldfront/forecast-core';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { createCfApp } from '../src/app';
import { createCfI18n } from '../src/i18n/setup';
import MethodPage from '../src/pages/MethodPage.vue';
import type { Locale, PageContext, PageData } from '../src/types';
import { EMPTY_DATA } from '../src/types';

// Test fixture only (not published). Shapes follow BacktestPublic / TuningPublic; keys match pipeline output.
const MODELS = ['baseline-seasonal', 'persistence', 'regional-model', 'ensemble'];

function summary(mae: number, wis: number, n = 1200): MetricSummary {
  return { n, mae, wis, coverage50: 0.45, coverage80: 0.8 };
}
function perModel(scale: number): Record<string, MetricSummary> {
  return {
    'baseline-seasonal': summary(14.2 * scale, 21.5 * scale, 300),
    persistence: summary(16.8 * scale, 25.1 * scale, 300),
    'regional-model': summary(13.1 * scale, 19.9 * scale, 300),
    ensemble: summary(12.9 * scale, 18.7 * scale, 300),
  };
}

const BACKTEST: BacktestPublic = {
  generated: '2026-10-13T00:00:00Z',
  season: '2025/26',
  model_choice: { candidate: 'dyn-season-holiday', groups: ['dynamics', 'season', 'holiday'], spread_factor: 1.35 },
  models: MODELS,
  overall: {
    'baseline-seasonal': summary(14.2, 21.5),
    persistence: summary(16.8, 25.1),
    'regional-model': summary(13.1, 19.9),
    ensemble: summary(12.9, 18.7),
  },
  by_region: { de: perModel(1), 'de-sn': perModel(1.1) },
  by_horizon: { h1: perModel(0.6), h2: perModel(0.9), h3: perModel(1.2), h4: perModel(1.5) },
  by_phase: { low: perModel(0.3), rise: perModel(1.1), peak: perModel(1.8), decline: perModel(0.9) },
  comparisons: {
    'ensemble vs baseline-seasonal': { meanDiff: -2.8, relImprovement: 0.123, ci95: [-4.1, -1.5], seasonsBetter: 2, seasonsTotal: 3, n: 1200 },
    'ensemble vs persistence': null,
    'regional-model vs baseline-seasonal': { meanDiff: -1.6, relImprovement: 0.074, ci95: [-2.9, -0.3], seasonsBetter: 2, seasonsTotal: 3, n: 1200 },
  },
  peak: {
    'baseline-seasonal': { n: 12, median_abs_timing_weeks: 2, mean_height_rel: 0.21 },
    persistence: { n: 12, median_abs_timing_weeks: 1, mean_height_rel: -0.08 },
    'regional-model': { n: 12, median_abs_timing_weeks: 1.5, mean_height_rel: 0.12 },
    ensemble: { n: 12, median_abs_timing_weeks: 1, mean_height_rel: 0.09 },
  },
  gate: {
    shipped: 'ensemble',
    rel_wis_improvement: 0.123,
    threshold: 0.1,
    reason: 'Ensemble WIS is 12.3 % below the seasonal baseline on the untouched test season (threshold 10 %).',
  },
};

const TUNING: TuningPublic = {
  chosen: { candidate: 'dyn-season-holiday', groups: ['dynamics', 'season', 'holiday'], spread_factor: 1.35 },
  tuned_on: ['2023/24', '2024/25'],
  candidates: [
    { name: 'dyn', groups: ['dynamics'], wis_ensemble: 205.62, wis_model: 237.65, n: 6976 },
    { name: 'dyn-season-holiday', groups: ['dynamics', 'season', 'holiday'], wis_ensemble: 194.04, wis_model: 187.77, n: 6976 },
  ],
  baseline_wis: 269.15,
  persistence_wis: 254.99,
  spread_grid: [
    { k: 1, wis: 194.04, coverage80: 0.63, coverage50: 0.38 },
    { k: 1.35, wis: 191.19, coverage80: 0.77, coverage50: 0.49 },
  ],
};

function ctxFor(locale: Locale, data: Partial<PageData> = {}): PageContext {
  return {
    entry: { page: 'method', locale, path: locale === 'de' ? 'method.html' : 'en/method.html' },
    locale,
    data: { ...EMPTY_DATA, ...data },
  };
}

function mountPage(locale: Locale, data: Partial<PageData> = {}) {
  return mount(MethodPage, { props: { ctx: ctxFor(locale, data) }, global: { plugins: [createCfI18n(locale)] } });
}

function table(w: ReturnType<typeof mountPage>, caption: string) {
  const t = w.findAll('table').find((x) => x.find('caption').text() === caption);
  if (!t) throw new Error(`no table with caption ${caption}`);
  return t;
}

const GERMAN_WORDS = /\b(und|der|die|das|für|Methode|Ergebnisse|Grenzen|Auswahl|Gesamtergebnis|Nach|Gipfelfehler|Merkmale)\b/;

describe('MethodPage', () => {
  it('renders the German headings with the results and the limits', () => {
    const w = mountPage('de', { backtest: BACKTEST, tuning: TUNING });
    expect(w.find('h1').text()).toBe('Methode und Auswertung');
    const h2 = w.findAll('h2').map((h) => h.text());
    expect(h2).toEqual([
      'Was prognostiziert wird',
      'Die Modelle',
      'Merkmalsgruppen',
      'Warum keine Prognose für die ganze Saison',
      'Auswertungsprotokoll',
      'Ergebnisse der Testsaison',
      'Auswahl der Merkmale (Tuning)',
      'Grenzen',
    ]);
    const h3 = w.findAll('h3').map((h) => h.text());
    expect(h3).toEqual(expect.arrayContaining(['Veröffentlichungsentscheidung', 'Vergleiche mit Unsicherheit', 'Nach Wellenphase']));
  });

  it('renders the overall table with one row per model and locale-specific numbers', () => {
    const de = mountPage('de', { backtest: BACKTEST }).findAll('table').find((x) => x.find('caption').text() === 'Gesamtergebnis je Modell')!;
    expect(de.findAll('tbody tr')).toHaveLength(4);
    expect(de.text()).toContain('18,70');
    expect(de.text()).toContain('Ensemble');
    const en = table(mountPage('en', { backtest: BACKTEST }), 'Overall result per model');
    expect(en.findAll('tbody tr')).toHaveLength(4);
    expect(en.text()).toContain('18.70');
    expect(en.text()).toContain('80.0%');
  });

  it('composes the gate sentence from the numbers, not the English reason', () => {
    const de = mountPage('de', { backtest: BACKTEST }).find('p.cf-card').text();
    expect(de).toMatch(/Ausgeliefert wird das Ensemble/);
    expect(de).toMatch(/12,3\s%/);
    expect(de).not.toContain('untouched');
    const en = mountPage('en', { backtest: BACKTEST }).find('p.cf-card').text();
    expect(en).toMatch(/The ensemble is shipped/);
    expect(en).toMatch(/12\.3%/);
  });

  it('shows the baseline fallback sentence when no comparison value exists', () => {
    const bt = { ...BACKTEST, gate: { ...BACKTEST.gate, shipped: 'baseline' as const, rel_wis_improvement: null } };
    const text = mountPage('de', { backtest: bt }).find('p.cf-card').text();
    expect(text).toBe('Ausgeliefert wird die Saisonbaseline, weil kein Vergleichswert vorliegt.');
  });

  it('renders comparisons with interval, seasons won and a dash for missing comparisons', () => {
    const t = table(mountPage('de', { backtest: BACKTEST }), 'Vergleiche mit 95-%-Intervall');
    const rows = t.findAll('tbody tr').map((r) => r.text());
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('Ensemble gegen Saisonbaseline');
    expect(rows[0]).toContain('von -4,10 bis -1,50');
    expect(rows[0]).toContain('2 von 3');
    expect(rows[1]).toContain('Ensemble gegen Persistenz');
    expect(rows[1]).toContain('–');
  });

  it('renders the phase and horizon tables with WIS per model', () => {
    const phase = table(mountPage('en', { backtest: BACKTEST }), 'WIS by wave phase');
    expect(phase.findAll('tbody tr').map((r) => r.find('th').text())).toEqual(['low', 'rise', 'peak', 'decline']);
    const hz = table(mountPage('de', { backtest: BACKTEST }), 'WIS nach Prognosehorizont');
    expect(hz.findAll('tbody tr')).toHaveLength(4);
    expect(hz.findAll('tbody th').map((th) => th.text())).toEqual(['1', '2', '3', '4']);
  });

  it('marks the chosen candidate and spread factor in the tuning tables', () => {
    const w = mountPage('de', { backtest: BACKTEST, tuning: TUNING });
    const cand = table(w, 'Kandidaten der Merkmalsgruppen');
    expect(cand.findAll('tbody tr')).toHaveLength(2);
    expect(cand.text()).toContain('(gewählt)');
    expect(cand.text()).toContain('Dynamik, Saison, Ferien');
    const spread = table(w, 'Verbreiterungsfaktor k im Tuning');
    expect(spread.findAll('tbody tr')).toHaveLength(2);
    expect(spread.text()).toMatch(/1,35\s+\(gewählt\)/);
  });

  it('shows the evaluation-not-available message when the backtest is null', () => {
    const w = mountPage('de', { backtest: null, tuning: null });
    expect(w.text()).toContain('Die Auswertung der Testsaison ist noch nicht verfügbar.');
    expect(w.text()).toContain('Die Ergebnisse des Tunings sind noch nicht verfügbar.');
    expect(w.findAll('table')).toHaveLength(1); // only the feature group table
  });

  it('gives every table a caption and a source line', () => {
    const w = mountPage('de', { backtest: BACKTEST, tuning: TUNING });
    const tables = w.findAll('table');
    expect(tables.length).toBeGreaterThanOrEqual(9);
    for (const t of tables) {
      expect(t.find('caption').text().length).toBeGreaterThan(0);
    }
    const sourceLines = w.findAll('figcaption').filter((f) => f.text().startsWith('Quelle: eigene Berechnung auf Daten des Robert Koch-Instituts'));
    expect(sourceLines.length).toBeGreaterThanOrEqual(8);
  });

  it('keeps German text out of the English headings', () => {
    const w = mountPage('en', { backtest: BACKTEST, tuning: TUNING });
    const headings = w.findAll('h1, h2, h3').map((h) => h.text());
    expect(headings.length).toBeGreaterThan(10);
    for (const h of headings) expect(h).not.toMatch(GERMAN_WORDS);
    expect(w.find('h1').text()).toBe('Method and evaluation');
  });

  it('contains no mention of schools', () => {
    const w = mountPage('de', { backtest: BACKTEST, tuning: TUNING });
    expect(w.text().toLowerCase()).not.toMatch(/schul|school/);
  });

  it('is prerendered with its heading (server renderer through createCfApp)', async () => {
    const html = await renderToString(createCfApp(ctxFor('de', { backtest: BACKTEST, tuning: TUNING })));
    expect(html).toContain('Methode und Auswertung');
    expect(html).toContain('Ergebnisse der Testsaison');
    const en = await renderToString(createCfApp(ctxFor('en', { backtest: null, tuning: null })));
    expect(en).toContain('Method and evaluation');
    expect(en).toContain('not available yet');
  });
});
