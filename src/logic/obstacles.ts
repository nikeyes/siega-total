import { config } from '../config';
import type { Obstacle, ObstacleType } from './levels';

export interface ObstacleField {
  readonly obstacles: readonly Obstacle[];
  /** 0 = standing, 1 = cut. */
  readonly cut: Uint8Array;
  /** Hits each obstacle has taken without breaking. */
  readonly hitsTaken: Uint8Array;
  /** Seconds before each obstacle can take its next hit. */
  readonly hitCooldown: Float64Array;
}

export function createObstacleField(obstacles: readonly Obstacle[]): ObstacleField {
  return {
    obstacles,
    cut: new Uint8Array(obstacles.length),
    hitsTaken: new Uint8Array(obstacles.length),
    hitCooldown: new Float64Array(obstacles.length),
  };
}

export function resetObstacleField(field: ObstacleField): void {
  field.cut.fill(0);
  field.hitsTaken.fill(0);
  field.hitCooldown.fill(0);
}

interface ObstacleSettings {
  radius: number;
  /** Missing for obstacles that are never cut. */
  minSize?: number;
  /** Blows it takes before it breaks; 1 when missing. */
  hits?: number;
  growthCuts?: number;
  coins?: number;
}

/** Read on every call, so values tuned from the debug panel apply at once. */
function settingsOf(type: ObstacleType): ObstacleSettings {
  return config.obstacles[type] as ObstacleSettings;
}

export function obstacleRadius(type: ObstacleType): number {
  return settingsOf(type).radius;
}

/** Smallest blade size that cuts `type`; Infinity for rocks. */
export function obstacleCutSize(type: ObstacleType): number {
  return settingsOf(type).minSize ?? Infinity;
}

/** Hits a blade big enough lands on `type` before it breaks. */
export function obstacleHits(type: ObstacleType): number {
  return settingsOf(type).hits ?? 1;
}

/** Cuts toward the next blade size that cutting one `type` is worth. */
export function obstacleGrowthCuts(type: ObstacleType): number {
  return settingsOf(type).growthCuts ?? 0;
}

/** Coins that cutting one `type` is worth; 0 for rocks. */
export function obstacleCoins(type: ObstacleType): number {
  return settingsOf(type).coins ?? 0;
}

/** Rocks are never cut, whatever the size, even by the win wave's infinite size. */
export function canCutObstacle(type: ObstacleType, bladeSize: number): boolean {
  const cutSize = obstacleCutSize(type);
  return Number.isFinite(cutSize) && cutSize <= bladeSize;
}

/** Cuts the standing obstacles that touch the circle and that `bladeSize` can cut. Returns their indices. */
export function cutObstaclesInCircle(field: ObstacleField, x: number, z: number, radius: number, bladeSize: number): number[] {
  const newlyCut: number[] = [];
  field.obstacles.forEach((obstacle, index) => {
    if (field.cut[index] === 1 || !canCutObstacle(obstacle.type, bladeSize)) return;
    if (Math.hypot(obstacle.x - x, obstacle.z - z) > radius + obstacleRadius(obstacle.type)) return;
    field.cut[index] = 1;
    newlyCut.push(index);
  });
  return newlyCut;
}

/**
 * The blade resting on standing obstacles it can cut: each takes a hit at once and one every hitIntervalSeconds
 * of contact, and breaks on its last. Returns the obstacles that took a hit but still stand, and those that broke.
 */
export function hitObstaclesInCircle(
  field: ObstacleField,
  x: number,
  z: number,
  radius: number,
  bladeSize: number,
  dt: number,
): { hit: number[]; cut: number[] } {
  const result = { hit: [] as number[], cut: [] as number[] };
  field.obstacles.forEach((obstacle, index) => {
    if (field.cut[index] === 1) return;
    field.hitCooldown[index] = Math.max(0, field.hitCooldown[index]! - dt);
    if (!canCutObstacle(obstacle.type, bladeSize) || field.hitCooldown[index]! > 0) return;
    if (Math.hypot(obstacle.x - x, obstacle.z - z) > radius + obstacleRadius(obstacle.type)) return;
    field.hitsTaken[index]!++;
    field.hitCooldown[index] = config.collision.hitIntervalSeconds;
    if (field.hitsTaken[index]! < obstacleHits(obstacle.type)) {
      result.hit.push(index);
      return;
    }
    field.cut[index] = 1;
    result.cut.push(index);
  });
  return result;
}

export function standingCount(field: ObstacleField, type: ObstacleType): number {
  return field.obstacles.filter((obstacle, index) => obstacle.type === type && field.cut[index] === 0).length;
}
