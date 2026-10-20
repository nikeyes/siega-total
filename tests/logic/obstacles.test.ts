import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import type { ObstacleType } from '../../src/logic/levels';
import {
  canCutObstacle,
  createObstacleField,
  cutObstaclesInCircle,
  obstacleCutSize,
  obstacleGrowthCuts,
  obstacleRadius,
  resetObstacleField,
  standingCount,
} from '../../src/logic/obstacles';

const { watermelon, cactus } = config.obstacles;

/** One obstacle of `type` at (5, 5). */
function fieldWithOne(type: ObstacleType) {
  return createObstacleField([{ type, x: 5, z: 5 }]);
}

/** Cuts with a circle of radius 1 that overlaps the obstacle at (5, 5) from the west. */
function cutOverlapping(field: ReturnType<typeof createObstacleField>, type: ObstacleType, bladeSize: number): number[] {
  const radius = 1;
  return cutObstaclesInCircle(field, 5 - obstacleRadius(type) - radius / 2, 5, radius, bladeSize);
}

describe('cutObstaclesInCircle', () => {
  it('cuts a fruit that touches the circle once the blade is big enough', () => {
    const field = fieldWithOne('watermelon');
    expect(cutOverlapping(field, 'watermelon', watermelon.minSize - 1)).toEqual([]);
    expect(cutOverlapping(field, 'watermelon', watermelon.minSize)).toEqual([0]);
  });

  it('cuts a cactus only from its own minimum size', () => {
    const field = fieldWithOne('cactus');
    expect(cutOverlapping(field, 'cactus', cactus.minSize - 1)).toEqual([]);
    expect(cutOverlapping(field, 'cactus', cactus.minSize)).toEqual([0]);
  });

  it('never cuts a rock, not even with an infinite size', () => {
    expect(cutOverlapping(fieldWithOne('rock'), 'rock', Infinity)).toEqual([]);
  });

  it('does not cut an obstacle out of reach of the circle', () => {
    const field = fieldWithOne('strawberry');
    const radius = 1;
    const justOutOfReach = 5 - obstacleRadius('strawberry') - radius - 0.01;
    expect(cutObstaclesInCircle(field, justOutOfReach, 5, radius, Infinity)).toEqual([]);
  });

  it('does not return an obstacle that is already cut', () => {
    const field = fieldWithOne('strawberry');
    cutOverlapping(field, 'strawberry', Infinity);
    expect(cutOverlapping(field, 'strawberry', Infinity)).toEqual([]);
  });
});

describe('standingCount', () => {
  it('drops when obstacles are cut and comes back after resetObstacleField', () => {
    const field = createObstacleField([
      { type: 'strawberry', x: 5, z: 5 },
      { type: 'strawberry', x: 20, z: 20 },
      { type: 'rock', x: 10, z: 10 },
    ]);
    expect(standingCount(field, 'strawberry')).toBe(2);
    cutOverlapping(field, 'strawberry', Infinity);
    expect(standingCount(field, 'strawberry')).toBe(1);
    expect(standingCount(field, 'rock')).toBe(1);
    resetObstacleField(field);
    expect(standingCount(field, 'strawberry')).toBe(2);
  });
});

describe('cutObstaclesInCircle edge cases', () => {
  it('cuts an obstacle that exactly touches the circle edge', () => {
    const field = fieldWithOne('strawberry');
    const radius = 1;
    const exactlyTouching = 5 - obstacleRadius('strawberry') - radius;
    expect(cutObstaclesInCircle(field, exactlyTouching, 5, radius, Infinity)).toEqual([0]);
  });

  it('measures reach along z as well as x', () => {
    const radius = 1;
    const reach = radius + obstacleRadius('watermelon');
    expect(cutObstaclesInCircle(fieldWithOne('watermelon'), 5, 5 + reach + 0.01, radius, Infinity)).toEqual([]);
    expect(cutObstaclesInCircle(fieldWithOne('watermelon'), 5, 5 + reach - 0.01, radius, Infinity)).toEqual([0]);
  });

  it('measures reach diagonally, not per axis', () => {
    const radius = 1;
    const offsetPerAxis = (radius + obstacleRadius('watermelon')) * 0.8;
    // Each axis offset is within reach, but the Euclidean distance is not.
    expect(cutObstaclesInCircle(fieldWithOne('watermelon'), 5 + offsetPerAxis, 5 + offsetPerAxis, radius, Infinity)).toEqual([]);
  });

  it('returns every cuttable obstacle in the circle, in index order, skipping rocks and too-big ones', () => {
    const field = createObstacleField([
      { type: 'strawberry', x: 5, z: 5 },
      { type: 'rock', x: 5.2, z: 5 },
      { type: 'cactus', x: 4.8, z: 5 },
      { type: 'watermelon', x: 5, z: 5.2 },
    ]);
    const bladeSize = watermelon.minSize;
    expect(cutObstaclesInCircle(field, 5, 5, 1, bladeSize)).toEqual([0, 3]);
    expect(standingCount(field, 'cactus')).toBe(1);
    expect(standingCount(field, 'rock')).toBe(1);
  });

  it('lets the win wave (infinite size) cut a cactus', () => {
    expect(cutOverlapping(fieldWithOne('cactus'), 'cactus', Infinity)).toEqual([0]);
  });

  it('cuts later with a bigger blade an obstacle that was too big before', () => {
    const field = fieldWithOne('cactus');
    cutOverlapping(field, 'cactus', cactus.minSize - 1);
    expect(standingCount(field, 'cactus')).toBe(1);
    expect(cutOverlapping(field, 'cactus', cactus.minSize)).toEqual([0]);
  });

  it('returns nothing on an empty field', () => {
    expect(cutObstaclesInCircle(createObstacleField([]), 5, 5, 100, Infinity)).toEqual([]);
  });

  it('cuts again after resetObstacleField', () => {
    const field = fieldWithOne('strawberry');
    cutOverlapping(field, 'strawberry', Infinity);
    resetObstacleField(field);
    expect(cutOverlapping(field, 'strawberry', Infinity)).toEqual([0]);
  });

  it('applies a minSize tuned at runtime (debug panel) without recreating the field', () => {
    const field = fieldWithOne('watermelon');
    const original = watermelon.minSize;
    try {
      watermelon.minSize = original + 1;
      expect(cutOverlapping(field, 'watermelon', original)).toEqual([]);
      expect(cutOverlapping(field, 'watermelon', original + 1)).toEqual([0]);
    } finally {
      watermelon.minSize = original;
    }
  });
});

describe('obstacle settings', () => {
  it('a rock needs an infinite blade size and gives no growth', () => {
    expect(obstacleCutSize('rock')).toBe(Infinity);
    expect(obstacleGrowthCuts('rock')).toBe(0);
    expect(canCutObstacle('rock', Infinity)).toBe(false);
  });

  it('cuttable types read minSize and growthCuts from config', () => {
    expect(obstacleCutSize('cactus')).toBe(cactus.minSize);
    expect(obstacleGrowthCuts('cactus')).toBe(cactus.growthCuts);
  });

  it('each type reaches as far as its configured radius', () => {
    const radius = 1;
    const reach = radius + cactus.radius;
    expect(cutObstaclesInCircle(fieldWithOne('cactus'), 5 - reach - 0.01, 5, radius, Infinity)).toEqual([]);
    expect(cutObstaclesInCircle(fieldWithOne('cactus'), 5 - reach + 0.01, 5, radius, Infinity)).toEqual([0]);
    expect(obstacleRadius('rock')).toBe(config.obstacles.rock.radius);
  });

  it('a NaN blade size cuts nothing', () => {
    expect(canCutObstacle('strawberry', Number.NaN)).toBe(false);
  });
});

describe('standingCount edge cases', () => {
  it('is zero for a type absent from the field', () => {
    expect(standingCount(fieldWithOne('rock'), 'cactus')).toBe(0);
  });
});
