/// <reference lib="webworker" />
// Dedicated worker: fetches the public inputs, runs the shared evaluation and posts progress.
// Created by the page only after a button press (never during SSR); cancel = worker.terminate().
import type { EvalConfig, ModelChoice, SeriesExport } from '@coldfront/forecast-core';
import { computeCheck, REFIT_EVERY } from './compute';
import type { CheckRequest, CheckResponse } from './protocol';

const scope = self as unknown as {
  postMessage: (msg: CheckResponse) => void;
  onmessage: ((ev: MessageEvent<CheckRequest>) => void) | null;
};

async function getJson<T>(base: string, rel: string): Promise<T> {
  const res = await fetch(`${base}api/v1/${rel}`);
  if (!res.ok) throw new Error(`GET ${rel} -> ${res.status}`);
  return (await res.json()) as T;
}

scope.onmessage = async (ev: MessageEvent<CheckRequest>) => {
  const req = ev.data;
  if (req.type !== 'start') return;
  try {
    const [series, cfg, model] = await Promise.all([
      getJson<SeriesExport>(req.base, 'series.json'),
      getJson<EvalConfig>(req.base, 'backtest/evaluation.json'),
      getJson<{ chosen: { candidate: string; groups: string[]; spread_factor: number } }>(req.base, 'backtest/model.json'),
    ]);
    const choice = model.chosen as unknown as ModelChoice;
    const result = computeCheck(series, cfg, choice, req.region, req.season, req.horizon, (done, total) => {
      scope.postMessage({ type: 'progress', done, total });
    }, req.refitEvery ?? REFIT_EVERY);
    scope.postMessage({ type: 'result', result });
  } catch (e) {
    scope.postMessage({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
};
