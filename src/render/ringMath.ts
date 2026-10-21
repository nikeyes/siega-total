import { config } from '../config';

/** Radius and opacity of the size-up ring `age` seconds after it started, or null once it is over. */
export function sizeUpRing(age: number, bladeRadius: number): { radius: number; opacity: number } | null {
  const { sizeUpRingSeconds, sizeUpRingGrowth } = config.effects;
  if (age >= sizeUpRingSeconds) return null;
  const progress = age / sizeUpRingSeconds;
  // Cubic ease-out: the ring bursts out and slows down as it fades.
  const eased = 1 - (1 - progress) ** 3;
  return { radius: bladeRadius * (1 + (sizeUpRingGrowth - 1) * eased), opacity: 1 - progress };
}
