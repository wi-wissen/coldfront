export interface QuantRegOptions {
  /** L2 penalty on all coefficients except column 0 (the intercept). Default 1e-6. */
  ridge?: number;
  /** Maximum IRLS iterations. Default 200. */
  maxIter?: number;
  /** Stop when the relative change of the check loss is below this. Default 1e-10. */
  tol?: number;
}

/** Residual floor for the IRLS weights (avoids division by zero). */
const RESIDUAL_EPS = 1e-6;

/**
 * Linear quantile regression. X has one row per observation; column 0 must be a
 * constant 1 (intercept). Deterministic (no randomness). Returns coefficients.
 *
 * Solved by iteratively reweighted least squares: each step solves the weighted
 * ridge normal equations with weights (tau or 1-tau) / max(|r|, eps), which is the
 * Hunter-Lange IRLS for the check loss. The best iterate (lowest check loss) is kept.
 */
export function fitQuantileRegression(
  X: number[][],
  y: number[],
  tau: number,
  opts: QuantRegOptions = {},
): number[] {
  const ridge = opts.ridge ?? 1e-6;
  const maxIter = opts.maxIter ?? 200;
  const tol = opts.tol ?? 1e-10;
  const n = X.length;

  // Start from the least-squares fit (all weights equal).
  let beta = weightedSolve(X, y, new Array<number>(n).fill(1), ridge);
  let best = beta;
  let bestLoss = checkLoss(X, y, beta, tau);
  let prevLoss = bestLoss;

  for (let iter = 0; iter < maxIter; iter++) {
    const w = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const r = y[i]! - predictLinear(beta, X[i]!);
      const asym = r >= 0 ? tau : 1 - tau;
      w[i] = asym / Math.max(Math.abs(r), RESIDUAL_EPS);
    }
    beta = weightedSolve(X, y, w, ridge);
    const loss = checkLoss(X, y, beta, tau);
    if (loss < bestLoss) {
      bestLoss = loss;
      best = beta;
    }
    if (Math.abs(prevLoss - loss) <= tol * Math.max(loss, 1e-12)) break;
    prevLoss = loss;
  }
  return best.slice();
}

export function predictLinear(coef: number[], x: number[]): number {
  let s = 0;
  for (let j = 0; j < coef.length; j++) s += coef[j]! * x[j]!;
  return s;
}

/** Sum of the pinball (check) loss over all observations. */
export function checkLoss(X: number[][], y: number[], coef: number[], tau: number): number {
  let s = 0;
  for (let i = 0; i < X.length; i++) {
    const u = y[i]! - predictLinear(coef, X[i]!);
    s += u >= 0 ? tau * u : (tau - 1) * u;
  }
  return s;
}

/**
 * Weighted ridge least squares: (X'WX + ridge*D) b = X'Wy, D = diag(0, 1, ..., 1),
 * so the intercept (column 0) is not penalised.
 */
function weightedSolve(X: number[][], y: number[], w: number[], ridge: number): number[] {
  const p = X[0]?.length ?? 0;
  const A: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const b = new Array<number>(p).fill(0);
  for (let i = 0; i < X.length; i++) {
    const row = X[i]!;
    const wi = w[i]!;
    for (let j = 0; j < p; j++) {
      const wxj = wi * row[j]!;
      b[j]! += wxj * y[i]!;
      for (let k = 0; k < p; k++) A[j]![k]! += wxj * row[k]!;
    }
  }
  for (let j = 1; j < p; j++) A[j]![j]! += ridge;
  return solveLinear(A, b);
}

/** Gaussian elimination with partial pivoting. Solves A x = b; A and b are not modified. */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r]![col]!) > Math.abs(M[piv]![col]!)) piv = r;
    }
    if (piv !== col) [M[col], M[piv]] = [M[piv]!, M[col]!];
    const pivot = M[col]![col]!;
    if (pivot === 0) throw new Error('fitQuantileRegression: singular normal equations');
    for (let r = col + 1; r < n; r++) {
      const f = M[r]![col]! / pivot;
      if (f === 0) continue;
      for (let k = col; k <= n; k++) M[r]![k]! -= f * M[col]![k]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r]![n]!;
    for (let k = r + 1; k < n; k++) s -= M[r]![k]! * x[k]!;
    x[r] = s / M[r]![r]!;
  }
  return x;
}
