import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { bladeRadius } from '../../src/logic/blade';
import { resolveCollisions } from '../../src/logic/collision';
import type { GrassType } from '../../src/logic/field';
import type { LevelDefinition, Obstacle } from '../../src/logic/levels';
import { createObstacleField, obstacleRadius } from '../../src/logic/obstacles';

const GRASS_BY_LETTER: Record<string, GrassType | null> = { g: 'green', w: 'wheat', l: 'lavender', '.': null };

/** A level of 1 m cells drawn row by row, north to south: `g` green, `w` wheat, `l` lavender and `.` sand. */
function levelFromRows(rows: string[], obstacles: Obstacle[] = []): LevelDefinition {
  return {
    number: 0,
    seed: config.field.seed,
    width: rows[0]!.length,
    depth: rows.length,
    cellSize: 1,
    cells: rows.flatMap((row) => [...row].map((letter) => GRASS_BY_LETTER[letter]!)),
    obstacles,
    targets: ['green'],
    timeSeconds: config.level.timeSeconds,
  };
}

function worldOf(level: LevelDefinition) {
  return { level, obstacles: createObstacleField(level.obstacles) };
}

const { startSize } = config.blade;
const wheatSize = config.grassTypes.wheat.minSize;

/** 8 × 3 m: green in the west, a wheat stripe from x = 4 to x = 6, green again in the east. */
const WHEAT_STRIPE = ['ggggwwgg', 'ggggwwgg', 'ggggwwgg'];
const WHEAT_WEST_EDGE = 4;

describe('resolveCollisions against hard grass', () => {
  it('stops a blade too small for wheat at its radius from the edge of the stripe', () => {
    const radius = bladeRadius(startSize);
    const result = resolveCollisions(worldOf(levelFromRows(WHEAT_STRIPE)), WHEAT_WEST_EDGE - radius + 0.1, 1.5, radius, startSize);
    expect(result.x).toBeCloseTo(WHEAT_WEST_EDGE - radius, 9);
    expect(result.z).toBe(1.5);
    expect(result.blocked).toBe(true);
  });

  it('lets a blade big enough for wheat into the stripe', () => {
    const radius = bladeRadius(wheatSize);
    const result = resolveCollisions(worldOf(levelFromRows(WHEAT_STRIPE)), WHEAT_WEST_EDGE + 0.5, 1.5, radius, wheatSize);
    expect(result).toEqual({ x: WHEAT_WEST_EDGE + 0.5, z: 1.5, blocked: false });
  });

  it('pushes the blade back out the nearest side when its center ends up inside a hard cell', () => {
    const radius = bladeRadius(startSize);
    const result = resolveCollisions(worldOf(levelFromRows(WHEAT_STRIPE)), WHEAT_WEST_EDGE + 0.2, 1.5, radius, startSize);
    expect(result.x).toBeCloseTo(WHEAT_WEST_EDGE - radius, 9);
    expect(result.blocked).toBe(true);
  });

  it('lets the blade slide along a wall when it moves diagonally into it', () => {
    const radius = bladeRadius(startSize);
    const world = worldOf(levelFromRows(WHEAT_STRIPE));
    let x = WHEAT_WEST_EDGE - radius;
    let z = 0.8;
    const step = 0.05;
    for (let frame = 0; frame < 20; frame++) {
      ({ x, z } = resolveCollisions(world, x + step * Math.SQRT1_2, z + step * Math.SQRT1_2, radius, startSize));
    }
    expect(x).toBeCloseTo(WHEAT_WEST_EDGE - radius, 9);
    expect(z).toBeCloseTo(0.8 + 20 * step * Math.SQRT1_2, 9);
  });

  it('does not let the blade through the corner between two hard cells', () => {
    // Wheat to the east and to the south of the green cell at the northwest.
    const level = levelFromRows(['gww', 'www', 'www']);
    const radius = bladeRadius(startSize);
    const result = resolveCollisions(worldOf(level), 1.1, 1.1, radius, startSize);
    expect(result.x).toBeLessThanOrEqual(1 - radius + 1e-9);
    expect(result.z).toBeLessThanOrEqual(1 - radius + 1e-9);
    expect(result.blocked).toBe(true);
  });

  it('does not block a blade standing exactly against a wall', () => {
    const radius = bladeRadius(startSize);
    const result = resolveCollisions(worldOf(levelFromRows(WHEAT_STRIPE)), WHEAT_WEST_EDGE - radius, 1.5, radius, startSize);
    expect(result.blocked).toBe(false);
  });

  it('keeps the blade inside the field', () => {
    const result = resolveCollisions(worldOf(levelFromRows(['gg'])), -0.3, 1.4, bladeRadius(startSize), startSize);
    expect(result).toEqual({ x: 0, z: 1, blocked: false });
  });
});

describe('resolveCollisions against obstacles', () => {
  const OPEN_FIELD = ['gggggg', 'gggggg', 'gggggg', 'gggggg', 'gggggg', 'gggggg'];
  const rock: Obstacle = { type: 'rock', x: 3, z: 3 };
  const radius = bladeRadius(startSize);

  it.each([0, Math.PI / 3, Math.PI, (5 * Math.PI) / 4])('pushes the blade out of a rock to radius + rock radius at angle %f', (angle) => {
    const world = worldOf(levelFromRows(OPEN_FIELD, [rock]));
    const overlapping = (radius + obstacleRadius('rock')) * 0.7;
    const result = resolveCollisions(world, 3 + Math.cos(angle) * overlapping, 3 + Math.sin(angle) * overlapping, radius, Infinity);
    expect(Math.hypot(result.x - 3, result.z - 3)).toBeCloseTo(radius + obstacleRadius('rock'), 9);
    expect(Math.atan2(result.z - 3, result.x - 3)).toBeCloseTo(Math.atan2(Math.sin(angle), Math.cos(angle)), 9);
    expect(result.blocked).toBe(true);
  });

  it('blocks a blade too small for a fruit and lets a big enough one through', () => {
    const world = worldOf(levelFromRows(OPEN_FIELD, [{ type: 'watermelon', x: 3, z: 3 }]));
    const fruitSize = config.obstacles.watermelon.minSize;
    expect(resolveCollisions(world, 3.1, 3, radius, fruitSize - 1).blocked).toBe(true);
    expect(resolveCollisions(world, 3.1, 3, radius, fruitSize)).toEqual({ x: 3.1, z: 3, blocked: false });
  });

  it('does not block with a fruit that is already cut', () => {
    const world = worldOf(levelFromRows(OPEN_FIELD, [{ type: 'watermelon', x: 3, z: 3 }]));
    world.obstacles.cut[0] = 1;
    expect(resolveCollisions(world, 3.1, 3, radius, startSize).blocked).toBe(false);
  });
});
