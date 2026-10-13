"""Generate golden reference values for quantile regression (statsmodels).

Run: python3 validation/make_golden.py
The TypeScript implementation is tested against the check-loss and the
coefficients stored in validation/quantreg.golden.json.
"""
import json
import numpy as np
import statsmodels.api as sm

rng = np.random.default_rng(20261013)
n = 400
x1 = rng.normal(size=n)
x2 = rng.uniform(-1, 1, size=n)
# heteroscedastic noise so that quantiles differ in slope
noise = rng.normal(size=n) * (0.5 + 0.5 * np.abs(x1))
y = 1.0 + 2.0 * x1 - 1.5 * x2 + noise
X = np.column_stack([np.ones(n), x1, x2])

cases = []
for tau in (0.1, 0.25, 0.5, 0.75, 0.9):
    res = sm.QuantReg(y, X).fit(q=tau, max_iter=5000, p_tol=1e-9)
    beta = res.params
    resid = y - X @ beta
    loss = float(np.sum(np.where(resid >= 0, tau * resid, (tau - 1) * resid)))
    cases.append({"tau": tau, "coef": [float(b) for b in beta], "loss": loss})

out = {
    "description": "statsmodels QuantReg reference, columns: intercept, x1, x2",
    "X": [[float(v) for v in row] for row in X],
    "y": [float(v) for v in y],
    "cases": cases,
}
with open("validation/quantreg.golden.json", "w") as f:
    json.dump(out, f)
print("ok", [round(c["loss"], 3) for c in cases])
