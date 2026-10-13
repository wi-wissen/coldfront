import type { Forecaster, ForecasterFactory, Horizon, IsoWeek, QuantileSet, RegionData } from './types';

export interface EnsembleMember {
  member: Forecaster;
  weight: number;
}

/**
 * Quantile averaging ("Vincentisation"): the ensemble quantiles are the weighted
 * means of the member quantiles. Members that return null are dropped and the
 * weights renormalised; if all return null the ensemble returns null.
 */
export function ensemble(name: string, members: readonly EnsembleMember[]): Forecaster {
  return {
    name,
    forecast(data: RegionData, origin: IsoWeek, horizons: readonly Horizon[]): QuantileSet[] | null {
      const parts: { f: QuantileSet[]; w: number }[] = [];
      for (const m of members) {
        const f = m.member.forecast(data, origin, horizons);
        if (f) parts.push({ f, w: m.weight });
      }
      if (parts.length === 0) return null;
      const total = parts.reduce((a, p) => a + p.w, 0);
      return horizons.map((h, i) => {
        const avg = (key: 'q10' | 'q25' | 'q50' | 'q75' | 'q90') => parts.reduce((a, p) => a + p.w * p.f[i]![key], 0) / total;
        return { iso_week: parts[0]!.f[i]!.iso_week, h, q10: avg('q10'), q25: avg('q25'), q50: avg('q50'), q75: avg('q75'), q90: avg('q90') };
      });
    },
  };
}

export interface EnsembleFactoryMember {
  factory: ForecasterFactory | Forecaster;
  weight: number;
}

/** Ensemble of factories and fixed forecasters, fitted per origin. */
export function ensembleFactory(name: string, members: readonly EnsembleFactoryMember[]): ForecasterFactory {
  return {
    name,
    fit(training, origin) {
      return ensemble(
        name,
        members.map((m) => ({ member: 'fit' in m.factory ? m.factory.fit(training, origin) : m.factory, weight: m.weight })),
      );
    },
  };
}

/**
 * Scale the spread of one forecast around its median in log space:
 * q' = median * (q / median)^k. k > 1 widens, k < 1 narrows. Keeps ordering.
 */
export function rescaleQuantiles(f: QuantileSet, k: number): QuantileSet {
  const m = f.q50;
  const s = (q: number) => (m > 0 && q > 0 ? m * Math.pow(q / m, k) : q);
  return { ...f, q10: s(f.q10), q25: s(f.q25), q50: m, q75: s(f.q75), q90: s(f.q90) };
}

/** Forecaster whose bands are widened/narrowed by k (calibrated on tuning seasons only). */
export function scaleSpread(f: Forecaster, k: number, name = f.name): Forecaster {
  return { name, forecast: (d, o, hs) => f.forecast(d, o, hs)?.map((x) => rescaleQuantiles(x, k)) ?? null };
}

export function scaleSpreadFactory(f: ForecasterFactory, k: number, name = f.name): ForecasterFactory {
  return { name, fit: (t, o) => scaleSpread(f.fit(t, o), k, name) };
}
