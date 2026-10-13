# Coldfront – architecture & working rules

Coldfront is a public, static website plus JSON "API" that forecasts respiratory-illness
activity (ARE consultation incidence) for Germany, 1–4 weeks ahead, with uncertainty bands.
Data: public sources only (RKI, DWD, BKG, GeoNames). The repository and the site contain
nothing about any other product or institution; keep it that way (code, comments, copy, i18n).

Language rules: chat with the owner in German; code, comments, commit messages in English;
all UI text via i18n (de + en), never hard-coded in components.

## Layout (npm workspaces)

| Path | Purpose | Depends on |
|---|---|---|
| `packages/forecast-core` | Pure TS: ISO weeks, series, vintages, baseline, quantile regression, regional model, metrics (WIS), backtest. No network, no Vue, no Node APIs in `src/` (runs in browser and Node). Zero runtime dependencies. | – |
| `packages/charts` | Vue 3 (Options API) components: `ForecastChart` (d3-scale/d3-shape SVG), `GermanyMap` (d3-geo SVG choropleth), `DataTable`. No requests to third parties, no i18n dependency (labels come via props). | forecast-core types |
| `pipeline` | Node/tsx CLI: `ingest` → `build-series` → `forecast` → `backtest` → export. Only place with network access. | forecast-core |
| `site` | Vite **multi-page** app (Vue 3 Options API, vue-i18n, Tailwind 4). Pages are prerendered to static HTML after the build (see below). | charts, forecast-core |
| `data/` | `sources/` pointers (DOI/URL, SHA-256, licence), `long/` append-only weekly tables with `as_of`, `clean/` cleaned series, `external/` weather, holidays, geo. | – |
| `forecasts/` | `index.json`, `<region>/latest.json`, archived outputs, `backtest/` metrics. | – |
| `validation/` | Golden files generated with Python/statsmodels (`make_golden.py`). | – |
| `e2e/` | Playwright real-browser tests against the built site. | – |

## Data flow

1. `ingest`: download source → parse → weekly long rows → `appendChanges` into `data/long/<indicator>.csv.gz` (only new/changed rows get a new `as_of`). Raw files are never stored; `data/sources/<name>.json` stores URL, retrieval date, SHA-256, licence.
2. `build-series`: `snapshotAt(rows, asOf)` → cleaned weekly series per region → `data/clean/<region>/<indicator>.csv`.
3. `forecast`: fits the ensemble (baseline + linear quantile regression) → `forecasts/<region>/latest.json` + archive.
4. `backtest`: rolling-origin evaluation, writes `forecasts/backtest/*.json`. Evaluation rules live in `pipeline/config/evaluation.json` and are frozen *before* the first evaluation (see "Evaluation protocol").
5. `site build`: Vite MPA → prerender → `dist/` which also contains `data`-derived JSON (`/api/v1/...`).

Region ids: `de`, `de-<iso2 lower>` (e.g. `de-sn`), `ww-<slug>` for wastewater plants.
Quantile levels: 0.1/0.25/0.5/0.75/0.9, flat keys `q10…q90`. 50 % band = q25–q75, 80 % band = q10–q90.

## Implemented layout notes (deviations from the first sketch)

* Cleaned inputs live in `data/clean/<region>/series.csv` (one wide CSV per region: `week,are,wastewater_*,tmax,tmin,holiday`), not one file per indicator. Weather is stored in the append-only table `data/long/weather.csv.gz` (weekly values since 2012) instead of separate files.
* Evaluation protocol code (`EvalConfig`, builders, `runTuning`, `runTest`) lives in `packages/forecast-core/src/evaluation.ts` so the browser self-check runs the very same code as the pipeline. Config files: `pipeline/config/evaluation.json` (frozen) and `pipeline/config/model.json` (chosen on tuning seasons); both are copied to `forecasts/backtest/` on every run.
* Public API (static, `/api/v1/…`) is produced from repo files by `site/scripts/api.ts`: `index.json`, `regions/<id>.json`, `series.json`, `backtest/*.json`, `geo/*`, `sources.json`, `archive/<date>.json.gz`, `holidays/<year>.json`.
* Data gates (publish only if all hold): schema validation of every forecast file; newest ARE week at most 3 weeks behind the issue date; `forecasts/backtest/test.json` gate decides ensemble vs baseline. `backtest test` refuses to overwrite the single test-season evaluation without `--force`.
* Vacation periods are called "Ferienzeiten"/"vacation periods" (state-wide, from the KMK overview); unknown before the first recorded entry (autumn 2022) → missing, not zero.
* Parallel builds: set `CF_TAG=<name>` to isolate `.gen<tag>`, `dist<tag>`, `dist-ssr<tag>`; each agent uses its own port (5171–5179; 5177 = lead's preview/E2E).

## Protocol v2 (amended 2026-10-13, see `amendments` in `pipeline/config/evaluation.json`)

* Why: a diagnosis on the tuning seasons only found a large care-seeking calendar effect in ARE (closed weekday ≈ 0.81×, week between the years ≈ 0.4×; not in GrippeWeb), a flawed peak metric and an inconsistent wastewater lag. Fixes: `packages/forecast-core/src/calendar.ts` (holidays incl. state holidays, Easter, fixed log effects), calendar-adjusted regional model and calendar-aligned baseline, lags applied identically in training and prediction, joint (ensemble weight, spread) choice on a grid, per-horizon `peakTiming`.
* The first protocol's test season 2025/26 was evaluated once (`forecasts/backtest/test-v1.json`, `tuning-v1.json`, `pipeline/config/model-v1.json`). Under v2 it was evaluated again for description only; **it is no longer untouched**. The next untouched test season is 2026/27: evaluate once after 2027-W39 (`backtest test --force` only for that purpose, and document it).
* Real data versions: `data/long/are.csv.gz` holds 158 ARE versions rebuilt from the RKI git history (`pipeline backfill --repo <clone>`); `backtest vintage` compares today's data with the data known at each origin; the RESPINOW comparison is `pipeline external --respinow <clone>`.
* Gate reference is the calendar-aligned baseline; `baseline-plain` is reported for continuity. Live monitor: archived forecasts are scored against later actuals; the baseline replaces the ensemble after ≥ 8 runs if it scores worse.
* Licence of the code: not chosen yet (do not claim MIT or any licence).

## Site: Vite multi-page + prerender

* Every page is its own HTML entry per locale: `site/<page>.html` (de) and `site/en/<page>.html` (en). Shell files only set `<html lang>`, `data-locale`, and load `src/pages/<page>.ts`.
* Pages: `index` (national forecast + map), `region` (`?r=de-sn`), `check` ("Selbst prüfen"/self-check), `sources` (Daten & Quellen), `api` (API docs), `method` (method + evaluation), `legal` (notice/disclaimer).
* `vite build` builds the client, `vite build --ssr src/ssr.ts` builds a server bundle, `scripts/prerender.ts` renders each page with `vue/server-renderer` into the HTML (static content such as sources/API/method is complete HTML; interactive pages render a complete shell and load JSON client-side). Client entries hydrate with `createSSRApp`.
* Attribution (source line) sits directly under every chart/map; footer links to "Daten & Quellen".

## Conventions

* TypeScript strict, ESM. Vue components use the **Options API** (`defineComponent`).
* Tests with Vitest; Vue components with `@vue/test-utils` + happy-dom. Real-browser E2E with Playwright using the preinstalled Chromium (`/opt/pw-browsers/chromium`, never `playwright install`).
* No randomness without a fixed seed. No `Date.now()` in `forecast-core` logic (pass dates in).
* No date library: ISO-week arithmetic is in `forecast-core/src/isoweek.ts`; display via `Intl.DateTimeFormat`.
* Commit only when `npm run check` (typecheck + tests) is green. Work directly on `main`.

## Evaluation protocol (pre-registered)

* Never split randomly. Rolling origin, only data known at the origin (availability lags per signal).
* Tuning seasons: all but the newest; the newest season is the untouched test season, evaluated once.
* Metrics: MAE, WIS, coverage of 50 %/80 % bands, per Bundesland and per wave phase; compared with seasonal baseline and persistence. Differences come with a block-bootstrap CI and the number of seasons where the model wins.
* A model is published only if mean WIS is at least 10 % below the baseline (starting value, unproven); otherwise the baseline is shipped.
* Start values without evidence (k, 10 %, etc.) are labelled as such wherever shown.

## Agent work packages (subagents)

Each subagent owns a closed set of files and a dedicated dev-server port (5171–5179). Agents never edit `package.json`/lockfile, files outside their boundary, or commit. The lead verifies everything independently (typecheck, tests, real-browser E2E) before committing.
