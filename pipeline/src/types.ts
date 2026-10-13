import type { LongRow } from '@coldfront/forecast-core';

/** Provenance of a source, stored as data/sources/<id>.json. */
export interface SourceMeta {
  id: string;
  name: string;
  url: string;
  /** Required attribution text, shown on the "Data & sources" page. */
  attribution: string;
  license: string;
  license_url: string;
  /** ISO date of retrieval, passed in (never read from the clock inside parsers). */
  retrieved: string;
  /** SHA-256 hex of the downloaded bytes. */
  sha256: string;
  /** DOI / version when the publisher provides one, else "". */
  doi: string;
}

export type NewRow = Omit<LongRow, 'as_of'>;

/**
 * A parsed weekly dataset ready to be merged into data/long/<indicator>.csv.gz.
 * Parsers are pure: text in, rows out.
 */
export interface ParsedIndicator {
  /** File stem under data/long/, e.g. "are". */
  indicator: string;
  rows: NewRow[];
}
