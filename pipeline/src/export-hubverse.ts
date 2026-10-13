import { QUANTILE_LEVELS, parseWeek, regionById, weekStart, type ForecastFile } from '@coldfront/forecast-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FORECASTS } from './paths';

/** Hubverse model-output columns (https://hubdocs.readthedocs.io/): quantile forecasts in long format. */
export const HUBVERSE_HEADER = 'reference_date,target,horizon,target_end_date,location,output_type,output_type_id,value';
export const HUBVERSE_TARGET = 'are_consultation_incidence_per_100k';

/** Saturday of an ISO week (the week's Monday + 5 days) as YYYY-MM-DD. */
export function saturdayOf(week: string): string {
  parseWeek(week);
  return new Date(weekStart(week).getTime() + 5 * 86400000).toISOString().slice(0, 10);
}

/** ISO 3166-2 style location code: "DE" for the nation, "DE-SN" for Saxony. */
export function hubLocation(regionId: string): string {
  const r = regionById(regionId);
  if (!r) throw new Error(`Unknown region ${regionId}`);
  return r.iso2 ? `DE-${r.iso2}` : 'DE';
}

/**
 * One row per region, horizon and quantile level. `reference_date` is the Saturday of the last
 * observed ISO week (the forecast origin); `horizon` counts weeks from that origin; `target_end_date`
 * is the Saturday of the target ISO week.
 */
export function hubverseRows(files: readonly ForecastFile[]): string[] {
  const rows: string[] = [];
  for (const f of files) {
    const reference = saturdayOf(f.last_observed_week);
    for (const h of f.horizons) {
      for (const level of QUANTILE_LEVELS) {
        const key = `q${Math.round(level * 100)}` as 'q10' | 'q25' | 'q50' | 'q75' | 'q90';
        rows.push([reference, HUBVERSE_TARGET, h.h, saturdayOf(h.iso_week), hubLocation(f.region), 'quantile', level, h[key]].join(','));
      }
    }
  }
  return rows;
}

export function hubverseCsv(files: readonly ForecastFile[]): string {
  return [HUBVERSE_HEADER, ...hubverseRows(files)].join('\n') + '\n';
}

/** Write forecasts/hubverse/latest.csv, the dated copy and the model metadata. */
export function exportHubverse(files: readonly ForecastFile[]): string {
  const dir = resolve(FORECASTS, 'hubverse');
  mkdirSync(dir, { recursive: true });
  const csv = hubverseCsv(files);
  const reference = saturdayOf(files[0]!.last_observed_week);
  writeFileSync(resolve(dir, 'latest.csv'), csv);
  writeFileSync(resolve(dir, `${reference}-coldfront-ensemble.csv`), csv);
  writeFileSync(
    resolve(dir, 'model-metadata.yml'),
    [
      'team_name: Coldfront',
      'model_name: Coldfront ensemble (seasonal baseline + pooled quantile regression)',
      'model_abbr: coldfront-ensemble',
      `target: ${HUBVERSE_TARGET}`,
      'horizon_definition: weeks after the last observed ISO week (reference_date = Saturday of that week)',
      'quantiles: [0.1, 0.25, 0.5, 0.75, 0.9]',
      'license: data derived from RKI, UBA and DWD open data (CC BY 4.0); forecasts are derivative works, attribute accordingly',
      'website_url: https://coldfront.wi7.net/',
      '',
    ].join('\n'),
  );
  return csv;
}
