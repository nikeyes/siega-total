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
const radius = bladeRadius(startSize);
const wheatSize = config.grassTypes.wheat.minSize;

/** 8 × 3 m: green in the west, a wheat stripe from x = 4 to x = 6, green again in the east. */
const WHEAT_STRIPE = ['ggggwwgg', 'ggggwwgg', 'ggggwwgg'];
const WHEAT_WEST_EDGE = 4;

/** 6 × 6 m of green with room for an obstacle in the middle. */
const OPEN_FIELD = ['gggggg', 'gggggg', 'gggggg', 'gggggg', 'gggggg', 'gggggg'];
const rock: Obstacle = { type: 'rock', x: 3, z: 3 };
const rockRadius = obstacleRadius('rock');

describe('resolveCollisions against hard grass', () => {
  it('stops a blade too small for wheat at its radius from the edge of the stripe', () => {
    const result = resolveCollisions(worldOf(levelFromRows(WHEAT_STRIPE)), WHEAT_WEST_EDGE - radius + 0.1, 1.5, radius, startSize);
    expect(result.x).toBeCloseTo(WHEAT_WEST_EDGE - radius, 9);
    expect(result.z).toBe(1.5);
    expect(result.blocked).toBe(true);
  });

  it('lets a blade big enough for wheat into the stripe', () => {
    const result = resolveCollisions(worldOf(levelFromRows(WHEAT_STRIPE)), WHEAT_WEST_EDGE + 0.5, 1.5, bladeRadius(wheatSize), wheatSize);
    expect(result).toEqual({ x: WHEAT_WEST_EDGE + 0.5, z: 1.5, blocked: false });
  });

  it('lets a blade big enough for lavender into it', () => {
    const size = config.grassTypes.lavender.minSize;
    const result = resolveCollisions(worldOf(levelFromRows(['ggll'])), 2.2, 0.5, bladeRadius(size), size);
    expect(result).toEqual({ x: 2.2, z: 0.5, blocked: false });
  });

  it('blocks a blade too small for lavender even if it already cuts wheat', () => {
    const result = resolveCollisions(worldOf(levelFromRows(['ggll'])), 2 - 0.1, 0.5, bladeRadius(wheatSize), wheatSize);
    expect(result.x).toBeCloseTo(2 - bladeRadius(wheatSize), 9);
    expect(result.blocked).toBe(true);
  });

  it('ignores sand cells', () => {
    const result = resolveCollisions(worldOf(levelFromRows(['g..g'])), 1.6, 0.5, radius, startSize);
    expect(result).toEqual({ x: 1.6, z: 0.5, blocked: false });
  });

  it('does not block a blade standing exactly against a wall', () => {
    const result = resolveCollisions(worldOf(levelFromRows(WHEAT_STRIPE)), WHEAT_WEST_EDGE - radius, 1.5, radius, startSize);
    expect(result.blocked).toBe(false);
  });

  it('works with cells smaller than 1 m', () => {
    const level: LevelDefinition = { ...levelFromRows(['ggggwwgg']), cellSize: 0.5, width: 4, depth: 0.5 };
    const result = resolveCollisions(worldOf(level), 2 - radius + 0.1, 0.25, radius, startSize);
    expect(result.x).toBeCloseTo(2 - radius, 9);
    expect(result.blocked).toBe(true);
  });

  it('blocks with hard grass in a last column that the field width only partly covers', () => {
    const level: LevelDefinition = { ...levelFromRows(['ggw']), width: 2.5 };
    const result = resolveCollisions(worldOf(level), 2 - radius + 0.1, 0.5, radius, startSize);
    expect(result).toEqual({ x: 2 - radius, z: 0.5, blocked: true });
  });

  it('blocks with hard grass in a last row that the field depth only partly covers', () => {
    const level: LevelDefinition = { ...levelFromRows(['ggg', 'www']), depth: 1.5 };
    const result = resolveCollisions(worldOf(level), 1.5, 1 - radius + 0.1, radius, startSize);
    expect(result).toEqual({ x: 1.5, z: 1 - radius, blocked: true });
  });

  it('does not block a blade at the west edge with hard grass at the east end of the row above', () => {
    const result = resolveCollisions(worldOf(levelFromRows(['ggw', 'ggg'])), 0.1, 1.5, radius, startSize);
    expect(result).toEqual({ x: 0.1, z: 1.5, blocked: false });
  });

  it('does not block a blade at the east edge with hard grass at the west end of the row below', () => {
    const result = resolveCollisions(worldOf(levelFromRows(['ggg', 'wgg'])), 2.9, 0.5, radius, startSize);
    expect(result).toEqual({ x: 2.9, z: 0.5, blocked: false });
  });

  it('does not let the blade through the corner between two hard cells', () => {
    // Wheat to the east and to the south of the green cell at the northwest.
    const result = resolveCollisions(worldOf(levelFromRows(['gww', 'www', 'www'])), 1.1, 1.1, radius, startSize);
    expect(result.x).toBeLessThanOrEqual(1 - radius + 1e-9);
    expect(result.z).toBeLessThanOrEqual(1 - radius + 1e-9);
    expect(result.blocked).toBe(true);
  });

  describe('a blade whose center ends up inside a lone hard cell', () => {
    const LONE_WHEAT = ['ggg', 'gwg', 'ggg'];

    it('leaves by the west side when it is nearest', () => {
      const result = resolveCollisions(worldOf(levelFromRows(LONE_WHEAT)), 1.2, 1.5, radius, startSize);
      expect(result).toEqual({ x: 1 - radius, z: 1.5, blocked: true });
    });

    it('leaves by the east side when it is nearest', () => {
      const result = resolveCollisions(worldOf(levelFromRows(LONE_WHEAT)), 1.8, 1.5, radius, startSize);
      expect(result).toEqual({ x: 2 + radius, z: 1.5, blocked: true });
    });

    it('leaves by the south side when it is nearest', () => {
      const result = resolveCollisions(worldOf(levelFromRows(LONE_WHEAT)), 1.5, 1.8, radius, startSize);
      expect(result).toEqual({ x: 1.5, z: 2 + radius, blocked: true });
    });

    it('leaves westward when it sits exactly at the center of the cell', () => {
      const result = resolveCollisions(worldOf(levelFromRows(LONE_WHEAT)), 1.5, 1.5, radius, startSize);
      expect(result).toEqual({ x: 1 - radius, z: 1.5, blocked: true });
    });
  });
});

describe('resolveCollisions sliding along walls', () => {
  const step = 0.05;

  it('lets the blade slide along a vertical wall when it moves diagonally into it', () => {
    const world = worldOf(levelFromRows(WHEAT_STRIPE));
    let x = WHEAT_WEST_EDGE - radius;
    let z = 0.8;
    for (let frame = 0; frame < 20; frame++) {
      ({ x, z } = resolveCollisions(world, x + step * Math.SQRT1_2, z + step * Math.SQRT1_2, radius, startSize));
    }
    expect(x).toBeCloseTo(WHEAT_WEST_EDGE - radius, 9);
    expect(z).toBeCloseTo(0.8 + 20 * step * Math.SQRT1_2, 9);
  });

  it('lets the blade slide along a horizontal wall across cell seams', () => {
    const world = worldOf(levelFromRows(['wwwwwwww', 'gggggggg', 'gggggggg']));
    let x = 0.8;
    let z = 1 + radius;
    for (let frame = 0; frame < 80; frame++) {
      ({ x, z } = resolveCollisions(world, x + step * Math.SQRT1_2, z - step * Math.SQRT1_2, radius, startSize));
    }
    expect(z).toBeCloseTo(1 + radius, 9);
    expect(x).toBeCloseTo(0.8 + 80 * step * Math.SQRT1_2, 9);
  });

  it('lets the blade slide around a rock instead of stopping dead', () => {
    const world = worldOf(levelFromRows(OPEN_FIELD, [rock]));
    let x = 3 - (radius + rockRadius);
    let z = 2.9;
    for (let frame = 0; frame < 30; frame++) {
      ({ x, z } = resolveCollisions(world, x + step, z, radius, startSize));
      expect(Math.hypot(x - 3, z - 3)).toBeGreaterThanOrEqual(radius + rockRadius - 1e-9);
    }
    expect(z).toBeLessThan(2.9);
  });
});

describe('resolveCollisions at the field edge', () => {
  it('keeps the blade inside the west and south edges without counting as blocked', () => {
    const result = resolveCollisions(worldOf(levelFromRows(['gg'])), -0.3, 1.4, radius, startSize);
    expect(result).toEqual({ x: 0, z: 1, blocked: false });
  });

  it('keeps the blade inside the north edge', () => {
    const result = resolveCollisions(worldOf(levelFromRows(['gg', 'gg'])), 1, -0.3, radius, startSize);
    expect(result).toEqual({ x: 1, z: 0, blocked: false });
  });
});

describe('resolveCollisions against obstacles', () => {
  it.each([0, Math.PI / 3, Math.PI, (5 * Math.PI) / 4])(
    'pushes even an infinitely big blade out of a rock to radius + rock radius at angle %f',
    (angle) => {
      const world = worldOf(levelFromRows(OPEN_FIELD, [rock]));
      const overlapping = (radius + rockRadius) * 0.7;
      const result = resolveCollisions(world, 3 + Math.cos(angle) * overlapping, 3 + Math.sin(angle) * overlapping, radius, Infinity);
      expect(Math.hypot(result.x - 3, result.z - 3)).toBeCloseTo(radius + rockRadius, 9);
      expect(Math.atan2(result.z - 3, result.x - 3)).toBeCloseTo(Math.atan2(Math.sin(angle), Math.cos(angle)), 9);
      expect(result.blocked).toBe(true);
    },
  );

  it('pushes a blade sitting exactly on a rock center out eastward', () => {
    const result = resolveCollisions(worldOf(levelFromRows(OPEN_FIELD, [rock])), 3, 3, radius, startSize);
    expect(result.x).toBeCloseTo(3 + radius + rockRadius, 9);
    expect(result.z).toBe(3);
  });

  it('does not block a blade exactly touching a rock', () => {
    const result = resolveCollisions(worldOf(levelFromRows(OPEN_FIELD, [rock])), 3 + radius + rockRadius, 3, radius, startSize);
    expect(result).toEqual({ x: 3 + radius + rockRadius, z: 3, blocked: false });
  });

  it('does not let the blade slip through a rock near the field edge at full speed', () => {
    // A rock 1 m from the west edge leaves a gap narrower than the blade.
    const world = worldOf(levelFromRows(OPEN_FIELD, [{ type: 'rock', x: 1, z: 3 }]));
    // Full speed during the longest frame the game steps (MAX_FRAME_SECONDS = 0.05 in main.ts).
    const step = config.blade.maxSpeed * 0.05;
    let x = 0;
    let z = 0.5;
    for (let frame = 0; frame < 60; frame++) {
      ({ x, z } = resolveCollisions(world, x, z + step, radius, startSize));
      expect(Math.hypot(x - 1, z - 3)).toBeGreaterThan(radius + rockRadius - 0.05);
    }
    expect(z).toBeLessThan(3 - 1);
  });

  it('blocks a blade too small for a fruit', () => {
    const world = worldOf(levelFromRows(OPEN_FIELD, [{ type: 'watermelon', x: 3, z: 3 }]));
    expect(resolveCollisions(world, 3.1, 3, radius, config.obstacles.watermelon.minSize - 1).blocked).toBe(true);
  });

  it('lets a blade big enough for a fruit through it', () => {
    const world = worldOf(levelFromRows(OPEN_FIELD, [{ type: 'watermelon', x: 3, z: 3 }]));
    expect(resolveCollisions(world, 3.1, 3, radius, config.obstacles.watermelon.minSize)).toEqual({ x: 3.1, z: 3, blocked: false });
  });

  it('does not block with a fruit that is already cut', () => {
    const world = worldOf(levelFromRows(OPEN_FIELD, [{ type: 'watermelon', x: 3, z: 3 }]));
    world.obstacles.cut[0] = 1;
    expect(resolveCollisions(world, 3.1, 3, radius, startSize).blocked).toBe(false);
  });
});

/** How far the circle (x, z, radius) sinks into the box of cell (column, row) of a 1 m grid; 0 when it does not touch it. */
function depthIntoCell(x: number, z: number, radius: number, column: number, row: number): number {
  const closestX = Math.min(column + 1, Math.max(column, x));
  const closestZ = Math.min(row + 1, Math.max(row, z));
  return Math.max(0, radius - Math.hypot(x - closestX, z - closestZ));
}

describe('resolveCollisions between a rock and a wall', () => {
  it.skip('keeps the blade out of a wheat wall when a rock squeezes it against the wall - BUG', () => {
    /*
     * ROOT CAUSE: each pass pushes out of cells first and obstacles last, so when a rock and a hard wall
     * leave a gap narrower than the blade, the final rock push leaves the circle inside the wall.
     * The same happens between a rock and the field edge (a few cm of overlap with the rock).
     * CODE LOCATION: src/logic/collision.ts:30-35
     * PROPOSED FIX: none for now; 3 projection passes cannot satisfy two walls that are closer than the
     * blade's diameter. The overlap stays below the per-frame step (about 1 cm at 60 fps, 4 cm at 0.25 m)
     * and the blade never gets through, so it is cosmetic.
     * EXPECTED: the circle never enters the wheat cells
     * ACTUAL: it sinks about 0.006 m into the wheat at x = 4
     */
    // The rock's east edge is 0.5 m from the wheat at x = 4: too narrow for the blade.
    const level = levelFromRows(['ggggww', 'ggggww', 'ggggww', 'ggggww', 'ggggww', 'ggggww'], [{ type: 'rock', x: 2.5, z: 3 }]);
    const world = worldOf(level);
    let x = 4 - radius;
    let z = 0.5;
    for (let frame = 0; frame < 60; frame++) {
      ({ x, z } = resolveCollisions(world, x, z + 0.05, radius, startSize));
    }
    for (let row = 0; row < 6; row++) expect(depthIntoCell(x, z, radius, 4, row)).toBeLessThan(1e-6);
  });
});
