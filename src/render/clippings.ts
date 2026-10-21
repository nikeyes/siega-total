import { config } from '../config';
import type { QualityLevel } from '../logic/quality';
import type { BurstOptions } from './burst';

/** The frame rate the clippings' pool is sized for. */
const CLIPPING_POOL_FRAMES_PER_SECOND = 60;

/**
 * The clippings' burst options for a quality level: flat strips that land when the level keeps them.
 * Smaller and lower than the fruit burst. The pool holds a whole lifetime of clippings at the per-frame cap,
 * so none is reused mid-flight during the win wave.
 */
export function clippingOptions(level: QualityLevel): Partial<BurstOptions> {
  const { clippings, maxClippingsPerFrame } = config.quality.levels[level];
  const { clippingSeconds } = config.effects;
  return {
    poolSize: Math.ceil(maxClippingsPerFrame * clippingSeconds * CLIPPING_POOL_FRAMES_PER_SECOND),
    geometry: 'flat',
    pieceSize: 0.14,
    lifetimeSeconds: clippingSeconds,
    minUpSpeed: 1.5,
    maxUpSpeed: 3,
    maxSideSpeed: 1.8,
    shrink: clippings !== 'persistent',
  };
}

/** Which cut blades throw a clipping: one in every `bladesPerClipping`, at most `max`, spread over the list. */
export function clippingBlades(cutIndices: readonly number[], bladesPerClipping: number, max: number): number[] {
  // Even a single cut blade throws one, so a light touch on the grass still shows.
  // Never more than one per blade, nor a fraction of one, whatever the debug panel sets.
  const wanted = Math.max(1, Math.floor(cutIndices.length / bladesPerClipping));
  const count = Math.min(wanted, Math.floor(max), cutIndices.length);
  const spacing = cutIndices.length / count;
  return Array.from({ length: count }, (_, clipping) => cutIndices[Math.floor(clipping * spacing)]!);
}
