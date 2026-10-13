import { describe, expect, it } from 'vitest';
import { messages } from '../src/i18n/check';
import { modelKey, validateSelection, verdictOf } from '../src/check/helpers';
import { keyPaths } from '../src/i18n/setup';

describe('validateSelection', () => {
  it('accepts a valid selection', () => {
    expect(validateSelection({ region: 'de-sn', season: '2024/25', horizon: 2 })).toEqual([]);
  });
  it('reports each invalid field', () => {
    expect(validateSelection({ region: '', season: '2030/31', horizon: 5 })).toEqual(['region', 'season', 'horizon']);
  });
});

describe('verdictOf', () => {
  it('classifies better, worse and not computable', () => {
    expect(verdictOf(0.159)).toEqual({ kind: 'better', pct: expect.closeTo(15.9, 6) });
    expect(verdictOf(-0.2)).toEqual({ kind: 'worse', pct: expect.closeTo(20, 6) });
    expect(verdictOf(null).kind).toBe('none');
    expect(verdictOf(Number.NaN).kind).toBe('none');
  });
});

describe('modelKey', () => {
  it('maps protocol names to message keys', () => {
    expect(modelKey('baseline-seasonal')).toBe('baseline');
    expect(modelKey('regional-model')).toBe('regional');
    expect(modelKey('other')).toBeNull();
  });
});

describe('check messages', () => {
  it('have identical key sets in de and en', () => {
    expect(keyPaths(messages.en).sort()).toEqual(keyPaths(messages.de).sort());
  });
  it('do not mention schools', () => {
    expect(JSON.stringify(messages).toLowerCase()).not.toMatch(/schul|school/);
  });
});
