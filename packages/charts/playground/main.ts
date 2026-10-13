import { createApp, defineComponent, h } from 'vue';
import {
  activityLevel,
  addWeeks,
  weeksBetween,
  type IsoWeek,
  type ObservedPoint,
  type QuantileSet,
} from '@coldfront/forecast-core';
import { ForecastChart, GermanyMap, type ForecastChartLabels, type GermanyMapLabels, type MapValue } from '../src';
// Real state geometry from the data pipeline (produced by another package).
import topology from '../../../data/external/geo/vg250-laender.topo.json';

const lang = new URLSearchParams(location.search).get('lang') === 'de' ? 'de' : 'en';

const chartLabels: ForecastChartLabels = {
  title: lang === 'de' ? 'Prognose der ARE-Konsultationsinzidenz' : 'Forecast of ARE consultation incidence',
  currentSeason: lang === 'de' ? 'Laufende Saison' : 'Current season',
  previousSeasons: lang === 'de' ? 'Vorsaisons' : 'Previous seasons',
  forecast: lang === 'de' ? 'Prognose (Median)' : 'Forecast (median)',
  band50: lang === 'de' ? '50 %-Intervall' : '50 % interval',
  band80: lang === 'de' ? '80 %-Intervall' : '80 % interval',
  yAxis: lang === 'de' ? 'Konsultationen je 100.000' : 'Consultations per 100,000',
  showTable: lang === 'de' ? 'Datentabelle anzeigen' : 'Show data table',
  tableWeek: lang === 'de' ? 'Woche' : 'Week',
  tableObserved: lang === 'de' ? 'Beobachtet' : 'Observed',
  tableMedian: lang === 'de' ? 'Median' : 'Median',
  tableRange50: lang === 'de' ? '50 %-Intervall' : '50 % interval',
  tableRange80: lang === 'de' ? '80 %-Intervall' : '80 % interval',
  weekShort: (w: string) => (lang === 'de' ? `KW${w.slice(-2)}` : `W${w.slice(-2)}`),
};

const mapLabels: GermanyMapLabels = {
  title: lang === 'de' ? 'Aktivität nach Bundesland' : 'Activity by federal state',
  legendTitle: lang === 'de' ? 'Index (relativ zur Norm)' : 'Index (relative to norm)',
  legendLow: lang === 'de' ? 'niedrig' : 'low',
  legendHigh: lang === 'de' ? 'hoch' : 'high',
  noData: lang === 'de' ? 'keine Daten' : 'no data',
  showTable: lang === 'de' ? 'Tabelle anzeigen' : 'Show table',
  tableRegion: lang === 'de' ? 'Bundesland' : 'State',
  tableValue: lang === 'de' ? 'Index' : 'Index',
  levels: {
    normal: lang === 'de' ? 'normal' : 'normal',
    elevated: lang === 'de' ? 'erhöht' : 'elevated',
    high: lang === 'de' ? 'hoch' : 'high',
  },
};

const SOURCE = lang === 'de'
  ? 'Quelle: Robert Koch-Institut (Demo-Daten); eigene Berechnung'
  : 'Source: Robert Koch Institute (demo data); own calculation';

/** Season start year of an ISO week. */
function seasonYear(w: IsoWeek): number {
  const y = Number(w.slice(0, 4));
  return Number(w.slice(-2)) >= 40 ? y : y - 1;
}

/** Deterministic seasonal shape: peak around week 16 of the season, season-specific amplitude. */
function shape(w: IsoWeek, amp: number): number {
  const k = weeksBetween(`${seasonYear(w)}-W40`, w);
  const wave = amp * Math.exp(-((k - 16) ** 2) / (2 * 5 ** 2));
  return Math.max(4, 25 + wave + 6 * Math.sin(k * 0.9 + seasonYear(w)));
}

const AMPS: Record<number, number> = { 2022: 180, 2023: 260, 2024: 140, 2025: 320, 2026: 210, 2027: 250 };

function observedUntil(first: IsoWeek, last: IsoWeek): ObservedPoint[] {
  const out: ObservedPoint[] = [];
  for (let w = first; ; w = addWeeks(w, 1)) {
    const amp = AMPS[seasonYear(w)] ?? 200;
    out.push({ iso_week: w, value: Math.round(shape(w, amp) * 10) / 10 });
    if (w === last) break;
  }
  return out;
}

function horizonsAfter(last: IsoWeek, n: number): QuantileSet[] {
  return Array.from({ length: n }, (_, i) => {
    const h = i + 1;
    const w = addWeeks(last, h);
    const median = Math.round(shape(w, AMPS[seasonYear(w)] ?? 200) * 10) / 10;
    const spread = 6 + 9 * h;
    return {
      iso_week: w,
      h: h as 1 | 2 | 3 | 4,
      q10: Math.max(0, median - 1.6 * spread),
      q25: Math.max(0, median - 0.67 * spread),
      q50: median,
      q75: median + 0.67 * spread,
      q90: median + 1.6 * spread,
    };
  });
}

const geometries = (topology as unknown as { objects: { laender: { geometries: { properties: { id: string; name: string } }[] } } })
  .objects.laender.geometries;

const nf = new Intl.NumberFormat(lang, { maximumFractionDigits: 2 });
const mapValues: MapValue[] = geometries.map((g, i) => {
  // Deterministic index per state; one state without data to show the hatch style.
  const value = g.properties.id === 'de-be' ? null : Math.round((0.55 + ((i * 0.37) % 1.7)) * 100) / 100;
  const level = value === null ? null : activityLevel(value);
  return {
    id: g.properties.id,
    name: g.properties.name,
    value,
    level,
    label: value === null ? '' : nf.format(value),
  };
});

const current = observedUntil('2022-W40', '2026-W42');
const rollover = observedUntil('2022-W40', '2027-W37');

const App = defineComponent({
  name: 'PlaygroundApp',
  data() {
    return { selected: null as string | null };
  },
  render() {
    const selectedName = mapValues.find((v) => v.id === this.selected)?.name ?? '–';
    return h('main', [
      h('h1', lang === 'de' ? 'Chart-Playground' : 'Chart playground'),
      h('div', { class: 'grid' }, [
        h('section', { class: 'card' }, [
          h('h2', lang === 'de' ? 'Prognose (Saison 2026/27)' : 'Forecast (season 2026/27)'),
          h('p', { class: 'meta' }, lang === 'de' ? 'Beobachtet bis KW42, Prognose 1–4 Wochen' : 'Observed up to W42, 1–4 week horizons'),
          h(ForecastChart, {
            observed: current,
            horizons: horizonsAfter('2026-W42', 4),
            labels: chartLabels,
            locale: lang,
            sourceLine: SOURCE,
          }),
          h('h2', { style: 'margin-top: 28px' }, lang === 'de' ? 'Saisonübergang (synthetisch)' : 'Season rollover (synthetic)'),
          h('p', { class: 'meta' }, lang === 'de' ? 'Prognosewochen laufen in die nächste Saison' : 'Forecast weeks run into the next season'),
          h(ForecastChart, {
            observed: rollover,
            horizons: horizonsAfter('2027-W37', 4),
            labels: chartLabels,
            locale: lang,
            sourceLine: SOURCE,
          }),
        ]),
        h('section', { class: 'card' }, [
          h('h2', lang === 'de' ? 'Karte' : 'Map'),
          h('p', { class: 'meta' }, `${lang === 'de' ? 'Ausgewählt' : 'Selected'}: ${selectedName}`),
          h(GermanyMap, {
            topology,
            values: mapValues,
            labels: mapLabels,
            selected: this.selected,
            sourceLine: SOURCE,
            onSelect: (id: string) => {
              this.selected = this.selected === id ? null : id;
            },
          }),
        ]),
      ]),
    ]);
  },
});

createApp(App).mount('#app');
