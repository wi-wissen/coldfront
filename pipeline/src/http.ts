import { createHash } from 'node:crypto';

export interface Downloaded {
  bytes: Uint8Array;
  sha256: string;
}

/** Download a URL (follows redirects, honours HTTPS_PROXY when NODE_USE_ENV_PROXY=1). */
export async function download(url: string, init?: RequestInit): Promise<Downloaded> {
  const res = await fetch(url, { redirect: 'follow', ...init });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { bytes, sha256: createHash('sha256').update(bytes).digest('hex') };
}

export async function downloadText(url: string): Promise<{ text: string; sha256: string }> {
  const d = await download(url);
  return { text: new TextDecoder('utf-8').decode(d.bytes).replace(/^﻿/, ''), sha256: d.sha256 };
}
