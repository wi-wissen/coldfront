import { addWeeks } from './isoweek';
import type { IsoWeek, RegionData, WeeklySeries } from './types';

/** forecasts/series.json (/api/v1/series.json): cleaned inputs of all regions. */
export interface SeriesExport {
  schema_version: 1;
  /** ISO week of the first value of every array */
  start: IsoWeek;
  /** Per region and column, dense weekly arrays (null = missing). "holiday" extends past the last observation. */
  regions: Record<string, Record<string, (number | null)[]>>;
  columns: readonly string[];
}

/** Convert the export into model input (target "are", all other columns as signals, trimmed). */
export function regionDataFromExport(x: SeriesExport): RegionData[] {
  const out: RegionData[] = [];
  for (const [region, cols] of Object.entries(x.regions)) {
    const trim = (v: (number | null)[], trimEnd: boolean): WeeklySeries | null => {
      const first = v.findIndex((e) => e !== null);
      if (first < 0) return null;
      let last = v.length - 1;
      if (trimEnd) while (last > first && v[last] === null) last--;
      return { start: addWeeks(x.start, first), values: v.slice(first, last + 1) };
    };
    const target = trim(cols['are'] ?? [], true);
    if (!target) continue;
    const signals: Record<string, WeeklySeries> = {};
    for (const [name, v] of Object.entries(cols)) {
      if (name === 'are') continue;
      const s = trim(v, name !== 'holiday');
      if (s) signals[name] = s;
    }
    out.push({ region, target, signals });
  }
  return out;
}
