import { REGIONS, weekStart, type IsoWeek } from '@coldfront/forecast-core';
import type { SourceMeta } from '../types';

/** Kinds of state vacation periods; "other" = single days or cells without a clear kind. */
export type VacationKind = 'winter' | 'easter' | 'pentecost' | 'summer' | 'autumn' | 'christmas' | 'other';

export type VacationEntry = {
  region: string;
  kind: VacationKind;
  /** ISO date YYYY-MM-DD, inclusive */
  start: string;
  /** ISO date YYYY-MM-DD, inclusive; equals start for single days */
  end: string;
  source: string;
};

export interface KmkParseResult {
  entries: VacationEntry[];
  /** Cells or text that were not parsed or could not be classified. Reported, never guessed. */
  issues: string[];
}

export const SOURCE: Omit<SourceMeta, 'retrieved' | 'sha256'> = {
  id: 'kmk-ferien',
  name: 'Ferientermine der Bundesländer (KMK-Übersicht)',
  url: 'https://www.kmk.org/service/ferien.html',
  attribution: 'Ferientermine: Kultusministerkonferenz, Ferienkalender der Länder; eigene Erfassung',
  license: 'Termine sind Fakten; Quelle je Eintrag',
  license_url: 'https://www.kmk.org/service/ferien.html',
  doi: '',
};

interface ColumnDef {
  name: string;
  /** Matches the column header word in the PDF text */
  header: RegExp;
  kind: VacationKind;
  /** Year offset of the column relative to the first year of the PDF */
  yearOffset: 0 | 1;
}

/** Table columns in PDF order. Autumn and Christmas fall in the first year, the rest in the second. */
const COLUMNS: readonly ColumnDef[] = [
  { name: 'Herbst', header: /Herbst/, kind: 'autumn', yearOffset: 0 },
  { name: 'Weihnachten', header: /Weihnachten/, kind: 'christmas', yearOffset: 0 },
  { name: 'Winter', header: /Winter/, kind: 'winter', yearOffset: 1 },
  { name: 'Ostern', header: /Ostern\S*/, kind: 'easter', yearOffset: 1 },
  { name: 'Himmelfahrt/Pfingsten', header: /Himmelfahrt\S*/, kind: 'pentecost', yearOffset: 1 },
  { name: 'Sommer', header: /Sommer/, kind: 'summer', yearOffset: 1 },
];

const NAME_ALIASES: Record<string, string> = {
  Thueringen: 'de-th',
  'Baden-Wuerttemberg': 'de-bw',
};

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface RowDef {
  name: string;
  region: string;
  re: RegExp;
}

const ROW_DEFS: readonly RowDef[] = [
  ...REGIONS.filter((r) => r.id !== 'de').map((r) => ({ name: r.name_de, region: r.id })),
  ...Object.entries(NAME_ALIASES).map(([name, region]) => ({ name, region })),
].map((d) => ({ ...d, re: new RegExp(`^\\s*${escapeRe(d.name)}(?=\\s|\\(|$)`) }));

/**
 * "d.m." or "d.m." with an optional range end "- d.m."; the dot after the month is optional.
 * Older PDFs sometimes print "17. 05." with a space after the day dot; that is still unambiguous.
 */
const DATE_RE = /(\d{1,2})\.\s?(\d{1,2})\.?(?:\s*[–-]\s*(\d{1,2})\.\s?(\d{1,2})\.?)?/g;
/**
 * Cells whose start day or month cannot be read unambiguously: "19./20.06. - 02.08." (two
 * alternative start days) and "05. – 17.10." (start month missing). Reported and dropped.
 */
const AMBIGUOUS_RE =
  /(?<![\d.])\d{1,2}\.\s*(?:\/|[–-])\s*\d{1,2}\.\d{1,2}\.?(?:\s*[–-]\s*\d{1,2}\.\s?\d{1,2}\.?)?/g;
/** "--", en dash, a lone hyphen (older PDFs) or "keine" mark an empty cell. */
const MARKER_RE = /--|–|(?<!\S)-(?!\S)|keine/g;
/** Max distance (in lines) between a wrapped cell line and the row it belongs to. */
const MAX_WRAP_DISTANCE = 2;
/** Max distance (in characters) between a date and a column header center. */
const MAX_COLUMN_DISTANCE = 12;

const pad2 = (n: number): string => String(n).padStart(2, '0');

function isoDate(y: number, m: number, d: number): string | null {
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

const blank = (s: string): string => ' '.repeat(s.length);

interface Span {
  day: number;
  month: number;
}

interface Segment {
  raw: string;
  first: Span;
  second?: Span;
  column: number;
  line: number;
}

interface Row {
  region: string;
  name: string;
  lineNo: number;
  /** Columns with a date or marker on the row's own line */
  ownCols: Set<number>;
  /** Date segments on the row's own line plus wrapped lines attached to it */
  segments: Segment[];
  markers: Set<number>;
}

/**
 * Parse the text of one KMK overview PDF (output of `pdftotext -layout`).
 * `yearFrom` is the first calendar year of the season named in the PDF, e.g. 2025 for "2025/2026".
 * Pure: no I/O. Returns entries plus issues for everything that could not be parsed.
 */
export function parseKmkDetailed(text: string, yearFrom: number, source: string): KmkParseResult {
  const issues: string[] = [];
  const norm = text.normalize('NFC');
  const lines = norm.replace(/\r/g, '').split('\n');

  if (!norm.includes(`${yearFrom}/${yearFrom + 1}`)) {
    throw new Error(`PDF text does not name the years ${yearFrom}/${yearFrom + 1}`);
  }
  const headerIdx = lines.findIndex((l) => l.includes('Herbst') && l.includes('Sommer'));
  if (headerIdx < 0) throw new Error('KMK table header not found');
  const header = lines[headerIdx] ?? '';
  const centers = COLUMNS.map((c) => {
    const m = c.header.exec(header);
    if (!m) throw new Error(`Column ${c.header} not found in header`);
    return m.index + m[0].length / 2;
  });

  const nearestColumn = (center: number): number | null => {
    let best = -1;
    let bestDist = Infinity;
    centers.forEach((c, i) => {
      const d = Math.abs(c - center);
      if (d < bestDist) {
        best = i;
        bestDist = d;
      }
    });
    return bestDist <= MAX_COLUMN_DISTANCE ? best : null;
  };

  // The table ends at the footnote block ("*in Klammern ...", "Stand: ...").
  const footIdx = lines.findIndex((l, i) => i > headerIdx && /^\s*(\*|Stand:)/.test(l));
  const stop = footIdx < 0 ? lines.length : footIdx;
  // Header text of older PDFs ("(in Klammern Zahl der ...") sits between the column header and the first row.
  const firstRowIdx = lines.findIndex((l, i) => i > headerIdx && i < stop && ROW_DEFS.some((d) => d.re.test(l)));

  const rows: Row[] = [];
  /** Non-row lines: date segments or markers still waiting for a row */
  const pending: { line: number; column: number; seg?: Segment; raw: string }[] = [];

  for (let i = headerIdx + 1; i < stop; i++) {
    const rawLine = lines[i] ?? '';
    const lineNo = i + 1;
    const segments: Segment[] = [];

    for (const m of rawLine.matchAll(AMBIGUOUS_RE)) {
      const txt = m[0].trimEnd();
      const col = nearestColumn((m.index ?? 0) + txt.length / 2);
      const label = col === null ? 'outside the table' : `column ${COLUMNS[col]?.name ?? '?'}`;
      issues.push(`line ${lineNo}: "${txt}" in ${label} has an ambiguous start day or month; dropped`);
    }
    const raw = rawLine.replace(AMBIGUOUS_RE, blank);

    for (const m of raw.matchAll(DATE_RE)) {
      const txt = m[0].trimEnd();
      const col = nearestColumn((m.index ?? 0) + txt.length / 2);
      if (col === null) {
        issues.push(`line ${lineNo}: date "${txt}" is not inside a table column`);
        continue;
      }
      const seg: Segment = {
        raw: txt,
        first: { day: Number(m[1]), month: Number(m[2]) },
        column: col,
        line: lineNo,
      };
      if (m[3] !== undefined) seg.second = { day: Number(m[3]), month: Number(m[4]) };
      segments.push(seg);
    }

    // Blank out everything already understood; what remains must be markers or noise.
    let masked = raw.replace(DATE_RE, blank);
    const rowDef = ROW_DEFS.find((d) => d.re.test(rawLine));
    if (rowDef) masked = masked.replace(rowDef.re, blank);
    masked = masked.replace(/\([^()]*\)/g, blank).replace(/(^|\s)\d{1,2}(?=\s|$)/g, blank);
    masked = masked.replace(/\d{4}(\/\d{4})?/g, blank).replace(/Land\*?/g, blank);
    masked = masked.replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰*]/g, blank);

    const markers: number[] = [];
    for (const m of masked.matchAll(MARKER_RE)) {
      const col = nearestColumn((m.index ?? 0) + m[0].length / 2);
      if (col === null) issues.push(`line ${lineNo}: marker "${m[0]}" is not inside a table column`);
      else markers.push(col);
    }
    masked = masked.replace(MARKER_RE, blank);

    if (i >= firstRowIdx) {
      for (const tok of masked.split(/\s+/)) {
        if (tok && !['und', '/', '-'].includes(tok)) {
          issues.push(`line ${lineNo}: unrecognized text "${tok}"`);
        }
      }
    }

    if (rowDef) {
      const row: Row = {
        region: rowDef.region,
        name: rowDef.name,
        lineNo,
        ownCols: new Set([...segments.map((s) => s.column), ...markers]),
        segments: [...segments],
        markers: new Set(markers),
      };
      rows.push(row);
    } else {
      for (const seg of segments) pending.push({ line: lineNo, column: seg.column, seg, raw: seg.raw });
      for (const col of markers) pending.push({ line: lineNo, column: col, raw: '--' });
    }
  }

  // Attach wrapped lines to the nearest row above or below whose own cell in that column is empty.
  for (const item of pending) {
    const above = [...rows].reverse().find((r) => r.lineNo < item.line);
    const below = rows.find((r) => r.lineNo > item.line);
    const cands: { row: Row; dist: number }[] = [];
    if (above && item.line - above.lineNo <= MAX_WRAP_DISTANCE && !above.ownCols.has(item.column)) {
      cands.push({ row: above, dist: item.line - above.lineNo });
    }
    if (below && below.lineNo - item.line <= MAX_WRAP_DISTANCE && !below.ownCols.has(item.column)) {
      cands.push({ row: below, dist: below.lineNo - item.line });
    }
    const label = COLUMNS[item.column]?.name ?? '?';
    if (cands.length === 0) {
      issues.push(`line ${item.line}: "${item.raw}" in column ${label} has no unambiguous row; dropped`);
      continue;
    }
    if (cands.length === 2 && cands[0]!.dist === cands[1]!.dist) {
      issues.push(`line ${item.line}: "${item.raw}" in column ${label} is equidistant to two rows; dropped`);
      continue;
    }
    const target = cands.reduce((a, b) => (b.dist < a.dist ? b : a)).row;
    if (item.seg) target.segments.push(item.seg);
    else target.markers.add(item.column);
  }

  const found = new Set(rows.map((r) => r.region));
  for (const d of ROW_DEFS) {
    if (!found.has(d.region)) issues.push(`state row not found: ${d.name}`);
  }
  if (rows.length === 0) throw new Error('No state rows found in KMK table');

  const entries: VacationEntry[] = [];
  for (const row of rows) {
    for (let c = 0; c < COLUMNS.length; c++) {
      const col = COLUMNS[c]!;
      const segs = row.segments.filter((s) => s.column === c);
      if (segs.length === 0 && !row.markers.has(c)) {
        issues.push(`${row.name} / ${col.name}: no date and no "--" marker`);
      }
      const ranges = segs.filter((s) => s.second);
      if (ranges.length > 1) {
        issues.push(
          `${row.name} / ${col.name}: ${ranges.length} ranges in one cell; kind not determinable, recorded as "other"`,
        );
      }
      for (const s of segs) {
        const kind: VacationKind = !s.second || ranges.length > 1 ? 'other' : col.kind;
        const startYear = yearFrom + col.yearOffset;
        const start = isoDate(startYear, s.first.month, s.first.day);
        let end: string | null = start;
        if (s.second) {
          const wraps = s.second.month * 100 + s.second.day < s.first.month * 100 + s.first.day;
          end = isoDate(wraps ? startYear + 1 : startYear, s.second.month, s.second.day);
        }
        if (!start || !end || end < start) {
          issues.push(`${row.name} / ${col.name}: invalid dates "${s.raw}"`);
          continue;
        }
        entries.push({ region: row.region, kind, start, end, source });
      }
    }
  }
  return { entries, issues };
}

/** Entries only; see parseKmkDetailed for the issue list. */
export function parseKmkText(text: string, yearFrom: number, source: string): VacationEntry[] {
  return parseKmkDetailed(text, yearFrom, source).entries;
}

/**
 * Share (0..1, 3 decimals) of the Mon-Fri weekdays of each ISO week that lie in any
 * vacation entry of the region. Each weekday counts once, so overlaps do not double count.
 */
export function vacationShareByWeek(entries: VacationEntry[], region: string, weeks: IsoWeek[]): number[] {
  const relevant = entries.filter((e) => e.region === region);
  return weeks.map((w) => {
    const monday = weekStart(w).getTime();
    let days = 0;
    for (let i = 0; i < 5; i++) {
      const iso = new Date(monday + i * 86400000).toISOString().slice(0, 10);
      if (relevant.some((e) => e.start <= iso && iso <= e.end)) days++;
    }
    return Math.round((days / 5) * 1000) / 1000;
  });
}
