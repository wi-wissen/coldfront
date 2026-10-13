import type { BacktestPublic, ForecastFile, ForecastIndex, TuningPublic, WastewaterExport } from '@coldfront/forecast-core';
import type { Locale, PageEntry } from '../scripts/pages';

export type { Locale, PageEntry };

export interface SourceRecord {
  id: string;
  name: string;
  url: string;
  attribution: string;
  license: string;
  license_url: string;
  retrieved: string;
  sha256: string;
  doi: string;
}

/** Data embedded into every prerendered page (and read again by the client for hydration). */
export interface PageData {
  index: ForecastIndex | null;
  /** region pages only */
  region: ForecastFile | null;
  /** national forecast, for the start page */
  national: ForecastFile | null;
  sources: SourceRecord[] | null;
  backtest: BacktestPublic | null;
  tuning: TuningPublic | null;
  /** start page only (map) */
  topology: unknown | null;
  /** start page: all plants; region pages: only the plants of that state */
  wastewater: WastewaterExport | null;
}

export const EMPTY_DATA: PageData = { index: null, region: null, national: null, sources: null, backtest: null, tuning: null, topology: null, wastewater: null };

/** Per-page context provided to all components. */
export interface PageContext {
  entry: PageEntry;
  locale: Locale;
  data: PageData;
}
