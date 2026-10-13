import type { LongRow } from './types';

const key = (r: Pick<LongRow, 'region' | 'series' | 'week'>) => `${r.region}\u0000${r.series}\u0000${r.week}`;

/**
 * Reconstruct a data version: for every (region, series, week) the most recent
 * value whose as_of <= asOf. Rows are returned sorted by region, series, week.
 */
export function snapshotAt(rows: readonly LongRow[], asOf: string): LongRow[] {
  const best = new Map<string, LongRow>();
  for (const r of rows) {
    if (r.as_of > asOf) continue;
    const k = key(r);
    const cur = best.get(k);
    if (!cur || r.as_of >= cur.as_of) best.set(k, r);
  }
  return [...best.values()].sort(
    (a, b) => a.region.localeCompare(b.region) || a.series.localeCompare(b.series) || a.week.localeCompare(b.week),
  );
}

/**
 * Append-only update: returns only those incoming rows that are new or whose
 * value differs from the latest known value (in `existing`). The returned rows
 * carry the given `asOf`.
 */
export function appendChanges(
  existing: readonly LongRow[],
  incoming: readonly Omit<LongRow, 'as_of'>[],
  asOf: string,
): LongRow[] {
  const latest = new Map<string, LongRow>();
  for (const r of existing) {
    const k = key(r);
    const cur = latest.get(k);
    if (!cur || r.as_of >= cur.as_of) latest.set(k, r);
  }
  const out: LongRow[] = [];
  for (const r of incoming) {
    const cur = latest.get(key(r));
    if (!cur || cur.value !== r.value) out.push({ ...r, as_of: asOf });
  }
  return out;
}
