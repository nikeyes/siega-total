import { describe, expect, it } from 'vitest';
import { createCameraRig } from '../../src/render/cameraRig';

const SCREEN_WIDTH = 390;
const SCREEN_HEIGHT = 844;
const FOCUS = { x: 10, z: 12, distance: 8 };

function rigLookingAtFocus() {
  const rig = createCameraRig();
  rig.setAspect(SCREEN_WIDTH / SCREEN_HEIGHT);
  rig.update(FOCUS);
  return rig;
}

describe('toScreen', () => {
  it('puts the camera focus at the center of the screen', () => {
    const point = rigLookingAtFocus().toScreen(FOCUS.x, 0, FOCUS.z, SCREEN_WIDTH, SCREEN_HEIGHT);
    expect(point.x).toBeCloseTo(SCREEN_WIDTH / 2);
    expect(point.y).toBeCloseTo(SCREEN_HEIGHT / 2);
  });

  it('puts points east of the focus to the right and points north of it higher up', () => {
    const rig = rigLookingAtFocus();
    const east = rig.toScreen(FOCUS.x + 1, 0, FOCUS.z, SCREEN_WIDTH, SCREEN_HEIGHT);
    const north = rig.toScreen(FOCUS.x, 0, FOCUS.z - 1, SCREEN_WIDTH, SCREEN_HEIGHT);
    expect(east.x).toBeGreaterThan(SCREEN_WIDTH / 2);
    expect(north.y).toBeLessThan(SCREEN_HEIGHT / 2);
  });

  it('follows the camera when it moves to a new focus between frames', () => {
    const rig = rigLookingAtFocus();
    const nextFocus = { x: 20, z: 5, distance: 10 };
    rig.update(nextFocus);
    const point = rig.toScreen(nextFocus.x, 0, nextFocus.z, SCREEN_WIDTH, SCREEN_HEIGHT);
    expect(point.x).toBeCloseTo(SCREEN_WIDTH / 2);
    expect(point.y).toBeCloseTo(SCREEN_HEIGHT / 2);
  });

  it('puts a point raised above the focus higher up on the screen', () => {
    const point = rigLookingAtFocus().toScreen(FOCUS.x, 1, FOCUS.z, SCREEN_WIDTH, SCREEN_HEIGHT);
    expect(point.y).toBeLessThan(SCREEN_HEIGHT / 2);
  });
});
