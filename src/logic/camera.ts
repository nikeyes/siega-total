import { config } from '../config';

/** The field point the camera looks at, and how far away it is. */
export interface CameraFocus {
  x: number;
  z: number;
  distance: number;
}

export function createCameraFocus(x: number, z: number, size: number): CameraFocus {
  return { x, z, distance: targetDistance(size) };
}

export function targetDistance(size: number): number {
  return config.camera.baseDistance * (1 + config.camera.zoomPerSize) ** (size - 1);
}

/** Exponential smoothing toward the blade, independent of the frame rate. */
export function followBlade(focus: CameraFocus, bladeX: number, bladeZ: number, bladeSize: number, dt: number): void {
  const followFactor = 1 - Math.exp(-dt / config.camera.followLagSeconds);
  focus.x += (bladeX - focus.x) * followFactor;
  focus.z += (bladeZ - focus.z) * followFactor;
  // Five time constants per transition: 99% of the zoom is done after zoomTransitionSeconds.
  const zoomFactor = 1 - Math.exp((-5 * dt) / config.camera.zoomTransitionSeconds);
  focus.distance += (targetDistance(bladeSize) - focus.distance) * zoomFactor;
}

/**
 * Keeps the visible area inside the field plus `margin` meters beyond each edge,
 * so a blade at the edge stays on screen with some sand around it.
 */
export function clampFocus(
  focus: CameraFocus,
  width: number,
  depth: number,
  halfVisibleX: number,
  halfVisibleZ: number,
  margin: number,
): void {
  focus.x = clampToVisibleRange(focus.x, width, halfVisibleX, margin);
  focus.z = clampToVisibleRange(focus.z, depth, halfVisibleZ, margin);
}

/** Clamps one axis to `[halfVisible - margin, length - halfVisible + margin]`, or centers it when the visible area is larger than the field plus both margins. */
function clampToVisibleRange(value: number, length: number, halfVisible: number, margin: number): number {
  if (2 * halfVisible >= length + 2 * margin) return length / 2;
  return Math.min(length - halfVisible + margin, Math.max(halfVisible - margin, value));
}
