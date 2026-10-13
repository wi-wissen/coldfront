import type { ActivityLevel, ObservedPoint, QuantileSet } from '@coldfront/forecast-core';

/** All visible strings are passed in (the host app owns i18n). */
export interface ForecastChartLabels {
  /** accessible name of the chart, e.g. "Forecast of consultation incidence for Saxony" */
  title: string;
  currentSeason: string;
  previousSeasons: string;
  forecast: string;
  band50: string;
  band80: string;
  /** y-axis caption incl. unit, e.g. "Consultations per 100,000" */
  yAxis: string;
  /** summary text of the toggle that reveals the data table */
  showTable: string;
  tableWeek: string;
  tableObserved: string;
  tableMedian: string;
  tableRange50: string;
  tableRange80: string;
  /** week label formatter, e.g. (w) => "W42" */
  weekShort: (isoWeek: string) => string;
}

export interface ForecastChartProps {
  /** Full observed history (weekly). The chart splits it into seasons (week 40 .. week 39). */
  observed: ObservedPoint[];
  horizons: QuantileSet[];
  labels: ForecastChartLabels;
  /** BCP-47 locale for number formatting, "de" or "en". */
  locale: string;
  /** Source line rendered directly below the chart, e.g. "Quelle: Robert Koch-Institut; eigene Berechnung". */
  sourceLine: string;
}

export interface MapValue {
  /** region id, matches topology geometry properties.id, e.g. "de-sn" */
  id: string;
  /** colour value, e.g. forecast index relative to the norm; null = no data */
  value: number | null;
  level: ActivityLevel | null;
  /** text for tooltip and table, already localised */
  label: string;
  name: string;
}

export interface GermanyMapLabels {
  title: string;
  legendTitle: string;
  legendLow: string;
  legendHigh: string;
  noData: string;
  showTable: string;
  tableRegion: string;
  tableValue: string;
  levels: Record<ActivityLevel, string>;
}

/** A point marker (e.g. a wastewater plant) drawn on top of the states. */
export interface MapPoint {
  id: string;
  /** WGS84 longitude and latitude; projected with the same projection as the states */
  lon: number;
  lat: number;
  /** display name, used in the accessible name and the points table */
  name: string;
  /** localised value text for the accessible name and the points table */
  label: string;
  /** shape, size and outline encode the level; colour is never the only signal */
  level: 'low' | 'medium' | 'high' | 'none';
  /** optional base radius in px for the level's circle (default by level) */
  radius?: number;
}

export interface MapPointsLegend {
  title: string;
  low: string;
  medium: string;
  high: string;
  none: string;
}

export interface MapPointsTableLabels {
  name: string;
  value: string;
  /** summary of the points table; default labels.showTable */
  summary?: string;
}

export interface GermanyMapProps {
  /** Parsed TopoJSON (object "laender", geometries with properties.id). */
  topology: unknown;
  values: MapValue[];
  labels: GermanyMapLabels;
  selected: string | null;
  sourceLine: string;
  /** colour domain, default [0.5, 2] (index relative to norm) */
  domain?: [number, number];
  /** optional point markers; when given, a points legend and a points table are rendered */
  points?: MapPoint[];
  pointsLegend?: MapPointsLegend;
  /** column headers of the points table; default to labels.tableRegion / labels.tableValue */
  pointsTableLabels?: MapPointsTableLabels;
  /** default true; false hides the colour scale (use when the states carry no colour value) */
  showScale?: boolean;
  /** default true; false hides the states table (use when the states carry no colour value) */
  showStateTable?: boolean;
  /** default false; true draws states without a value in a plain neutral fill instead of the hatch */
  plainStates?: boolean;
}
