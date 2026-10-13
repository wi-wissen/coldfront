import { addWeeks, makeRng, weeksBetween, type IsoWeek, type RegionData, type WeeklySeries } from '../src';

/** Synthetic seasonal incidence: winter wave peaking at week ~6, multiplicative noise. */
export function syntheticRegion(region: string, start: IsoWeek, weeks: number, seed: number, level = 1000): RegionData {
  const rng = makeRng(seed);
  const values: number[] = [];
  const holiday: number[] = [];
  for (let i = 0; i < weeks; i++) {
    const w = addWeeks(start, i);
    const wk = Number(w.slice(6));
    const phase = (2 * Math.PI * (wk - 6)) / 52;
    const wave = Math.exp(1.2 * Math.cos(phase));
    // yearly amplitude variation so seasons differ
    const yr = Number(w.slice(0, 4));
    const amp = 0.8 + 0.4 * (((yr * 7) % 5) / 4);
    values.push(level * Math.pow(wave, amp) * Math.exp(0.08 * (rng() - 0.5)));
    holiday.push(wk >= 52 || wk <= 1 ? 1 : 0);
  }
  const s = (v: number[]): WeeklySeries => ({ start, values: v });
  return { region, target: s(values), signals: { holiday: s(holiday) } };
}

export const weeksFrom = (a: IsoWeek, b: IsoWeek) => weeksBetween(a, b);
