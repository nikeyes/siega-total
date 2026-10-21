import { config } from '../config';
import type { Obstacle, ObstacleType } from './levels';

export interface ObstacleField {
  readonly obstacles: readonly Obstacle[];
  /** 0 = standing, 1 = cut. */
  readonly cut: Uint8Array;
}

export function createObstacleField(obstacles: readonly Obstacle[]): ObstacleField {
  return { obstacles, cut: new Uint8Array(obstacles.length) };
}

export function resetObstacleField(field: ObstacleField): void {
  field.cut.fill(0);
}

interface ObstacleSettings {
  radius: number;
  /** Missing for obstacles that are never cut. */
  minSize?: number;
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

export function standingCount(field: ObstacleField, type: ObstacleType): number {
  return field.obstacles.filter((obstacle, index) => obstacle.type === type && field.cut[index] === 0).length;
}
