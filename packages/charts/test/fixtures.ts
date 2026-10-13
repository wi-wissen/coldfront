import { addWeeks, type ObservedPoint, type QuantileSet, type IsoWeek } from '@coldfront/forecast-core';
import type { ForecastChartLabels } from '../src/types';

/** Deterministic weekly values: seasonal wave, no randomness. */
export function syntheticObserved(from: IsoWeek, weeks: number, last?: number): ObservedPoint[] {
  const out: ObservedPoint[] = [];
  for (let i = 0; i < weeks; i++) {
    const phase = (i % 52) / 52;
    const value = 40 + 200 * Math.exp(-Math.pow((phase - 0.25) * 6, 2)) + (i % 7);
    out.push({ iso_week: addWeeks(from, i), value: Math.round(value * 10) / 10 });
  }
  if (last !== undefined && out.length > 0) out[out.length - 1] = { ...out[out.length - 1]!, value: last };
  return out;
}

export function syntheticHorizons(after: IsoWeek, median: number): QuantileSet[] {
  return [1, 2, 3, 4].map((h) => {
    const spread = 10 * h;
    return {
      iso_week: addWeeks(after, h),
      h: h as 1 | 2 | 3 | 4,
      q10: Math.max(0, median - 2 * spread),
      q25: Math.max(0, median - spread),
      q50: median,
      q75: median + spread,
      q90: median + 2 * spread,
    };
  });
}

export const chartLabels: ForecastChartLabels = {
  title: 'Forecast of consultation incidence for Saxony',
  currentSeason: 'Current season',
  previousSeasons: 'Previous seasons',
  forecast: 'Forecast median',
  band50: '50 % range',
  band80: '80 % range',
  yAxis: 'Consultations per 100,000',
  showTable: 'Show data table',
  tableWeek: 'Week',
  tableObserved: 'Observed',
  tableMedian: 'Median',
  tableRange50: '50 % range',
  tableRange80: '80 % range',
  weekShort: (w: string) => `W${w.slice(-2)}`,
};
