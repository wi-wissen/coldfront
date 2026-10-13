import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mount } from '@vue/test-utils';
import type { BacktestPublic, ExternalPublic, MetricSummary, TuningPublic, VintagePublic } from '@coldfront/forecast-core';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { createCfApp } from '../src/app';
import { createCfI18n } from '../src/i18n/setup';
import MethodPage from '../src/pages/MethodPage.vue';
import type { Locale, PageContext, PageData } from '../src/types';
import { EMPTY_DATA } from '../src/types';

// Real published files (no copies of results in the test).
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = <T>(rel: string): T => JSON.parse(readFileSync(resolve(REPO, rel), 'utf8')) as T;
const BACKTEST = read<BacktestPublic>('forecasts/backtest/test.json');
const BACKTEST_V1 = read<BacktestPublic>('forecasts/backtest/test-v1.json');
const TUNING = read<TuningPublic>('forecasts/backtest/tuning.json');
const EXTERNAL = read<ExternalPublic>('forecasts/backtest/external.json');
const VINTAGE_FILE = resolve(REPO, 'forecasts/backtest/vintage.json');
const REAL_VINTAGE = existsSync(VINTAGE_FILE) ? (JSON.parse(readFileSync(VINTAGE_FILE, 'utf8')) as VintagePublic) : null;

function summary(wis: number): MetricSummary {
  return { n: 100, mae: wis * 1.4, wis, coverage50: 0.5, coverage80: 0.8 };
}
/** Small synthetic vintage fixture (shape of VintagePublic), independent of the background job. */
const VINTAGE_FIXTURE: VintagePublic = {
  generated: '2026-10-13',
  note: 'fixture',
  seasons: {
    '2023/24': {
      seasons: ['2023/24'],
      origins_total: 40,
      origins_vintage: 30,
      origins_fallback: 10,
      n_cells: 640,
      models: { ensemble: { final: summary(100), vintage: summary(110), rel_degradation: 0.1 }, persistence: { final: summary(200), vintage: summary(190), rel_degradation: -0.05 } },
      comparisons: { final: {}, vintage: {} },
    },
  },
};

function ctxFor(locale: Locale, data: Partial<PageData> = {}): PageContext {
  return {
    entry: { page: 'method', locale, path: locale === 'de' ? 'method.html' : 'en/method.html' },
    locale,
    data: { ...EMPTY_DATA, ...data },
  };
}

const ALL: Partial<PageData> = { backtest: BACKTEST, backtestV1: BACKTEST_V1, tuning: TUNING, external: EXTERNAL, vintage: VINTAGE_FIXTURE };

function mountPage(locale: Locale, data: Partial<PageData> = ALL) {
  return mount(MethodPage, { props: { ctx: ctxFor(locale, data) }, global: { plugins: [createCfI18n(locale)] } });
}

function table(w: ReturnType<typeof mountPage>, caption: string | RegExp) {
  const t = w.findAll('table').find((x) => {
    const c = x.find('caption').text();
    return typeof caption === 'string' ? c === caption : caption.test(c);
  });
  if (!t) throw new Error(`no table with caption ${caption}`);
  return t;
}

const de = (v: number, d = 2) => new Intl.NumberFormat('de', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
const GERMAN_WORDS = /\b(und|der|die|das|für|Methode|Ergebnisse|Grenzen|Auswahl|Gesamtergebnis|Nach|Gipfelzeitpunkt|Merkmale)\b/;

describe('MethodPage', () => {
  it('uses protocol version 2 data for the results', () => {
    expect(BACKTEST.protocol_version).toBe(2);
  });

  it('renders the German headings in order', () => {
    const w = mountPage('de');
    expect(w.find('h1').text()).toBe('Methode und Auswertung');
    expect(w.findAll('h2').map((h) => h.text())).toEqual([
      'Was prognostiziert wird',
      'Die Modelle',
      'Merkmalsgruppen',
      'Warum keine Prognose für die ganze Saison',
      'Auswertungsprotokoll',
      'Ergebnisse (Protokoll Version 2)',
      'Auswahl der Merkmale, des Gewichts und der Verbreiterung (Tuning)',
      'Echte Datenstände',
      'Vergleich mit anderen Prognosen (national)',
      'Laufende Überprüfung',
      'Grenzen',
    ]);
    const h3 = w.findAll('h3').map((h) => h.text());
    expect(h3).toEqual(
      expect.arrayContaining(['Änderung des Protokolls (Version 2)', 'Veröffentlichungsentscheidung', 'Vergleiche mit Unsicherheit', 'Nach Wellenphase', 'Gipfelzeitpunkt']),
    );
    expect(w.find('#m-amendment').exists()).toBe(true);
  });

  it('shows the notice box in the results section before any table, saying plainly that the season is no longer untouched', () => {
    const w = mountPage('de');
    const notice = w.find('[data-test="notice"]');
    expect(notice.exists()).toBe(true);
    expect(notice.text()).toContain('beschreibende Neuauswertung');
    expect(notice.text()).toContain('kein unabhängiger Test');
    expect(notice.text()).toContain('2026/27');
    expect(notice.text()).toContain('2027-W39');
    const html = w.html();
    expect(html.indexOf('data-test="notice"')).toBeLessThan(html.indexOf('<table', html.indexOf('id="m-results"')));
    const en = mountPage('en').find('[data-test="notice"]').text();
    expect(en).toContain('descriptive re-evaluation');
    expect(en).toContain('2026/27');
  });

  it('lets "untouched" describe only version 1 and season 2026/27', () => {
    for (const locale of ['de', 'en'] as const) {
      const text = mountPage(locale).text();
      const re = locale === 'de' ? /[^.]*unberührt[^.]*\./g : /[^.]*untouched[^.]*\./g;
      for (const sentence of text.match(re) ?? []) {
        expect(sentence).toMatch(/Protokoll|protocol|2026\/27|Version 1|version 1|damals|at that time/);
      }
    }
  });

  it('renders v1 and v2 side by side with dashes for the models that did not exist under v1', () => {
    const t = table(mountPage('de'), /^Gesamtergebnis je Modell: erstes Protokoll/);
    const heads = t.findAll('thead th').map((h) => h.text());
    expect(heads).toContain('WIS (v1)');
    expect(heads).toContain('WIS (v2)');
    const rows = t.findAll('tbody tr');
    expect(rows).toHaveLength(BACKTEST.models.length);
    const byLabel = Object.fromEntries(rows.map((r) => [r.find('th').text(), r.findAll('td').map((c) => c.text())]));
    const calendar = byLabel['Saisonbaseline (kalenderbereinigt)']!;
    expect(calendar[0]).toBe('–'); // WIS v1
    expect(calendar[1]).toBe(de(BACKTEST.overall['baseline-seasonal']!.wis));
    const plain = byLabel['Saisonbaseline (einfach)']!;
    expect(plain[0]).toBe(de(BACKTEST_V1.overall['baseline-seasonal']!.wis));
    expect(plain[1]).toBe(de(BACKTEST.overall['baseline-plain']!.wis));
    const ens = byLabel['Ensemble']!;
    expect(ens[0]).toBe(de(BACKTEST_V1.overall['ensemble']!.wis));
    expect(ens[1]).toBe(de(BACKTEST.overall['ensemble']!.wis));
  });

  it('formats numbers with the locale of the page', () => {
    const en = table(mountPage('en'), /^Overall result per model: first protocol/);
    expect(en.text()).toContain(new Intl.NumberFormat('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(BACKTEST.overall['ensemble']!.wis));
  });

  it('composes the gate sentence from the numbers, not the English reason', () => {
    const gate = BACKTEST.gate;
    const pct = (v: number, d: number, loc: string) => new Intl.NumberFormat(loc, { style: 'percent', minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
    const t = mountPage('de').find('[data-test="gate"]').text();
    expect(t).toContain(gate.shipped === 'ensemble' ? 'Ausgeliefert wird das Ensemble' : 'Ausgeliefert wird die kalenderbereinigte Saisonbaseline');
    expect(t).toContain(pct(gate.rel_wis_improvement!, 1, 'de'));
    expect(t).toContain(pct(gate.threshold, 0, 'de'));
    expect(t).not.toContain(gate.reason);
    const en = mountPage('en').find('[data-test="gate"]').text();
    expect(en).toContain(pct(gate.rel_wis_improvement!, 1, 'en'));
  });

  it('shows the baseline fallback sentence when no comparison value exists', () => {
    const bt = { ...BACKTEST, gate: { ...BACKTEST.gate, shipped: 'baseline' as const, rel_wis_improvement: null } };
    const text = mountPage('de', { ...ALL, backtest: bt }).find('[data-test="gate"]').text();
    expect(text).toBe('Ausgeliefert wird die kalenderbereinigte Saisonbaseline, weil kein Vergleichswert vorliegt.');
  });

  it('renders every comparison with interval and seasons won, and states that one season is a thin basis', () => {
    const w = mountPage('de');
    const t = table(w, 'Vergleiche mit 95-%-Intervall');
    const rows = t.findAll('tbody tr').map((r) => r.text());
    expect(rows).toHaveLength(Object.keys(BACKTEST.comparisons).length);
    const c = BACKTEST.comparisons['ensemble vs baseline-seasonal']!;
    const row = rows.find((r) => r.startsWith('Ensemble gegen kalenderbereinigte Saisonbaseline'))!;
    expect(row).toContain(`von ${de(c.ci95[0])} bis ${de(c.ci95[1])}`);
    expect(row).toContain(`${c.seasonsBetter} von ${c.seasonsTotal}`);
    expect(w.text()).toContain('Eine Saison ist eine dünne Basis');
  });

  it('renders the phase and horizon tables with all five models', () => {
    const phase = table(mountPage('en'), 'WIS by wave phase');
    expect(phase.findAll('tbody tr').map((r) => r.find('th').text())).toEqual(['low', 'rise', 'peak', 'decline']);
    expect(phase.findAll('thead th')).toHaveLength(1 + BACKTEST.models.length);
    const hz = table(mountPage('de'), 'WIS nach Prognosehorizont');
    expect(hz.findAll('tbody th').map((th) => th.text())).toEqual(['1', '2', '3', '4']);
  });

  it('lists Germany first in the region table, highlighted, with the gain of the ensemble over the baseline', () => {
    const w = mountPage('de');
    const t = table(w, 'WIS nach Region, einschließlich Deutschland insgesamt');
    const rows = t.findAll('tbody tr');
    expect(rows).toHaveLength(Object.keys(BACKTEST.by_region).length);
    expect(rows[0]!.find('th').text()).toContain('Deutschland');
    expect(rows[0]!.find('th').text()).toContain('(national)');
    expect(rows[0]!.classes()).toContain('cf-row-national');
    const nat = BACKTEST.by_region['de']!;
    const gain = 1 - nat['ensemble']!.wis / nat['baseline-seasonal']!.wis;
    const expected = new Intl.NumberFormat('de', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(gain);
    expect(rows[0]!.findAll('td').at(-1)!.text()).toBe(expected);
    expect(t.findAll('thead th').at(-1)!.text()).toBe('Ensemble gegenüber Baseline');
    expect(w.find('[data-test="region-summary"]').text()).toContain('national');
  });

  it('explains peak timing and reads the weak horizons from the data', () => {
    const w = mountPage('de');
    const text = w.text();
    expect(text).toContain('Kalenderwoche 45 bis Kalenderwoche 15');
    expect(text).toContain('zentrierten Drei-Wochen-Mittels');
    expect(text).toContain('etwa h Wochen zurück');
    expect(text).toContain('war fehlerhaft');
    const e = BACKTEST.peak['ensemble']!.by_horizon!;
    const honest = w.find('[data-test="peak-honest"]').text();
    expect(honest).toContain(new Intl.NumberFormat('de', { style: 'percent', maximumFractionDigits: 0 }).format(e['h1']!.within_one_week_share));
    const later = ['h2', 'h3', 'h4'].map((h) => e[h]!.median_abs_timing_weeks);
    expect(honest).toContain(`zwischen ${Math.min(...later)} und ${Math.max(...later)} Wochen`);
    expect(honest).toContain('echte Schwäche');
    const timing = table(w, /^Median des absoluten Gipfel-Zeitfehlers/);
    expect(timing.findAll('thead th')).toHaveLength(5);
    expect(timing.findAll('tbody tr')).toHaveLength(Object.keys(BACKTEST.peak).length);
    const within = table(w, /^Anteil der Gipfel innerhalb/);
    expect(within.text()).toContain('%');
  });

  it('shows weight and factor per tuning candidate and marks the chosen one', () => {
    const w = mountPage('de');
    const cand = table(w, 'Kandidaten der Merkmalsgruppen mit ihrem besten Gewicht und Faktor');
    expect(cand.findAll('tbody tr')).toHaveLength(TUNING.candidates.length);
    expect(cand.text()).toContain('(gewählt)');
    expect(cand.text()).toContain('Dynamik, Saison, Ferien');
    expect(cand.findAll('thead th').map((h) => h.text())).toEqual(expect.arrayContaining(['Gewicht regionales Modell', 'Faktor k']));
    const spread = table(w, 'Verbreiterungsfaktor k im Tuning (gewählter Kandidat)');
    expect(spread.findAll('tbody tr')).toHaveLength(TUNING.spread_grid.length);
    expect(spread.text()).toMatch(new RegExp(`${de(TUNING.chosen.spread_factor)}\\s+\\(gewählt\\)`));
    expect(w.text()).toContain(de(TUNING.baseline_plain_wis!));
  });

  it('renders the data-version comparison with relative degradation, or a placeholder when missing', () => {
    const t = table(mountPage('de'), 'WIS mit heute korrigierten Daten und mit den damaligen Datenständen');
    expect(t.text()).toContain('2023/24: 30 von 40 Ausgangspunkten');
    expect(t.text()).toMatch(/\+10,0\s%/);
    expect(t.text()).toMatch(/[-\u2212]5,0\s%/);
    const w = mountPage('de', { ...ALL, vintage: null });
    expect(w.text()).toContain('wird berechnet');
    expect(mountPage('en', { ...ALL, vintage: null }).text()).toContain('not available yet');
    // the note about unchanged actuals is German prose, not the English file note
    expect(mountPage('de').text()).toContain('die heute korrigierten Werte');
  });

  it('renders the real vintage file when it exists', () => {
    if (!REAL_VINTAGE) return;
    const w = mountPage('de', { ...ALL, vintage: REAL_VINTAGE });
    const t = table(w, 'WIS mit heute korrigierten Daten und mit den damaligen Datenständen');
    const models = Object.values(REAL_VINTAGE.seasons).reduce((n, s) => n + Object.keys(s.models).length, 0);
    expect(t.findAll('tbody tr[class], tbody tr').length).toBe(models + Object.keys(REAL_VINTAGE.seasons).length);
    expect(t.text()).not.toContain('NaN');
    expect(t.text()).not.toContain(REAL_VINTAGE.note);
  });

  it('renders the external comparison without the prefix, marked external, with attribution and the caveats', () => {
    const w = mountPage('de');
    const core = EXTERNAL.panels['core']!;
    const t = table(w, 'Gesamtergebnis im Vergleich mit externen Prognosen (national, gemeinsame Zellen)');
    expect(t.findAll('tbody tr')).toHaveLength(core.models.length);
    expect(t.text()).toContain('KIT-LightGBM (extern)');
    expect(t.text()).not.toContain('respinow:');
    const cmp = table(w, 'Ensemble gegen externe Prognosen, WIS-Differenz mit 95-%-Intervall');
    const nExt = Object.keys(core.comparisons).filter((k) => k.startsWith('ensemble vs respinow:')).length;
    expect(cmp.findAll('tbody tr')).toHaveLength(nExt);
    expect(w.text()).toContain('Bewertete Zellen je Saison: 2024/25: 88; 2025/26: 68');
    const attr = w.find('[data-test="external-attribution"]');
    expect(attr.find('a[href="https://github.com/KITmetricslab/RESPINOW-Hub"]').exists()).toBe(true);
    expect(attr.text()).toContain('MIT');
    expect(w.text()).toContain('RespiCast war nicht erreichbar');
    expect(w.text()).toContain('kein fairer Wettbewerb');
    expect(w.text()).not.toContain('respinow:');
  });

  it('shows placeholders when optional data is missing', () => {
    const w = mountPage('de', { backtest: null, tuning: null, external: null, vintage: null });
    expect(w.text()).toContain('Die Auswertung der Testsaison ist noch nicht verfügbar.');
    expect(w.text()).toContain('Die Ergebnisse des Tunings sind noch nicht verfügbar.');
    expect(w.text()).toContain('Der Vergleich mit externen Prognosen ist noch nicht verfügbar.');
    expect(w.findAll('table')).toHaveLength(1); // only the feature group table
    expect(w.find('[data-test="notice"]').exists()).toBe(true);
  });

  it('describes the live monitor and lists the updated limits', () => {
    const w = mountPage('de');
    expect(w.text()).toContain('ersetzt die Baseline');
    const limits = w.find('section[aria-labelledby="m-limits"]').text();
    expect(limits).toContain('nur für die nationale Ebene');
    expect(limits).toContain('Gipfelzeitpunkt');
    expect(limits).toContain('Erstveröffentlichungen');
    expect(limits).toContain('Startwerte');
  });

  it('gives every table a caption, header scopes and a source line', () => {
    const w = mountPage('de');
    const tables = w.findAll('table');
    expect(tables.length).toBeGreaterThanOrEqual(14);
    for (const t of tables) {
      expect(t.find('caption').text().length).toBeGreaterThan(0);
      for (const th of t.findAll('thead th')) expect(th.attributes('scope')).toBe('col');
      for (const th of t.findAll('tbody th')) expect(['row', 'rowgroup']).toContain(th.attributes('scope'));
    }
    expect(w.findAll('figcaption').length).toBe(tables.length);
  });

  it('keeps German text out of the English headings', () => {
    const w = mountPage('en');
    const headings = w.findAll('h1, h2, h3').map((h) => h.text());
    expect(headings.length).toBeGreaterThan(10);
    for (const h of headings) expect(h).not.toMatch(GERMAN_WORDS);
    expect(w.find('h1').text()).toBe('Method and evaluation');
  });

  it('contains no mention of schools', () => {
    expect(mountPage('de').text().toLowerCase()).not.toMatch(/schul|school/);
    expect(mountPage('en').text().toLowerCase()).not.toMatch(/schul|school/);
  });

  it('is prerendered with its heading (server renderer through createCfApp)', async () => {
    const html = await renderToString(createCfApp(ctxFor('de', ALL)));
    expect(html).toContain('Methode und Auswertung');
    expect(html).toContain('Ergebnisse (Protokoll Version 2)');
    expect(html).toContain('id="m-amendment"');
    const en = await renderToString(createCfApp(ctxFor('en', { backtest: null, tuning: null })));
    expect(en).toContain('Method and evaluation');
    expect(en).toContain('not available yet');
  });
});

describe('MethodPage i18n', () => {
  it('has no untranslated message keys in either locale', () => {
    for (const locale of ['de', 'en'] as const) {
      const text = mountPage(locale).text();
      expect(text).not.toContain('pages.method.');
    }
  });
});
