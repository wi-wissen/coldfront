import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { allPages, rootPrefix } from './pages';

/** CF_TAG isolates generated dirs and outputs when several builds/dev servers run in parallel. */
export const TAG = process.env.CF_TAG ?? '';
export const GEN_DIR = resolve(import.meta.dirname, `../.gen${TAG}`);

/** Write one tiny HTML shell per page into site/.gen (Vite input roots). */
export function generateShells(): string[] {
  rmSync(GEN_DIR, { recursive: true, force: true });
  const files: string[] = [];
  for (const p of allPages()) {
    const file = resolve(GEN_DIR, p.path);
    mkdirSync(dirname(file), { recursive: true });
    const depth = p.path.split('/').length - 1;
    const toSrc = '../'.repeat(depth + 1) + 'src/client.ts';
    const html = `<!doctype html>
<html lang="${p.locale}" data-page="${p.page}" data-locale="${p.locale}"${p.region ? ` data-region="${p.region}"` : ''} data-root="${rootPrefix(p.path)}" data-path="${p.path}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Coldfront</title>
<meta name="description" content="">
</head>
<body>
<div id="app"></div>
<script type="module" src="${toSrc}"></script>
</body>
</html>
`;
    writeFileSync(file, html);
    files.push(file);
  }
  return files;
}
