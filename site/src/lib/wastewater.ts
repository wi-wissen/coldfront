import { weeksBetween, type IsoWeek, type WastewaterExport, type WastewaterSiteExport } from '@coldfront/forecast-core';

export type WastewaterPathogen = 'sars' | 'flu' | 'rsv';
export type WastewaterRecord = WastewaterSiteExport['pathogens'][string];
export type WastewaterLevel = 'low' | 'medium' | 'high';

export const WASTEWATER_PATHOGENS: readonly WastewaterPathogen[] = ['sars', 'flu', 'rsv'];

/** Source keys per pathogen, in preference order (RSV: A+B where present, else A/B). */
const SOURCE_KEYS: Record<WastewaterPathogen, readonly string[]> = {
  sars: ['SARS-CoV-2'],
  flu: ['Influenza A+B'],
  rsv: ['RSV A+B', 'RSV A/B'],
};

/** A plant counts as current when its newest value is at most this many weeks behind the export (start value). */
export const WASTEWATER_STALE_WEEKS = 4;

/** Level from the plant's own percentile (0..1): below 0.5 low, 0.5 to 0.8 medium, above 0.8 high. Start values. */
export function levelFromPercentile(percentile: number): WastewaterLevel {
  if (percentile < 0.5) return 'low';
  if (percentile <= 0.8) return 'medium';
  return 'high';
}

/** The plant's record for a pathogen, merging the two RSV source names. Null when not measured. */
export function pathogenRecord(site: WastewaterSiteExport, pathogen: WastewaterPathogen): WastewaterRecord | null {
  for (const key of SOURCE_KEYS[pathogen]) {
    const record = site.pathogens[key];
    if (record) return record;
  }
  return null;
}

/** True when the record's newest week is at most WASTEWATER_STALE_WEEKS behind the export's newest week. */
export function isCurrent(record: WastewaterRecord, exportWeek: IsoWeek): boolean {
  return weeksBetween(record.last_week, exportWeek) <= WASTEWATER_STALE_WEEKS;
}

/** Map level for a plant: its percentile level when current, 'none' when stale. */
export function pointLevel(record: WastewaterRecord, exportWeek: IsoWeek): WastewaterLevel | 'none' {
  return isCurrent(record, exportWeek) ? levelFromPercentile(record.percentile) : 'none';
}

export interface PathogenEntry {
  site: WastewaterSiteExport;
  record: WastewaterRecord;
  current: boolean;
}

/** All plants that measure the pathogen, with their record and currency. */
export function pathogenEntries(sites: readonly WastewaterSiteExport[], pathogen: WastewaterPathogen, exportWeek: IsoWeek): PathogenEntry[] {
  const out: PathogenEntry[] = [];
  for (const site of sites) {
    const record = pathogenRecord(site, pathogen);
    if (record) out.push({ site, record, current: isCurrent(record, exportWeek) });
  }
  return out;
}

/** The n current plants with the highest percentile; ties broken by name. */
export function topByPercentile(entries: readonly PathogenEntry[], n: number): PathogenEntry[] {
  return entries
    .filter((e) => e.current)
    .sort((a, b) => b.record.percentile - a.record.percentile || a.site.name.localeCompare(b.site.name))
    .slice(0, n);
}

export type TrendSymbol = '▲' | '▼' | '▬';

/** Text-safe trend symbol; the direction is also spelled out in the UI for screen readers. */
export function trendSymbol(trend: WastewaterRecord['trend']): TrendSymbol {
  if (trend === 'up') return '▲';
  if (trend === 'down') return '▼';
  return '▬';
}

/** Percentile as whole percent (0.876 to 88). */
export function percentPoints(percentile: number): number {
  return Math.round(percentile * 100);
}

export interface Sparkline {
  /** SVG path data; one subpath per run of non-null values */
  d: string;
  /** last non-null value in the run, for the end dot */
  end: { x: number; y: number } | null;
}

/** Sparkline geometry for a series with gaps (null). Returns null when there is no value at all. */
export function sparkline(values: readonly (number | null)[], width: number, height: number, pad = 2): Sparkline | null {
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (present.length === 0 || values.length === 0) return null;
  const min = Math.min(...present);
  const max = Math.max(...present);
  const span = max - min || 1;
  const step = values.length > 1 ? (width - 2 * pad) / (values.length - 1) : 0;
  const xy = (i: number, v: number): [number, number] => [
    round(pad + i * step),
    round(height - pad - ((v - min) / span) * (height - 2 * pad)),
  ];
  let d = '';
  let pen = false;
  let end: { x: number; y: number } | null = null;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (v === null || v === undefined || !Number.isFinite(v)) {
      pen = false;
      continue;
    }
    const [x, y] = xy(i, v);
    d += `${pen ? 'L' : 'M'}${x} ${y}`;
    pen = true;
    end = { x, y };
  }
  return { d, end };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
