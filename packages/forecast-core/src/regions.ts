/** The 16 German federal states plus the national level. */
export interface RegionInfo {
  /** "de" or "de-<iso2 lower>" */
  id: string;
  /** ISO 3166-2 suffix, e.g. "SN"; "" for the national level */
  iso2: string;
  name_de: string;
  name_en: string;
  /** Numeric id used by RKI files (0 = nationwide) */
  rki_id: number;
  /** Official 2-digit state key (AGS), "00" for nationwide */
  ags: string;
}

export const REGIONS: readonly RegionInfo[] = [
  { id: 'de', iso2: '', name_de: 'Deutschland', name_en: 'Germany', rki_id: 0, ags: '00' },
  { id: 'de-sh', iso2: 'SH', name_de: 'Schleswig-Holstein', name_en: 'Schleswig-Holstein', rki_id: 1, ags: '01' },
  { id: 'de-hh', iso2: 'HH', name_de: 'Hamburg', name_en: 'Hamburg', rki_id: 2, ags: '02' },
  { id: 'de-ni', iso2: 'NI', name_de: 'Niedersachsen', name_en: 'Lower Saxony', rki_id: 3, ags: '03' },
  { id: 'de-hb', iso2: 'HB', name_de: 'Bremen', name_en: 'Bremen', rki_id: 4, ags: '04' },
  { id: 'de-nw', iso2: 'NW', name_de: 'Nordrhein-Westfalen', name_en: 'North Rhine-Westphalia', rki_id: 5, ags: '05' },
  { id: 'de-he', iso2: 'HE', name_de: 'Hessen', name_en: 'Hesse', rki_id: 6, ags: '06' },
  { id: 'de-rp', iso2: 'RP', name_de: 'Rheinland-Pfalz', name_en: 'Rhineland-Palatinate', rki_id: 7, ags: '07' },
  { id: 'de-bw', iso2: 'BW', name_de: 'Baden-Württemberg', name_en: 'Baden-Württemberg', rki_id: 8, ags: '08' },
  { id: 'de-by', iso2: 'BY', name_de: 'Bayern', name_en: 'Bavaria', rki_id: 9, ags: '09' },
  { id: 'de-sl', iso2: 'SL', name_de: 'Saarland', name_en: 'Saarland', rki_id: 10, ags: '10' },
  { id: 'de-be', iso2: 'BE', name_de: 'Berlin', name_en: 'Berlin', rki_id: 11, ags: '11' },
  { id: 'de-bb', iso2: 'BB', name_de: 'Brandenburg', name_en: 'Brandenburg', rki_id: 12, ags: '12' },
  { id: 'de-mv', iso2: 'MV', name_de: 'Mecklenburg-Vorpommern', name_en: 'Mecklenburg-Western Pomerania', rki_id: 13, ags: '13' },
  { id: 'de-sn', iso2: 'SN', name_de: 'Sachsen', name_en: 'Saxony', rki_id: 14, ags: '14' },
  { id: 'de-st', iso2: 'ST', name_de: 'Sachsen-Anhalt', name_en: 'Saxony-Anhalt', rki_id: 15, ags: '15' },
  { id: 'de-th', iso2: 'TH', name_de: 'Thüringen', name_en: 'Thuringia', rki_id: 16, ags: '16' },
];

export const BUNDESLAENDER: readonly RegionInfo[] = REGIONS.filter((r) => r.id !== 'de');

export function regionById(id: string): RegionInfo | undefined {
  return REGIONS.find((r) => r.id === id);
}
export function regionByIso2(iso2: string): RegionInfo | undefined {
  return REGIONS.find((r) => r.iso2 === iso2.toUpperCase() && r.iso2 !== '');
}
export function regionByRkiId(id: number): RegionInfo | undefined {
  return REGIONS.find((r) => r.rki_id === id);
}
export function regionByAgs(ags: string): RegionInfo | undefined {
  return REGIONS.find((r) => r.ags === ags);
}

/** Lower-case ASCII slug: umlauts transliterated, non-alphanumerics -> "-". */
export function slugify(name: string): string {
  return name
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/Ä/g, 'ae').replace(/Ö/g, 'oe').replace(/Ü/g, 'ue')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
