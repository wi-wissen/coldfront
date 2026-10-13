import type { IsoWeek } from '@coldfront/forecast-core';

/** One scored target week: the forecast made for it (median and bands) and the actual value. */
export interface BacktestChartPoint {
  iso_week: IsoWeek;
  /** observed value; null = not available (drawn as a gap) */
  actual: number | null;
  q10: number;
  q25: number;
  q50: number;
  q75: number;
  q90: number;
}

/** All visible strings are passed in (the host app owns i18n). */
export interface BacktestChartLabels {
  /** accessible name of the chart */
  title: string;
  actual: string;
  forecast: string;
  band50: string;
  band80: string;
  /** y-axis caption incl. unit */
  yAxis: string;
  /** summary text of the toggle that reveals the data table */
  showTable: string;
  tableWeek: string;
  tableActual: string;
  tableMedian: string;
  tableRange80: string;
  /** week label formatter, e.g. (w) => "KW 42" */
  weekShort: (isoWeek: IsoWeek) => string;
}

export interface BacktestChartProps {
  points: BacktestChartPoint[];
  labels: BacktestChartLabels;
  /** BCP-47 locale for number formatting, "de" or "en". */
  locale: string;
  /** Source line rendered directly below the chart. */
  sourceLine: string;
}
