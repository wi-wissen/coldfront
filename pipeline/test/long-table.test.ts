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
