import { compareWeeks, regionByIso2, slugify, weekOfDate, type IsoWeek } from '@coldfront/forecast-core';
import type { NewRow, SourceMeta } from '../types';

/** Provenance; retrieval date and SHA-256 are added by the download step. */
export const SOURCE: Omit<SourceMeta, 'retrieved' | 'sha256'> = {
  id: 'amelag',
  name: 'Abwassersurveillance AMELAG (Einzelstandorte)',
  url: 'https://raw.githubusercontent.com/robert-koch-institut/Abwassersurveillance_AMELAG/main/amelag_einzelstandorte.tsv',
  attribution: 'Robert Koch-Institut und Umweltbundesamt, Abwassersurveillance AMELAG, CC BY 4.0',
  license: 'CC BY 4.0',
  license_url: 'https://creativecommons.org/licenses/by/4.0/',
  doi: '',
};

/** Every column of the published file; the header must contain all of them. */
const COLUMNS = [
  'standort', 'bundesland', 'datum', 'viruslast', 'viruslast_normalisiert', 'vorhersage',
  'obere_schranke', 'untere_schranke', 'einwohner', 'laborwechsel', 'typ', 'unter_bg',
] as const;

export interface WastewaterSite {
  /** "ww-<slug>", plus "-<iso2 lower>" when the name occurs in several states. */
  id: string;
  /** Site name as published (standort). */
  name: string;
  /** Federal-state region id, e.g. "de-sn". */
  region: string;
  /** Catchment population from the latest row with a value; null if never given. */
  population: number | null;
  first_week: IsoWeek;
  last_week: IsoWeek;
  /** Pathogens with at least one measured value, sorted. */
  pathogens: string[];
}

interface SiteAcc {
  name: string;
  state: string;
  iso2: string;
  id: string;
  population: number | null;
  populationDate: string;
  first: IsoWeek | null;
  last: IsoWeek | null;
  pathogens: Set<string>;
}

/** Mean of the measured days of one site, pathogen and ISO week. */
interface Cell {
  site: SiteAcc;
  typ: string;
  week: IsoWeek;
  sum: number;
  n: number;
}

/** Unweighted accumulator over site-week means (state and national rows). */
interface Acc {
  region: string;
  series: string;
  week: IsoWeek;
  sum: number;
  n: number;
}

const round4 = (x: number): number => Math.round(x * 1e4) / 1e4;

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function stripCr(line: string): string {
  return line.charCodeAt(line.length - 1) === 13 ? line.slice(0, -1) : line;
}

function addTo(map: Map<string, Acc>, key: string, region: string, series: string, week: IsoWeek, v: number): void {
  const a = map.get(key);
  if (a) {
    a.sum += v;
    a.n += 1;
  } else {
    map.set(key, { region, series, week, sum: v, n: 1 });
  }
}

function weekFor(cache: Map<string, IsoWeek>, datum: string, lineNo: number): IsoWeek {
  const hit = cache.get(datum);
  if (hit !== undefined) return hit;
  const d = new Date(`${datum}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== datum) {
    throw new Error(`AMELAG: invalid date "${datum}" (line ${lineNo})`);
  }
  const w = weekOfDate(d);
  cache.set(datum, w);
  return w;
}

/**
 * Parses the AMELAG single-site file (one row per site, day and pathogen) into
 * weekly long rows (site, state and national level) and a site list.
 * Only measured values (viruslast_normalisiert) are used.
 */
export function parseAmelag(text: string): { rows: NewRow[]; sites: WastewaterSite[] } {
  const lines = text.split('\n');
  const header = stripCr(lines[0] ?? '').split('\t');
  const col = new Map<string, number>(header.map((h, i): [string, number] => [h, i]));
  const idx = {} as Record<(typeof COLUMNS)[number], number>;
  for (const name of COLUMNS) {
    const i = col.get(name);
    if (i === undefined) throw new Error(`AMELAG: header lacks column "${name}"`);
    idx[name] = i;
  }
  const width = header.length;

  const weekCache = new Map<string, IsoWeek>();
  const sites = new Map<string, SiteAcc>();
  const cells = new Map<string, Cell>();

  for (let ln = 1; ln < lines.length; ln++) {
    const line = stripCr(lines[ln]!);
    if (line === '') continue;
    const f = line.split('\t');
    if (f.length !== width) throw new Error(`AMELAG: line ${ln + 1} has ${f.length} fields, expected ${width}`);

    const standort = f[idx.standort]!;
    const code = f[idx.bundesland]!;
    const datum = f[idx.datum]!;
    const typ = f[idx.typ]!;

    // A site is a (standort, bundesland) pair; the same name in two states is two sites.
    const siteKey = `${standort}\t${code}`;
    let site = sites.get(siteKey);
    if (!site) {
      const region = regionByIso2(code);
      if (!region) throw new Error(`AMELAG: unknown bundesland code "${code}" (line ${ln + 1})`);
      site = {
        name: standort, state: region.id, iso2: region.iso2, id: '',
        population: null, populationDate: '', first: null, last: null, pathogens: new Set(),
      };
      sites.set(siteKey, site);
    }

    // Population: value on the latest date that has one (ties: later row wins).
    const popRaw = f[idx.einwohner]!;
    if (popRaw !== 'NA' && popRaw !== '' && datum >= site.populationDate) {
      const v = Number(popRaw);
      if (Number.isFinite(v)) {
        site.population = Math.round(v);
        site.populationDate = datum;
      }
    }

    const raw = f[idx.viruslast_normalisiert]!;
    if (raw === 'NA' || raw === '') continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;

    const week = weekFor(weekCache, datum, ln + 1);
    site.pathogens.add(typ);
    if (site.first === null || compareWeeks(week, site.first) < 0) site.first = week;
    if (site.last === null || compareWeeks(week, site.last) > 0) site.last = week;

    const cellKey = `${siteKey}\t${typ}\t${week}`;
    const cell = cells.get(cellKey);
    if (cell) {
      cell.sum += value;
      cell.n += 1;
    } else {
      cells.set(cellKey, { site, typ, week, sum: value, n: 1 });
    }
  }

  // Only sites with at least one measured value are published.
  const measured = [...sites.values()].filter(
    (s): s is SiteAcc & { first: IsoWeek; last: IsoWeek } => s.first !== null && s.last !== null,
  );

  const statesByName = new Map<string, Set<string>>();
  for (const s of measured) {
    const set = statesByName.get(s.name) ?? new Set<string>();
    set.add(s.state);
    statesByName.set(s.name, set);
  }
  const idOwner = new Map<string, string>();
  for (const s of measured) {
    const slug = slugify(s.name);
    if (slug === '') throw new Error(`AMELAG: standort "${s.name}" has no usable slug`);
    const dup = (statesByName.get(s.name)?.size ?? 0) > 1;
    s.id = `ww-${slug}${dup ? `-${s.iso2.toLowerCase()}` : ''}`;
    const owner = idOwner.get(s.id);
    if (owner !== undefined) throw new Error(`AMELAG: site ids collide: "${owner}" and "${s.name}" -> ${s.id}`);
    idOwner.set(s.id, s.name);
  }

  const rows: NewRow[] = [];
  const stateAcc = new Map<string, Acc>();
  const natAcc = new Map<string, Acc>();
  for (const c of cells.values()) {
    const mean = c.sum / c.n;
    rows.push({ region: c.site.id, series: c.typ, week: c.week, value: round4(mean) });
    addTo(stateAcc, `${c.site.state}\t${c.typ}\t${c.week}`, c.site.state, `ww|${c.typ}`, c.week, mean);
    addTo(natAcc, `${c.typ}\t${c.week}`, 'de', `ww|${c.typ}`, c.week, mean);
  }
  for (const a of [...stateAcc.values(), ...natAcc.values()]) {
    rows.push({ region: a.region, series: a.series, week: a.week, value: round4(a.sum / a.n) });
  }
  rows.sort((x, y) => cmp(x.region, y.region) || cmp(x.series, y.series) || cmp(x.week, y.week));

  const siteRows: WastewaterSite[] = measured
    .map((s) => ({
      id: s.id,
      name: s.name,
      region: s.state,
      population: s.population,
      first_week: s.first,
      last_week: s.last,
      pathogens: [...s.pathogens].sort(),
    }))
    .sort((a, b) => cmp(a.id, b.id));

  return { rows, sites: siteRows };
}
