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
