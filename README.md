# Coldfront

Forecasts of acute respiratory illness for Germany: one to four weeks ahead, nationally and for the 16 federal states, with honest uncertainty bands.

**Live site:** <https://coldfront.wi7.net/> (German and English) · **API:** static JSON under `/api/v1/` ([documentation](https://coldfront.wi7.net/api.html))

Coldfront is a statistical estimate built from public data only. It is **not medical advice and not an official product**, and it is not created or endorsed by the Robert Koch Institute (RKI), the German Weather Service (DWD) or any other body named here.

## What it forecasts

The target is the RKI **ARE consultation incidence**: the estimated number of doctor visits for acute respiratory illness per 100,000 inhabitants and week. The forecast is the expected value for the next four weeks, with 50 % and 80 % bands (quantiles q10, q25, q50, q75, q90) and an activity level relative to the seasonal norm.

The model does not forecast how severe a season will be. Severity depends on the pathogen mix, immunity and vaccination, which cannot be predicted months ahead. It extends what is observed by one to four weeks.

Known artefact: ISO week 52 (between Christmas and New Year) is depressed because people do not visit a doctor then. This is a care-seeking effect, not a disease effect.

## How it works

1. **Ingest** public weekly data and append only new or changed values to versioned tables, so any earlier data version can be reconstructed.
2. **Clean** the series per region (national level and federal states).
3. **Forecast** with an ensemble of a seasonal baseline and a pooled linear quantile regression on log growth. Features: dynamics, season, vacation periods (further feature groups are tested in the backtest); closed days are corrected by a calendar effect.
4. **Evaluate** with a rolling-origin backtest that uses only the knowledge available at each origin. Quality gates decide what is published; if the model does not beat the seasonal baseline by the pre-registered margin, the baseline is shipped.
5. **Publish** a static site (Vite multi-page, prerendered) and a static JSON API on GitHub Pages. The "Check it yourself" page recomputes a past season in your browser with the very same code.

The full method, the evaluation protocol and the current results are on the site's **Method** page. Start values without evidence (ensemble weights, ridge penalty, the 10 % gate, activity thresholds) are labelled as such.

## Data sources and licences

| Source | Use | Licence / attribution |
|---|---|---|
| RKI ARE-Konsultationsinzidenz, GrippeWeb, influenza cases (IfSG) | target and signals | CC BY 4.0, "Quelle: Robert Koch-Institut" |
| RKI / Umweltbundesamt wastewater surveillance (AMELAG) | optional early indicator | CC BY 4.0, "Robert Koch-Institut und Umweltbundesamt" |
| DWD climate data (daily station observations) | weather features | CC BY 4.0, "Quelle: Deutscher Wetterdienst"; weekly means computed |
| BKG VG250 administrative boundaries | map | dl-de/by-2-0, "© GeoBasis-DE / BKG", geometry simplified |
| GeoNames | postcode lookup, locating wastewater plants | CC BY 4.0 |
| State vacation periods (KMK overview) | calendar feature | dates are facts; source recorded per entry |

Details, retrieval dates and checksums: [`THIRD_PARTY_DATA.md`](THIRD_PARTY_DATA.md), `data/sources/*.json` and the site page "Data & sources". Data keep the licence of their source; forecasts are our own derivative calculations and must be attributed as "Quelle: Robert Koch-Institut, Umweltbundesamt, Deutscher Wetterdienst; eigene Berechnung".

**Code licence:** not chosen yet. Until one is added, all rights to the code are reserved by its authors.

## Repository layout

| Path | Purpose |
|---|---|
| `packages/forecast-core` | Pure TypeScript (browser and Node): ISO weeks, vintages, baseline, quantile regression, regional model, ensemble, WIS and the backtest/evaluation protocol |
| `packages/charts` | Vue chart components (forecast chart, map, backtest chart), no third-party requests |
| `pipeline` | Node CLI: ingest, build series, forecast, backtest, export. The only place with network access |
| `site` | Vite multi-page app (Vue 3 Options API, vue-i18n, Tailwind), prerendered to static HTML |
| `data` | source pointers, append-only long tables, cleaned series, external data (geo, vacation periods) |
| `forecasts` | published forecasts, backtest results, archive |
| `validation` | reference values for the quantile regression (Python / statsmodels) |
| `e2e` | real-browser tests (Playwright) |

Architecture notes and working rules for contributors and agents are in [`CLAUDE.md`](CLAUDE.md).

## Development

Requires Node 22.

```sh
npm ci
npm run check        # typecheck + unit tests of all workspaces
npm run build        # site: client build, server build, prerender -> site/dist
npm run e2e          # real-browser tests against the built site (needs Chromium)
```

Weekly data run (also done by the GitHub workflow `pages.yml`, Thursdays):

```sh
npm run ingest           # download sources, append new/changed values
npm run build:series     # cleaned series per region
npm run forecast         # live monitor, forecasts, API files
```

Evaluation (the test season is evaluated once; `backtest test` refuses to overwrite an existing result without `--force`):

```sh
npm run backtest -w pipeline -- tune
npm run backtest -w pipeline -- test
```

Set `NODE_USE_ENV_PROXY=1` when downloading behind an HTTP proxy.

## Deployment

GitHub Pages via GitHub Actions (`.github/workflows/pages.yml`): build, then deploy the `site/dist` artifact. The custom domain `coldfront.wi7.net` is configured in the repository's Pages settings; the build also writes a `CNAME` file. `test.yml` runs typecheck, unit tests, the build and the E2E tests on every push and pull request.

## Honest limits

- State-level ARE data exist only since 2022-W40, so there are few seasons to learn from and to evaluate on. National results rest on a longer history.
- ARE counts consultations, so closed days (and especially the week between Christmas and New Year) depress it independent of disease. The model corrects for this with a fixed calendar effect.
- The RKI corrects recent values retroactively. Earlier data versions are rebuilt from the RKI's public git history (since 2023-09); the backtest uses today's corrected data and a separate comparison shows the effect of real data versions (a few percent in WIS).
- Protocol v2 was amended after the first evaluation of the 2025/26 season. That season is therefore only a descriptive re-evaluation; the next untouched test season is 2026/27. The Method page shows both rounds.
- Peak timing is predicted only at a horizon of one week (about half of the seasons within one week); at two to four weeks ahead it is clearly weak.
- A comparison with the RESPINOW forecasts exists for the national level only and is not a fair contest (see the Method page).
- No individual-level statements and no medical statements are made.
