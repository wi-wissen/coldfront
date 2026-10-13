export const common = {
  de: {
    brand: 'Coldfront',
    tagline: 'Prognose akuter Atemwegserkrankungen für Deutschland',
    nav: { home: 'Start', check: 'Selbst prüfen', sources: 'Daten & Quellen', api: 'API', method: 'Methode', legal: 'Hinweise', menu: 'Menü', language: 'Sprache' },
    footer: {
      disclaimer:
        'Coldfront ist nicht vom RKI, DWD oder anderen genannten Stellen erstellt oder gebilligt. Die Prognose ist eine statistische Schätzung mit Unsicherheit, keine medizinische Beratung und kein amtliches Produkt. Daten Dritter ohne Gewähr.',
      sources: 'Daten & Quellen',
      dataVersion: 'Datenstand',
      code: 'Code: MIT-Lizenz; Daten behalten die Lizenz der Quelle.',
    },
    stale: 'Der Datenstand ist älter als eine Woche; ein Aktualisierungslauf ist möglicherweise ausgefallen.',
    skip: 'Zum Inhalt springen',
    loading: 'Lädt …',
    error: 'Die Daten konnten nicht geladen werden.',
    weekShort: 'KW {week}',
    unitPer100k: 'pro 100.000 Einwohner',
  },
  en: {
    brand: 'Coldfront',
    tagline: 'Forecasts of acute respiratory illness for Germany',
    nav: { home: 'Home', check: 'Check it yourself', sources: 'Data & sources', api: 'API', method: 'Method', legal: 'Notices', menu: 'Menu', language: 'Language' },
    footer: {
      disclaimer:
        'Coldfront is not created or endorsed by RKI, DWD or any other named body. The forecast is a statistical estimate with uncertainty, not medical advice and not an official product. Third-party data without warranty.',
      sources: 'Data & sources',
      dataVersion: 'Data version',
      code: 'Code: MIT licence; data keep the licence of their source.',
    },
    stale: 'The data version is older than one week; an update run may have failed.',
    skip: 'Skip to content',
    loading: 'Loading …',
    error: 'The data could not be loaded.',
    weekShort: 'W{week}',
    unitPer100k: 'per 100,000 inhabitants',
  },
} as const;
