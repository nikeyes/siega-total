import { config } from '../config';
import type { GrassType } from './field';

/** The smallest blade that cuts `type`: tough grass gives way one size before its minSize, slowly. */
export function grassCutSize(type: GrassType): number {
  return Math.max(config.blade.startSize, config.grassTypes[type].minSize - 1);
}

/** A blade short of the grass's minSize cuts it, if it cuts it at all, held back to toughGrass.speedFactor. */
export function isCutSlowly(type: GrassType, size: number): boolean {
  return size < config.grassTypes[type].minSize;
}
