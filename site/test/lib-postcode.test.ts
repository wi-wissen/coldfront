import { describe, expect, it } from 'vitest';
import { checkPostcode, lookupPostcode, type PlzTable } from '../src/lib/postcode';

const table: PlzTable = { '04109': [51.33, 12.37, 'de-sn'], '80331': [48.13, 11.57, 'de-by'] };

describe('checkPostcode', () => {
  it('accepts exactly five digits, ignoring surrounding spaces', () => {
    expect(checkPostcode('04109')).toEqual({ ok: true, plz: '04109' });
    expect(checkPostcode(' 80331 ')).toEqual({ ok: true, plz: '80331' });
  });
  it('rejects anything else', () => {
    for (const bad of ['', '4109', '041090', 'abcde', '0410 9', '04109a']) {
      expect(checkPostcode(bad).ok).toBe(false);
    }
  });
});

describe('lookupPostcode', () => {
  it('returns the region id of a known postcode', () => {
    expect(lookupPostcode(table, '04109')).toBe('de-sn');
  });
  it('returns null for unknown postcodes and prototype keys', () => {
    expect(lookupPostcode(table, '99999')).toBeNull();
    expect(lookupPostcode(table, 'constructor')).toBeNull();
  });
});
