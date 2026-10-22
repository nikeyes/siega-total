import { config } from '../config';
import type { LevelDefinition } from './levels';
import { canCutObstacle, obstacleCutSize, obstacleRadius, type ObstacleField } from './obstacles';

export interface CollisionWorld {
  readonly level: LevelDefinition;
  readonly obstacles: ObstacleField;
}

export interface ResolvedPosition {
  x: number;
  z: number;
  /** True when a wall pushed the circle back. */
  blocked: boolean;
}

/** A cell with grass that `size` cannot cut yet. */
export function isHardCell(level: LevelDefinition, cell: number, size: number): boolean {
  const type = level.cells[cell];
  return type !== null && type !== undefined && config.grassTypes[type].minSize > size;
}

/**
 * Pushes the circle (x, z, radius) out of every hard cell and every standing obstacle
 * that `size` cannot cut, then keeps it on the island: the field and its shore.
 */
export function resolveCollisions(world: CollisionWorld, x: number, z: number, radius: number, size: number): ResolvedPosition {
  const position = { x, z, blocked: false };
  const { level } = world;
  for (let pass = 0; pass < config.collision.iterations; pass++) {
    // Walls go after obstacles: when a gap is narrower than the blade, it may graze the rock but never enters the wall.
    pushOutOfObstacles(world.obstacles, position, radius, size);
    pushOutOfHardCells(level, position, radius, size);
    // Inside the loop, so the next pass pushes again from where the island edge left the blade.
    const shore = config.field.shoreMeters;
    position.x = clamp(position.x, -shore, level.width + shore);
    position.z = clamp(position.z, -shore, level.depth + shore);
  }
  return position;
}

/**
 * The size that would cut everything the circle (x, z, radius) overlaps and `size` cannot cut yet:
 * the hard grass and the standing obstacles in its way. Infinity for a rock; null when nothing is in the way.
 */
export function sizeToPass(world: CollisionWorld, x: number, z: number, radius: number, size: number): number | null {
  const { level, obstacles } = world;
  const { cellSize } = level;
  const columns = Math.ceil(level.width / cellSize);
  const rows = Math.ceil(level.depth / cellSize);
  const firstColumn = Math.max(0, Math.floor((x - radius) / cellSize));
  const lastColumn = Math.min(columns - 1, Math.floor((x + radius) / cellSize));
  const firstRow = Math.max(0, Math.floor((z - radius) / cellSize));
  const lastRow = Math.min(rows - 1, Math.floor((z + radius) / cellSize));
  let needed: number | null = null;
  const need = (minSize: number) => (needed = Math.max(needed ?? 0, minSize));
  for (let row = firstRow; row <= lastRow; row++) {
    for (let column = firstColumn; column <= lastColumn; column++) {
      const cell = row * columns + column;
      if (!isHardCell(level, cell, size)) continue;
      const box = { left: column * cellSize, top: row * cellSize, right: (column + 1) * cellSize, bottom: (row + 1) * cellSize };
      if (distanceToBox({ x, z, blocked: false }, box) < radius) need(config.grassTypes[level.cells[cell]!].minSize);
    }
  }
  obstacles.obstacles.forEach(({ type, x: obstacleX, z: obstacleZ }, index) => {
    if (obstacles.cut[index] === 1 || canCutObstacle(type, size)) return;
    if (Math.hypot(x - obstacleX, z - obstacleZ) < radius + obstacleRadius(type)) need(obstacleCutSize(type));
  });
  return needed;
}

function pushOutOfHardCells(level: LevelDefinition, position: ResolvedPosition, radius: number, size: number): void {
  const { cellSize } = level;
  const columns = Math.ceil(level.width / cellSize);
  const rows = Math.ceil(level.depth / cellSize);
  const firstColumn = Math.max(0, Math.floor((position.x - radius) / cellSize));
  const lastColumn = Math.min(columns - 1, Math.floor((position.x + radius) / cellSize));
  const firstRow = Math.max(0, Math.floor((position.z - radius) / cellSize));
  const lastRow = Math.min(rows - 1, Math.floor((position.z + radius) / cellSize));
  const boxes: Box[] = [];
  for (let row = firstRow; row <= lastRow; row++) {
    for (let column = firstColumn; column <= lastColumn; column++) {
      if (!isHardCell(level, row * columns + column, size)) continue;
      boxes.push({ left: column * cellSize, top: row * cellSize, right: (column + 1) * cellSize, bottom: (row + 1) * cellSize });
    }
  }
  // Deepest first: pushing out of a wall's face before its neighbor's corner keeps the blade from catching on the seam.
  boxes.sort((a, b) => distanceToBox(position, a) - distanceToBox(position, b));
  for (const box of boxes) pushOutOfBox(position, radius, box);
}

function pushOutOfObstacles(field: ObstacleField, position: ResolvedPosition, radius: number, size: number): void {
  field.obstacles.forEach(({ type, x, z }, index) => {
    if (field.cut[index] === 1 || canCutObstacle(type, size)) return;
    const minDistance = radius + obstacleRadius(type);
    const dx = position.x - x;
    const dz = position.z - z;
    const distance = Math.hypot(dx, dz);
    if (distance >= minDistance) return;
    position.blocked = true;
    // A blade exactly on the center has no direction to leave by, so it leaves eastward.
    const [normalX, normalZ] = distance > 0 ? [dx / distance, dz / distance] : [1, 0];
    position.x = x + normalX * minDistance;
    position.z = z + normalZ * minDistance;
  });
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function distanceToBox(position: ResolvedPosition, box: Box): number {
  return Math.hypot(position.x - clamp(position.x, box.left, box.right), position.z - clamp(position.z, box.top, box.bottom));
}

/** Pushes the circle along the normal from the box's closest point, or out the nearest side when its center is inside. */
function pushOutOfBox(position: ResolvedPosition, radius: number, { left, top, right, bottom }: Box): void {
  const closestX = clamp(position.x, left, right);
  const closestZ = clamp(position.z, top, bottom);
  const dx = position.x - closestX;
  const dz = position.z - closestZ;
  const distance = Math.hypot(dx, dz);
  if (distance >= radius) return;
  position.blocked = true;
  if (distance > 0) {
    position.x = closestX + (dx / distance) * radius;
    position.z = closestZ + (dz / distance) * radius;
    return;
  }
  const exits = [
    { gap: position.x - left, x: left - radius, z: position.z },
    { gap: right - position.x, x: right + radius, z: position.z },
    { gap: position.z - top, x: position.x, z: top - radius },
    { gap: bottom - position.z, x: position.x, z: bottom + radius },
  ];
  const nearest = exits.reduce((best, exit) => (exit.gap < best.gap ? exit : best));
  position.x = nearest.x;
  position.z = nearest.z;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
