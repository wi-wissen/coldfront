import { scaleLinear } from 'd3-scale';

/** Seven viridis stops (sequential, colour-blind safe). */
export const VIRIDIS_STOPS: readonly string[] = [
  '#440154',
  '#443983',
  '#31688e',
  '#21918c',
  '#35b779',
  '#90d743',
  '#fde725',
];

/** Maps a value to a viridis colour; values outside the domain are clamped. */
export function viridisScale(domain: readonly [number, number]): (value: number) => string {
  const [lo, hi] = domain;
  const steps = VIRIDIS_STOPS.length - 1;
  const positions = VIRIDIS_STOPS.map((_, i) => lo + ((hi - lo) * i) / steps);
  const scale = scaleLinear<string>().domain(positions).range([...VIRIDIS_STOPS]).clamp(true);
  return (value: number) => scale(value);
}
