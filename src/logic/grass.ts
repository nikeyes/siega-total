import { config } from '../config';
import type { GrassType } from './field';

/** The smallest blade that cuts `type`: tough grass gives way toughGrass.sizesEarly sizes before its minSize, slowly. */
export function grassCutSize(type: GrassType): number {
  return Math.max(config.blade.startSize, config.grassTypes[type].minSize - config.toughGrass.sizesEarly);
}

/** The share of full speed a blade of `size` keeps while it cuts `type`: less while it is short of the grass's minSize. */
export function cuttingSpeedFactor(type: GrassType, size: number): number {
  const sizesShort = config.grassTypes[type].minSize - size;
  if (sizesShort <= 0) return 1;
  return config.toughGrass.speedWhenShort[sizesShort - 1] ?? 1;
}
