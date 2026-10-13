import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { createCfApp } from '../src/app';
import { createCfI18n } from '../src/i18n/setup';
import LegalPage from '../src/pages/LegalPage.vue';
import { REPO_URL } from '../src/site-config';
import type { Locale, PageContext, PageData } from '../src/types';
import { EMPTY_DATA } from '../src/types';

function ctxFor(locale: Locale, data: Partial<PageData> = {}): PageContext {
  return {
    entry: { page: 'legal', locale, path: locale === 'de' ? 'legal.html' : 'en/legal.html' },
    locale,
    data: { ...EMPTY_DATA, ...data },
  };
}

function mountPage(locale: Locale) {
  return mount(LegalPage, { props: { ctx: ctxFor(locale) }, global: { plugins: [createCfI18n(locale)] } });
}

const GERMAN_WORDS = /\b(und|der|die|das|für|Hinweise|Haftungsausschluss|Datenschutz|Lizenzen|Betreiber|Kontakt|Medizinische)\b/;

describe('LegalPage', () => {
  it('renders the German headings', () => {
    const w = mountPage('de');
    expect(w.find('h1').text()).toBe('Hinweise');
    expect(w.findAll('h2').map((h) => h.text())).toEqual([
      'Haftungsausschluss',
      'Keine medizinische Beratung',
      'Datenschutz',
      'Betreiber und Kontakt',
      'Lizenzen',
    ]);
  });

  it('states the disclaimer that the project is not endorsed by RKI, DWD or others', () => {
    const text = mountPage('de').text();
    expect(text).toContain('Coldfront ist nicht vom RKI, DWD oder anderen genannten Stellen erstellt oder gebilligt');
    const en = mountPage('en').text();
    expect(en).toContain('Coldfront is not created or endorsed by RKI, DWD or any other named body');
  });

  it('links to the repository for contact and to the GitHub privacy statement', () => {
    const w = mountPage('de');
    expect(w.find(`a[href="${REPO_URL}"]`).exists()).toBe(true);
    expect(w.find('a[href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"]').exists()).toBe(true);
  });

  it('links to the sources page in the language of the page', () => {
    const de = mountPage('de').find('a[href$="sources.html"]');
    expect(de.attributes('href')).toBe('./sources.html');
    const en = mountPage('en').find('a[href$="sources.html"]');
    expect(en.attributes('href')).toBe('../en/sources.html');
  });

  it('describes local computation and the unavoidable hosting IP processing', () => {
    const text = mountPage('de').text();
    expect(text).toContain('Der Selbst-Check und die Postleitzahl-Suche rechnen ausschließlich im Browser.');
    expect(text).toContain('IP-Adressen');
    expect(text).toContain('setzt keine Cookies');
  });

  it('keeps German text out of the English headings', () => {
    const w = mountPage('en');
    const headings = w.findAll('h1, h2').map((h) => h.text());
    expect(headings).toEqual(['Notices', 'Disclaimer', 'No medical advice', 'Privacy', 'Operator and contact', 'Licences']);
    for (const h of headings) expect(h).not.toMatch(GERMAN_WORDS);
  });

  it('contains no mention of schools', () => {
    expect(mountPage('de').text().toLowerCase()).not.toMatch(/schul|school/);
    expect(mountPage('en').text().toLowerCase()).not.toMatch(/schul|school/);
  });

  it('is prerendered with its heading and loads nothing from third parties', async () => {
    const html = await renderToString(createCfApp(ctxFor('de')));
    expect(html).toContain('Haftungsausschluss');
    expect(html).not.toMatch(/(src|href)="https?:\/\/(?!github\.com|docs\.github\.com|www\.govdata\.de)/);
    const en = await renderToString(createCfApp(ctxFor('en')));
    expect(en).toContain('Disclaimer');
  });
});
