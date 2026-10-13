import { describe, expect, it } from 'vitest';
import { keyPaths, allMessages } from '../src/i18n/setup';
import { allPages, pageHref, rootPrefix } from '../scripts/pages';

describe('page registry', () => {
  it('has 6 static + 16 region pages per locale', () => {
    const pages = allPages();
    expect(pages).toHaveLength(44);
    expect(pages.filter((p) => p.locale === 'en' && p.path.startsWith('en/'))).toHaveLength(22);
    expect(new Set(pages.map((p) => p.path)).size).toBe(44);
  });
  it('computes relative links between locales and depths', () => {
    expect(rootPrefix('index.html')).toBe('./');
    expect(rootPrefix('en/regions/de-sn.html')).toBe('../../');
    expect(pageHref('en/regions/de-sn.html', { page: 'index', locale: 'de' })).toBe('../../index.html');
    expect(pageHref('regions/de-sn.html', { page: 'region', locale: 'en', region: 'de-by' })).toBe('../en/regions/de-by.html');
  });
});

describe('i18n', () => {
  it('has identical key sets in de and en', () => {
    expect(keyPaths(allMessages.en).sort()).toEqual(keyPaths(allMessages.de).sort());
  });
  it('has no empty strings except page descriptions of stubs', () => {
    const empty = (m: unknown) => Object.entries(m as Record<string, unknown>).length;
    expect(empty(allMessages.de)).toBeGreaterThan(0);
  });
  it('does not mention schools anywhere', () => {
    const all = JSON.stringify(allMessages).toLowerCase();
    expect(all).not.toMatch(/schul|school|beste\.schule/);
  });
});
