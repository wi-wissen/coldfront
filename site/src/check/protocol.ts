import type { Horizon } from '@coldfront/forecast-core';
import type { CheckResult } from './compute';

/** Message from the page to the worker. The worker fetches its inputs from `base` + "api/v1/". */
export interface CheckRequest {
  type: 'start';
  base: string;
  region: string;
  season: string;
  horizon: Horizon;
  refitEvery?: number;
}

export interface CheckProgressMessage {
  type: 'progress';
  done: number;
  total: number;
}

export interface CheckResultMessage {
  type: 'result';
  result: CheckResult;
}

export interface CheckErrorMessage {
  type: 'error';
  message: string;
}

/** Message from the worker to the page. */
export type CheckResponse = CheckProgressMessage | CheckResultMessage | CheckErrorMessage;
