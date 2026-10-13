import type { ForecastFile } from '@coldfront/forecast-core';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { backfillAre } from './backfill';
import { buildCleanSeries, loadRegionData } from './clean-series';
import { loadEvalConfig, runTest, runTuning, type ModelChoice } from './evaluation';
import { CONFIG, FORECASTS } from './paths';
import { readJson, runForecast } from './run-forecast';
import { exportHubverse } from './export-hubverse';
import { exportSeries } from './export-series';
import { exportWastewater } from './export-wastewater';
import { runExternalComparison } from './external-compare';
import { evaluateArchive, readArchive, writeLiveReport } from './monitor';
import { runIngest } from './run-ingest';
import { readLongFile } from './long-table';
import { longPath } from './paths';
import { runVintageComparison } from './vintage-eval';

const [cmd = '', ...rest] = process.argv.slice(2);
const flag = (name: string) => rest.includes(`--${name}`);
const opt = (name: string) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const today = () => new Date().toISOString().slice(0, 10);
const asOf = opt('as-of') ?? today();

/** Publish the protocol and the chosen model next to the results (the in-browser self-check reads them). */
function publishConfig(): void {
  mkdirSync(resolve(FORECASTS, 'backtest'), { recursive: true });
  copyFileSync(resolve(CONFIG, 'evaluation.json'), resolve(FORECASTS, 'backtest/evaluation.json'));
  if (existsSync(resolve(CONFIG, 'model.json'))) copyFileSync(resolve(CONFIG, 'model.json'), resolve(FORECASTS, 'backtest/model.json'));
}

function write(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 1) + '\n');
}

async function main(): Promise<void> {
  switch (cmd) {
    case 'ingest':
      await runIngest(asOf, opt('only')?.split(','));
      break;
    case 'build-series': {
      const r = buildCleanSeries(asOf);
      console.log(`clean series for ${r.regions.length} regions, last ARE week ${r.lastWeek}`);
      break;
    }
    case 'backtest': {
      const phase = rest.find((a) => a === 'tune' || a === 'test' || a === 'vintage');
      const cfg = loadEvalConfig();
      const data = loadRegionData();
      if (phase === 'tune') {
        const res = runTuning(data, cfg, console.log);
        write(resolve(CONFIG, 'model.json'), { frozen_note: 'Chosen on the tuning seasons only.', ...res });
        write(resolve(FORECASTS, 'backtest/tuning.json'), res);
        publishConfig();
        console.log('chosen:', res.chosen);
      } else if (phase === 'test') {
        const out = resolve(FORECASTS, 'backtest/test.json');
        if (existsSync(out) && !flag('force')) throw new Error('Test season already evaluated; the protocol allows one evaluation (use --force to override and document it).');
        const choice = readJson<{ chosen: ModelChoice }>(resolve(CONFIG, 'model.json')).chosen;
        const res = runTest(data, cfg, choice);
        const notes = [
          'Protocol v2 (see amendments in evaluation.json). Season ' + cfg.seasons.test + ' was already evaluated once under v1 (test-v1.json); this second evaluation is descriptive and the season is no longer untouched.',
          'The backtest uses today\'s corrected data; see vintage.json for the effect of real data versions.',
        ];
        write(out, { generated: asOf, protocol_version: 2, notes, ...res });
        console.log(JSON.stringify(res.gate), JSON.stringify(res.overall));
      } else if (phase === 'vintage') {
        // Descriptive comparison: today's corrected data vs. the data versions known at each origin.
        const choice = readJson<{ chosen: ModelChoice }>(resolve(CONFIG, 'model.json')).chosen;
        const areRows = readLongFile(longPath('are'));
        const seasons = [...cfg.seasons.tuning, cfg.seasons.test];
        const results: Record<string, unknown> = {};
        for (const season of seasons) {
          console.log(`vintage comparison ${season} ...`);
          results[season] = runVintageComparison(data, cfg, choice, { areRows, seasons: [season] });
        }
        write(resolve(FORECASTS, 'backtest/vintage.json'), {
          generated: asOf,
          note: 'Actuals are today\'s corrected values in both modes; wastewater/weather revisions are not reproduced. Season ' + cfg.seasons.test + ' was already used once in the protocol; this is descriptive.',
          seasons: results,
        });
      } else throw new Error('usage: backtest tune|test|vintage');
      break;
    }
    case 'backfill': {
      const repo = opt('repo') ?? process.env.ARE_REPO_DIR;
      if (!repo) throw new Error('usage: backfill --repo <clone of robert-koch-institut/ARE-Konsultationsinzidenz>');
      const r = backfillAre(repo, asOf);
      console.log(`backfill: ${r.versions} versions, rows ${r.rowsBefore} -> ${r.rowsAfter}`);
      break;
    }
    case 'external': {
      const dir = opt('respinow') ?? process.env.RESPINOW_DIR;
      if (!dir) throw new Error('usage: external --respinow <clone of KITmetricslab/RESPINOW-Hub>');
      const choice = readJson<{ chosen: ModelChoice }>(resolve(CONFIG, 'model.json')).chosen;
      const res = runExternalComparison({ respinowDir: dir, data: loadRegionData(), cfg: loadEvalConfig(), choice, generated: asOf, retrieved: asOf });
      write(resolve(FORECASTS, 'backtest/external.json'), res);
      console.log('external comparison written');
      break;
    }
    case 'forecast': {
      const data = loadRegionData();
      const live = evaluateArchive(readArchive(), data, loadEvalConfig(), asOf);
      writeLiveReport(live);
      console.log(`live monitor: ${live.evaluated_runs} runs scored, fallback=${live.fallback}`);
      const idx = runForecast(data, asOf, asOf);
      console.log(`forecasts for ${idx.regions.length} regions (model ${idx.model})`);
      exportSeries();
      exportWastewater(asOf);
      publishConfig();
      exportHubverse(idx.regions.map((r) => readJson<ForecastFile>(resolve(FORECASTS, r.file))));
      break;
    }
    default:
      console.error('usage: cli.ts ingest|build-series|backtest tune|test|forecast [--as-of YYYY-MM-DD]');
      process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
