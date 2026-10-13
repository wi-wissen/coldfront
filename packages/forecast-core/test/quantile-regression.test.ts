import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkLoss, fitQuantileRegression, predictLinear } from '../src';

const golden = JSON.parse(readFileSync(new URL('../../../validation/quantreg.golden.json', import.meta.url), 'utf8')) as {
  X: number[][];
  y: number[];
  cases: { tau: number; coef: number[]; loss: number }[];
};

describe('fitQuantileRegression', () => {
  for (const c of golden.cases) {
    it(`matches statsmodels for tau=${c.tau}`, () => {
      const coef = fitQuantileRegression(golden.X, golden.y, c.tau);
      const loss = checkLoss(golden.X, golden.y, coef, c.tau);
      // objective within 0.5 % of the exact optimum, coefficients close
      expect(loss).toBeLessThanOrEqual(c.loss * 1.005);
      coef.forEach((b, i) => expect(Math.abs(b - c.coef[i]!)).toBeLessThan(0.15));
    });
  }
  it('is deterministic', () => {
    const a = fitQuantileRegression(golden.X, golden.y, 0.5);
    const b = fitQuantileRegression(golden.X, golden.y, 0.5);
    expect(a).toEqual(b);
  });
  it('predicts with the linear form', () => {
    expect(predictLinear([1, 2, 3], [1, 10, 100])).toBe(321);
  });
  it('recovers an exact line', () => {
    const X = [0, 1, 2, 3, 4, 5].map((x) => [1, x]);
    const y = X.map((r) => 2 + 3 * r[1]!);
    const coef = fitQuantileRegression(X, y, 0.5);
    expect(coef[0]).toBeCloseTo(2, 2);
    expect(coef[1]).toBeCloseTo(3, 2);
  });
  it('orders quantiles on the same data', () => {
    const lo = fitQuantileRegression(golden.X, golden.y, 0.1);
    const hi = fitQuantileRegression(golden.X, golden.y, 0.9);
    const x = [1, 0, 0];
    expect(predictLinear(lo, x)).toBeLessThan(predictLinear(hi, x));
  });
});
