import { describe, expect, it } from 'vitest';
import { parseLong, serializeLong } from '../src/long-table';

describe('long table csv', () => {
  it('round-trips values with commas and quotes', () => {
    const rows = [
      { region: 'de', series: '00+', week: '2026-W40', value: 1.5, as_of: '2026-10-13' },
      { region: 'ww-a', series: 'Influenza A, "B"', week: '2026-W41', value: 3, as_of: '2026-10-13' },
    ];
    expect(parseLong(serializeLong(rows))).toEqual(rows);
  });
  it('rejects unknown headers', () => {
    expect(() => parseLong('a,b\n1,2\n')).toThrow();
  });
});

import { assertFresh } from '../src/run-forecast';
describe('data freshness gate', () => {
  it('accepts recent data and rejects stalled sources', () => {
    expect(() => assertFresh('2026-W40', '2026-10-13')).not.toThrow();
    expect(() => assertFresh('2026-W30', '2026-10-13')).toThrow(/stale/);
  });
});
