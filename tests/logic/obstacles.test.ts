import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import type { ObstacleType } from '../../src/logic/levels';
import {
  canCutObstacle,
  createObstacleField,
  cutObstaclesInCircle,
  hitObstaclesInCircle,
  obstacleCutSize,
  obstacleGrowthCuts,
  obstacleHits,
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

describe('hitObstaclesInCircle', () => {
  const { hitIntervalSeconds } = config.collision;
  const FRAME = 1 / 60;
  /** A blade of radius 1 resting on the obstacle at (5, 5). */
  const restOn = (field: ReturnType<typeof createObstacleField>, bladeSize: number, dt = FRAME) => hitObstaclesInCircle(field, 5, 5, 1, bladeSize, dt);

  it('breaks a one-hit fruit, the strawberry, the moment the blade touches it', () => {
    const field = fieldWithOne('strawberry');
    expect(obstacleHits('strawberry')).toBe(1);
    expect(restOn(field, config.obstacles.strawberry.minSize)).toEqual({ hit: [], cut: [0] });
  });

  it('lands a hit on a watermelon at once, then one every hitIntervalSeconds of contact, and breaks it on the last', () => {
    const field = fieldWithOne('watermelon');
    const hits = obstacleHits('watermelon');
    expect(hits).toBeGreaterThan(1);
    const results = [];
    for (let time = 0; time <= hitIntervalSeconds * hits; time += FRAME) results.push(restOn(field, watermelon.minSize));
    const hitFrames = results.flatMap((result, frame) => (result.hit.length > 0 ? [frame] : []));
    const cutFrames = results.flatMap((result, frame) => (result.cut.length > 0 ? [frame] : []));
    expect(hitFrames).toHaveLength(hits - 1);
    expect(hitFrames[0]).toBe(0);
    expect(cutFrames).toHaveLength(1);
    expect((cutFrames[0]! - hitFrames[0]!) * FRAME).toBeCloseTo((hits - 1) * hitIntervalSeconds, 1);
    expect(field.cut[0]).toBe(1);
  });

  it('lands a single hit on a brush shorter than hitIntervalSeconds', () => {
    const field = fieldWithOne('watermelon');
    restOn(field, watermelon.minSize, hitIntervalSeconds / 2);
    expect(restOn(field, watermelon.minSize, hitIntervalSeconds / 4)).toEqual({ hit: [], cut: [] });
    expect(field.cut[0]).toBe(0);
  });

  it('keeps the hits a watermelon took when the blade leaves it and comes back', () => {
    const field = fieldWithOne('watermelon');
    for (let hit = 0; hit < obstacleHits('watermelon') - 1; hit++) restOn(field, watermelon.minSize, hitIntervalSeconds);
    hitObstaclesInCircle(field, 20, 20, 1, watermelon.minSize, hitIntervalSeconds);
    expect(restOn(field, watermelon.minSize).cut).toEqual([0]);
  });

  it('does not hit a fruit too big for the blade', () => {
    const field = fieldWithOne('watermelon');
    expect(restOn(field, watermelon.minSize - 1)).toEqual({ hit: [], cut: [] });
  });

  it('starts again from no hits after a reset', () => {
    const field = fieldWithOne('watermelon');
    restOn(field, watermelon.minSize);
    resetObstacleField(field);
    expect(restOn(field, watermelon.minSize, hitIntervalSeconds)).toEqual({ hit: [0], cut: [] });
  });
});
