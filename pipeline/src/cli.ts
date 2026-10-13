import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildCleanSeries, loadRegionData } from './clean-series';
import { loadEvalConfig, runTest, runTuning, type ModelChoice } from './evaluation';
import { CONFIG, FORECASTS } from './paths';
import { readJson, runForecast } from './run-forecast';
import { exportSeries } from './export-series';
import { runIngest } from './run-ingest';

const [cmd = '', ...rest] = process.argv.slice(2);
const flag = (name: string) => rest.includes(`--${name}`);
const opt = (name: string) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const today = () => new Date().toISOString().slice(0, 10);
const asOf = opt('as-of') ?? today();

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
      const phase = rest.find((a) => a === 'tune' || a === 'test');
      const cfg = loadEvalConfig();
      const data = loadRegionData();
      if (phase === 'tune') {
        const res = runTuning(data, cfg, console.log);
        write(resolve(CONFIG, 'model.json'), { frozen_note: 'Chosen on the tuning seasons only.', ...res });
        write(resolve(FORECASTS, 'backtest/tuning.json'), res);
        console.log('chosen:', res.chosen);
      } else if (phase === 'test') {
        const out = resolve(FORECASTS, 'backtest/test.json');
        if (existsSync(out) && !flag('force')) throw new Error('Test season already evaluated; the protocol allows one evaluation (use --force to override and document it).');
        const choice = readJson<{ chosen: ModelChoice }>(resolve(CONFIG, 'model.json')).chosen;
        const res = runTest(data, cfg, choice);
        write(out, { generated: asOf, ...res });
        console.log(JSON.stringify(res.gate), JSON.stringify(res.overall));
      } else throw new Error('usage: backtest tune|test');
      break;
    }
    case 'forecast': {
      const idx = runForecast(loadRegionData(), asOf, asOf);
      console.log(`forecasts for ${idx.regions.length} regions (model ${idx.model})`);
      exportSeries();
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
