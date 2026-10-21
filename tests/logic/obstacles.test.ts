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
const cuttableTypes = ['strawberry', 'watermelon', 'cactus'] as const;

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
  describe('blade size', () => {
    it.each(cuttableTypes)('cuts a %s once the blade reaches its configured minSize', (type) => {
      const field = fieldWithOne(type);
      const { minSize } = config.obstacles[type];
      expect(cutOverlapping(field, type, minSize - 1)).toEqual([]);
      expect(cutOverlapping(field, type, minSize)).toEqual([0]);
    });

    it('never cuts a rock, not even with an infinite size', () => {
      expect(cutOverlapping(fieldWithOne('rock'), 'rock', Infinity)).toEqual([]);
    });

    it('lets the win wave (infinite size) cut a cactus', () => {
      expect(cutOverlapping(fieldWithOne('cactus'), 'cactus', Infinity)).toEqual([0]);
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

  describe('reach', () => {
    const radius = 1;

    it.each(['strawberry', 'cactus'] as const)('reaches a %s up to circle radius plus its configured radius', (type) => {
      const reach = radius + config.obstacles[type].radius;
      expect(cutObstaclesInCircle(fieldWithOne(type), 5 - reach - 0.01, 5, radius, Infinity)).toEqual([]);
      expect(cutObstaclesInCircle(fieldWithOne(type), 5 - reach + 0.01, 5, radius, Infinity)).toEqual([0]);
    });

    it('cuts an obstacle that exactly touches the circle edge', () => {
      const exactlyTouching = 5 - obstacleRadius('strawberry') - radius;
      expect(cutObstaclesInCircle(fieldWithOne('strawberry'), exactlyTouching, 5, radius, Infinity)).toEqual([0]);
    });

    it('measures reach along z as well as x', () => {
      const reach = radius + obstacleRadius('watermelon');
      expect(cutObstaclesInCircle(fieldWithOne('watermelon'), 5, 5 + reach + 0.01, radius, Infinity)).toEqual([]);
      expect(cutObstaclesInCircle(fieldWithOne('watermelon'), 5, 5 + reach - 0.01, radius, Infinity)).toEqual([0]);
    });

    it('measures reach diagonally, not per axis', () => {
      const offsetPerAxis = (radius + obstacleRadius('watermelon')) * 0.8;
      // Each axis offset is within reach, but the Euclidean distance is not.
      expect(cutObstaclesInCircle(fieldWithOne('watermelon'), 5 + offsetPerAxis, 5 + offsetPerAxis, radius, Infinity)).toEqual([]);
    });
  });

  describe('field state', () => {
    it('returns every cuttable obstacle in the circle, in index order, skipping rocks and too-big ones', () => {
      const field = createObstacleField([
        { type: 'strawberry', x: 5, z: 5 },
        { type: 'rock', x: 5.2, z: 5 },
        { type: 'cactus', x: 4.8, z: 5 },
        { type: 'watermelon', x: 5, z: 5.2 },
      ]);
      expect(cutObstaclesInCircle(field, 5, 5, 1, watermelon.minSize)).toEqual([0, 3]);
      expect(standingCount(field, 'cactus')).toBe(1);
      expect(standingCount(field, 'rock')).toBe(1);
    });

    it('returns nothing on an empty field', () => {
      expect(cutObstaclesInCircle(createObstacleField([]), 5, 5, 100, Infinity)).toEqual([]);
    });

    it('does not return an obstacle that is already cut', () => {
      const field = fieldWithOne('strawberry');
      cutOverlapping(field, 'strawberry', Infinity);
      expect(cutOverlapping(field, 'strawberry', Infinity)).toEqual([]);
    });

    it('cuts again after resetObstacleField', () => {
      const field = fieldWithOne('strawberry');
      cutOverlapping(field, 'strawberry', Infinity);
      resetObstacleField(field);
      expect(cutOverlapping(field, 'strawberry', Infinity)).toEqual([0]);
    });
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

  it('is zero for a type absent from the field', () => {
    expect(standingCount(fieldWithOne('rock'), 'cactus')).toBe(0);
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

  it('a rock, though never cut, still reads its radius from config', () => {
    expect(obstacleRadius('rock')).toBe(config.obstacles.rock.radius);
  });

  it('a NaN blade size cuts nothing', () => {
    expect(canCutObstacle('strawberry', Number.NaN)).toBe(false);
  });
});
