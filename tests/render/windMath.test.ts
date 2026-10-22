import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { bladePhaseJitter, WIND_DIRECTION, windLean } from '../../src/render/windMath';

const { swayMeters } = config.world.wind;

describe('windLean', () => {
  it('always leans downwind, never against the wind nor past swayMeters', () => {
    for (let time = 0; time < 10; time += 0.37) {
      for (let x = 0; x < 22; x += 1.3) {
        const lean = windLean(x, 22 - x, time);
        expect(lean).toBeGreaterThanOrEqual(0);
        expect(lean).toBeLessThanOrEqual(swayMeters);
      }
    }
  });
});

describe('windLean between blades', () => {
  it('leans blades side by side across the wind differently at the same instant', () => {
    const across = { x: -WIND_DIRECTION.z * 0.2, z: WIND_DIRECTION.x * 0.2 };
    let totalDifference = 0;
    for (let pair = 0; pair < 20; pair++) {
      const x = 2 + pair;
      const z = 3 + pair * 0.5;
      totalDifference += Math.abs(windLean(x, z, 1) - windLean(x + across.x, z + across.z, 1));
    }
    expect(totalDifference / 20).toBeGreaterThan(swayMeters * 0.1);
  });
});

describe('the gust wave', () => {
  const { direction } = config.world.wind;
  const length = Math.hypot(direction.x, direction.z);
  const downwind = { x: direction.x / length, z: direction.z / length };

  /** Distance downwind, along a line through the field, where the lean averaged over nearby blades peaks at `time`. */
  function crestDistance(time: number): number {
    let crest = 0;
    let crestLean = -Infinity;
    for (let distance = 0; distance < 10; distance += 0.05) {
      let lean = 0;
      for (let sample = 0; sample < 40; sample++) {
        const across = sample * 0.1;
        lean += windLean(5 + downwind.x * distance - downwind.z * across, 5 + downwind.z * distance + downwind.x * across, time);
      }
      if (lean > crestLean) {
        crest = distance;
        crestLean = lean;
      }
    }
    return crest;
  }

  it('moves its crest downwind as time goes on', () => {
    // At these instants the crest crosses the sampled 10 m.
    expect(crestDistance(3.2)).toBeGreaterThan(crestDistance(3));
  });
});

describe('bladePhaseJitter', () => {
  it('is the same for the same root, between 0 and 1, and differs between roots', () => {
    expect(bladePhaseJitter(3.4, 7.1)).toBe(bladePhaseJitter(3.4, 7.1));
    const jitters = Array.from({ length: 50 }, (_, blade) => bladePhaseJitter(blade * 0.37, blade * 0.21));
    expect(jitters.every((jitter) => jitter >= 0 && jitter < 1)).toBe(true);
    expect(new Set(jitters).size).toBe(jitters.length);
  });
});

describe('wind edge cases', () => {
  it('swings one blade through the whole range, from upright to swayMeters', () => {
    const leans = Array.from({ length: 200 }, (_, step) => windLean(4, 9, step * 0.05));
    expect(Math.min(...leans)).toBeLessThan(swayMeters * 0.02);
    expect(Math.max(...leans)).toBeGreaterThan(swayMeters * 0.98);
  });

  it('repeats for each blade once every turn of the wave', () => {
    const period = (2 * Math.PI) / config.world.wind.speed;
    expect(windLean(4, 9, 1.3 + period)).toBeCloseTo(windLean(4, 9, 1.3), 9);
  });

  it('blows along a unit vector in the configured direction', () => {
    expect(Math.hypot(WIND_DIRECTION.x, WIND_DIRECTION.z)).toBeCloseTo(1, 9);
    expect(WIND_DIRECTION.z / WIND_DIRECTION.x).toBeCloseTo(config.world.wind.direction.z / config.world.wind.direction.x, 9);
  });
});
