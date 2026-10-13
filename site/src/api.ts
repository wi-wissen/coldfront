import type { Locale } from './types';

/** Fetch JSON from the site's own API (never from third parties). `root` is the data-root of the page. */
export async function getJson<T>(root: string, rel: string): Promise<T> {
  const res = await fetch(`${root}api/v1/${rel}`);
  if (!res.ok) throw new Error(`GET ${rel} -> ${res.status}`);
  return (await res.json()) as T;
}

export function rootOf(): string {
  return document.documentElement.dataset.root ?? './';
}

export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}

export function formatNumber(v: number, locale: Locale, digits = 0): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);
}
