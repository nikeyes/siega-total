import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { bladeRadius, maxSpeedAt } from '../../src/logic/blade';
import { targetDistance, verticalFovDegrees } from '../../src/logic/camera';
import { joystickDirection } from '../../src/logic/input';

const SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const PHONE_ASPECT = 390 / 844;

/** How many meters of field the camera shows across a screen of `aspect`, at `distance`. */
function visibleWidth(distance: number, aspect: number) {
  return 2 * distance * Math.tan(((verticalFovDegrees(aspect) * Math.PI) / 180) / 2) * aspect;
}

describe('handling in the nueva build', () => {
  it('crosses the screen equally fast at every size, as the camera moves away while it grows', () => {
    const screenSpeedAtSize1 = maxSpeedAt(1) / targetDistance(1);
    for (const size of SIZES) expect(maxSpeedAt(size) / targetDistance(size)).toBeCloseTo(screenSpeedAtSize1, 10);
  });

  it('starts with a blade about a quarter of a phone screen wide or more', () => {
    const share = (2 * bladeRadius(1)) / visibleWidth(targetDistance(1), PHONE_ASPECT);
    expect(share).toBeGreaterThan(0.35);
    expect(share).toBeLessThan(0.55);
  });

  it('starts crossing a phone screen in more than a second', () => {
    expect(visibleWidth(targetDistance(1), PHONE_ASPECT) / maxSpeedAt(1)).toBeGreaterThan(1.1);
  });

  it('starts covering under four times its radius each second', () => {
    expect(maxSpeedAt(1) / bladeRadius(1)).toBeLessThan(4);
  });

  it('shows the same width of field on a long phone as on a 9:16 one', () => {
    const distance = targetDistance(1);
    expect(visibleWidth(distance, PHONE_ASPECT)).toBeCloseTo(visibleWidth(distance, 9 / 16), 10);
  });

  it('keeps the configured field of view on screens wider than the portrait reference', () => {
    expect(verticalFovDegrees(1)).toBe(config.camera.fovDegrees);
  });

  it('steers faster the further the finger drags, up to full speed at the rim of the joystick', () => {
    const origin = 100;
    const strength = (dx: number) => Math.hypot(joystickDirection(origin, origin, origin + dx, origin)!.x, 0);
    const rim = config.input.joystickRadiusPx;
    expect(strength(rim / 2)).toBeCloseTo(0.5);
    expect(strength(rim)).toBeCloseTo(1);
    expect(strength(rim * 3)).toBeCloseTo(1);
  });
});
