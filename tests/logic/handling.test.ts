import { describe, expect, it } from 'vitest';
import { bladeRadius, maxSpeedAt } from '../../src/logic/blade';
import { targetDistance, verticalFovDegrees } from '../../src/logic/camera';

const PHONE_ASPECT = 390 / 844;

/** How many meters of field the camera shows across a screen of `aspect`, at `distance`. */
function visibleWidth(distance: number, aspect: number) {
  return 2 * distance * Math.tan(((verticalFovDegrees(aspect) * Math.PI) / 180) / 2) * aspect;
}

/** How the blade and the camera feel together on a phone. */
describe('handling', () => {
  it('starts with a blade between a third and a half of a phone screen wide', () => {
    const share = (2 * bladeRadius(1)) / visibleWidth(targetDistance(1), PHONE_ASPECT);
    expect(share).toBeGreaterThan(0.35);
    expect(share).toBeLessThan(0.55);
  });

  it('keeps the blade under half the screen wide as it grows', () => {
    for (let size = 1; size <= 10; size++) expect((2 * bladeRadius(size)) / visibleWidth(targetDistance(size), PHONE_ASPECT)).toBeLessThan(0.55);
  });

  it('starts crossing a phone screen in more than a second', () => {
    expect(visibleWidth(targetDistance(1), PHONE_ASPECT) / maxSpeedAt(1)).toBeGreaterThan(1.1);
  });

  it('starts covering under four times its radius each second', () => {
    expect(maxSpeedAt(1) / bladeRadius(1)).toBeLessThan(4);
  });
});
