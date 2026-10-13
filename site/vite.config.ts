import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { createReadStream, existsSync, mkdirSync, copyFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { apiFiles, apiSource, sourcesJson } from './scripts/api';
import { GEN_DIR, TAG, generateShells } from './scripts/shells';

/** Serves the JSON API in dev/preview and copies it to dist/api/v1 on build. */
function apiPlugin(): Plugin {
  const serve = (server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void } }) => {
    server.middlewares.use((req, res, next) => {
      const b = /^\/brand\/([\w.-]+\.svg)$/.exec(req.url ?? '');
      if (b && existsSync(resolve(import.meta.dirname, 'brand', b[1]!))) {
        res.setHeader('content-type', 'image/svg+xml');
        return createReadStream(resolve(import.meta.dirname, 'brand', b[1]!)).pipe(res);
      }
      const m = /^\/api\/v1\/(.+?)(?:\?.*)?$/.exec(req.url ?? '');
      if (!m) return next();
      if (m[1] === 'sources.json') {
        res.setHeader('content-type', 'application/json');
        return res.end(sourcesJson());
      }
      const src = apiSource(m[1]!);
      if (!src || !existsSync(src)) {
        res.statusCode = 404;
        return res.end('not found');
      }
      res.setHeader('content-type', src.endsWith('.gz') ? 'application/gzip' : src.endsWith('.csv') ? 'text/csv' : src.endsWith('.yml') ? 'text/yaml' : 'application/json');
      createReadStream(src).pipe(res);
    });
  };
  return {
    name: 'coldfront-api',
    configureServer: serve,
    configurePreviewServer: undefined,
    closeBundle() {
      const out = resolve(import.meta.dirname, `dist${TAG}/api/v1`);
      for (const [rel, src] of apiFiles()) {
        const dest = resolve(out, rel);
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(src, dest);
      }
      writeFileSync(resolve(out, 'sources.json'), sourcesJson());
      // Brand assets (logo, favicon) and the custom domain for GitHub Pages.
      const brandDir = resolve(import.meta.dirname, 'brand');
      const brandOut = resolve(import.meta.dirname, `dist${TAG}/brand`);
      mkdirSync(brandOut, { recursive: true });
      for (const f of readdirSync(brandDir)) if (f.endsWith('.svg')) copyFileSync(resolve(brandDir, f), resolve(brandOut, f));
      writeFileSync(resolve(import.meta.dirname, `dist${TAG}/CNAME`), 'coldfront.wi7.net\n');
    },
  };
}

export default defineConfig(({ command, isSsrBuild }) => {
  const inputs = command === 'build' && isSsrBuild ? [] : generateShells();
  return {
    root: GEN_DIR,
    base: './',
    publicDir: false,
    plugins: [vue(), tailwindcss(), apiPlugin()],
    resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
    server: { port: 5177, strictPort: true, fs: { allow: ['..', '../..'] } },
    preview: { port: 5177, strictPort: true },
    build: {
      outDir: resolve(import.meta.dirname, isSsrBuild ? `dist-ssr${TAG}` : `dist${TAG}`),
      emptyOutDir: !isSsrBuild,
      rollupOptions: { input: isSsrBuild ? resolve(import.meta.dirname, 'src/ssr.ts') : inputs },
    },
  };
});
