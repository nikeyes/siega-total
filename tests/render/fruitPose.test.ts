import { describe, expect, it } from 'vitest';
import { FRUIT_POSE, fruitPose } from '../../src/render/fruitPose';

describe('fruitPose', () => {
  it('floats the fruit on top of the grass, bobbing a little above and below its rest height', () => {
    const heights = Array.from({ length: 100 }, (_, step) => fruitPose(step * 0.05, 0).height);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(FRUIT_POSE.restHeight - FRUIT_POSE.bobMeters - 1e-9);
    expect(Math.max(...heights)).toBeLessThanOrEqual(FRUIT_POSE.restHeight + FRUIT_POSE.bobMeters + 1e-9);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(FRUIT_POSE.bobMeters);
  });

  it('keeps each fruit out of step with the others', () => {
    expect(fruitPose(1, 0).height).not.toBeCloseTo(fruitPose(1, 0.37).height, 4);
  });

  it('turns slowly, a full turn every turnSeconds', () => {
    const { turnSeconds } = FRUIT_POSE;
    expect(fruitPose(turnSeconds / 4, 0).turn - fruitPose(0, 0).turn).toBeCloseTo(Math.PI / 2, 9);
  });

  it('shows the fruit bigger than its cutting radius, so it stands out of the grass', () => {
    expect(FRUIT_POSE.scale).toBeGreaterThan(1);
  });
});
