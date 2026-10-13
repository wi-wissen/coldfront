/** Postcode table: "01067" -> [lat, lon, regionId] (static file, geo/plz.json). */
export type PlzTable = Record<string, [number, number, string]>;

export type PostcodeCheck = { ok: true; plz: string } | { ok: false };

/** German postcodes are exactly five digits. Surrounding whitespace is ignored. */
export function checkPostcode(input: string): PostcodeCheck {
  const plz = input.trim();
  return /^\d{5}$/.test(plz) ? { ok: true, plz } : { ok: false };
}

/** Region id of a postcode, or null when the postcode is not in the table. */
export function lookupPostcode(table: PlzTable, plz: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(table, plz)) return null;
  return table[plz]?.[2] ?? null;
}
