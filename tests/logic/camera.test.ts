import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { clampFocus, createCameraFocus, followBlade, targetDistance } from '../../src/logic/camera';

const { baseDistance, zoomPerSize, followLagSeconds, zoomTransitionSeconds, edgeMarginMeters } = config.camera;
const { startSize } = config.blade;
const { width, depth } = config.field;
const SIXTY_FPS_FRAME = 1 / 60;

/** Runs `frame` once per 60 fps frame for `seconds`. */
function runFrames(seconds: number, frame: () => void) {
  const frames = Math.round(seconds / SIXTY_FPS_FRAME);
  for (let count = 0; count < frames; count++) frame();
}

describe('targetDistance', () => {
  it('is baseDistance at size 1', () => {
    expect(targetDistance(1)).toBe(baseDistance);
  });

  it('moves zoomPerSize farther for each size above 1', () => {
    expect(targetDistance(3)).toBeCloseTo(baseDistance * (1 + zoomPerSize) ** 2, 12);
  });
});

describe('followBlade', () => {
  it('closes 1 - 1/e of the gap to the blade in one followLagSeconds step', () => {
    const focus = createCameraFocus(10, 10, startSize);
    followBlade(focus, 20, 5, startSize, followLagSeconds);
    const closedFraction = 1 - Math.exp(-1);
    expect(focus.x).toBeCloseTo(10 + 10 * closedFraction, 12);
    expect(focus.z).toBeCloseTo(10 - 5 * closedFraction, 12);
  });

  it('is less than 1 cm from a still blade after 1 s', () => {
    const focus = createCameraFocus(10, 10, startSize);
    const bladeX = 13;
    const bladeZ = 14;
    runFrames(1, () => followBlade(focus, bladeX, bladeZ, startSize, SIXTY_FPS_FRAME));
    expect(Math.hypot(focus.x - bladeX, focus.z - bladeZ)).toBeLessThan(0.01);
  });

  it('leaves e^-5 (under 1%) of the zoom change zoomTransitionSeconds after the blade grows', () => {
    const focus = createCameraFocus(10, 10, startSize);
    const grownSize = startSize + 1;
    const zoomChange = targetDistance(grownSize) - targetDistance(startSize);
    followBlade(focus, 10, 10, grownSize, zoomTransitionSeconds);
    expect(targetDistance(grownSize) - focus.distance).toBeCloseTo(zoomChange * Math.exp(-5), 12);
  });

  it('gives the same result for one step or many small steps of the same total time', () => {
    const single = createCameraFocus(10, 10, startSize);
    const many = createCameraFocus(10, 10, startSize);
    followBlade(single, 20, 5, startSize + 1, 0.2);
    for (let step = 0; step < 20; step++) followBlade(many, 20, 5, startSize + 1, 0.01);
    expect(many.x).toBeCloseTo(single.x, 9);
    expect(many.z).toBeCloseTo(single.z, 9);
    expect(many.distance).toBeCloseTo(single.distance, 9);
  });

  it('does not move the focus when dt is 0', () => {
    const focus = createCameraFocus(10, 10, startSize);
    followBlade(focus, 20, 5, startSize + 3, 0);
    expect(focus).toEqual(createCameraFocus(10, 10, startSize));
  });

  it('lands exactly on the blade and target distance with a huge dt', () => {
    const focus = createCameraFocus(10, 10, startSize);
    followBlade(focus, 20, 5, startSize + 3, 1e6);
    expect(focus).toEqual(createCameraFocus(20, 5, startSize + 3));
  });
});

describe('clampFocus', () => {
  const halfVisibleX = 6;
  const halfVisibleZ = 4;

  it('leaves a focus already inside the allowed range untouched', () => {
    const focus = createCameraFocus(12.5, 17.25, startSize);
    clampFocus(focus, width, depth, halfVisibleX, halfVisibleZ, edgeMarginMeters);
    expect(focus).toEqual(createCameraFocus(12.5, 17.25, startSize));
  });

  it('keeps a blade at any field edge at least the margin inside the visible area', () => {
    for (const [bladeX, bladeZ] of [[0, 0], [width, depth]] as const) {
      const focus = createCameraFocus(bladeX, bladeZ, startSize);
      clampFocus(focus, width, depth, halfVisibleX, halfVisibleZ, edgeMarginMeters);
      expect(Math.abs(bladeX - focus.x)).toBeLessThanOrEqual(halfVisibleX - edgeMarginMeters);
      expect(Math.abs(bladeZ - focus.z)).toBeLessThanOrEqual(halfVisibleZ - edgeMarginMeters);
    }
  });

  it('centers an axis whose visible area is larger than the field plus both margins', () => {
    const halfVisibleXWiderThanField = width;
    const focus = createCameraFocus(1, 1, startSize);
    clampFocus(focus, width, depth, halfVisibleXWiderThanField, halfVisibleZ, edgeMarginMeters);
    expect(focus.x).toBe(width / 2);
    expect(focus.z).toBe(halfVisibleZ - edgeMarginMeters);
  });

  it('centers an axis whose visible area is exactly the field plus both margins', () => {
    const focus = createCameraFocus(2, 29, startSize);
    clampFocus(focus, width, depth, width / 2 + edgeMarginMeters, depth / 2 + edgeMarginMeters, edgeMarginMeters);
    expect(focus.x).toBe(width / 2);
    expect(focus.z).toBe(depth / 2);
  });

  it('still follows the blade within the margins when the visible area is the field but not the margins', () => {
    const focus = createCameraFocus(0, depth, startSize);
    clampFocus(focus, width, depth, width / 2, depth / 2, edgeMarginMeters);
    expect(focus.x).toBe(width / 2 - edgeMarginMeters);
    expect(focus.z).toBe(depth / 2 + edgeMarginMeters);
  });

  it('keeps the focus halfVisible minus the margin away from the edges when the blade is in a corner', () => {
    const focus = createCameraFocus(width, 0, startSize);
    clampFocus(focus, width, depth, halfVisibleX, halfVisibleZ, edgeMarginMeters);
    expect(focus.x).toBe(width - halfVisibleX + edgeMarginMeters);
    expect(focus.z).toBe(halfVisibleZ - edgeMarginMeters);
  });

  it('does not change the distance', () => {
    const focus = createCameraFocus(0, 0, startSize + 2);
    clampFocus(focus, width, depth, halfVisibleX, halfVisibleZ, edgeMarginMeters);
    expect(focus.distance).toBe(targetDistance(startSize + 2));
  });
});
