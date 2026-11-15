import { config } from '../config';
import type { GameStatus } from './game';

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

/** The vertical field of view on a screen of `aspect`: narrower than portraitReferenceAspect, it opens up to show the width that one shows. */
export function verticalFovDegrees(aspect: number): number {
  const { fovDegrees, portraitReferenceAspect } = config.camera;
  if (portraitReferenceAspect === null || aspect >= portraitReferenceAspect) return fovDegrees;
  const halfTangent = (Math.tan(degreesToRadians(fovDegrees) / 2) * portraitReferenceAspect) / aspect;
  return radiansToDegrees(2 * Math.atan(halfTangent));
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** How far the camera wants to be: over the whole field before the first move when overviewBeforeStart, otherwise at the blade's size. */
export function cameraDistanceFor(status: GameStatus, bladeSize: number, fieldWidth: number, fieldDepth: number, aspect: number): number {
  if (status === 'ready' && config.camera.overviewBeforeStart) return overviewDistance(fieldWidth, fieldDepth, aspect);
  return targetDistance(bladeSize);
}

/** Far enough to show the whole field and a margin around it, on a screen of `aspect`. */
function overviewDistance(fieldWidth: number, fieldDepth: number, aspect: number): number {
  const margin = config.camera.edgeMarginMeters;
  const halfVisibleNeeded = Math.max(fieldDepth / 2 + margin, (fieldWidth / 2 + margin) / aspect);
  return halfVisibleNeeded / Math.tan(degreesToRadians(verticalFovDegrees(aspect)) / 2);
}

/** Exponential smoothing toward the blade and `distance`, independent of the frame rate. */
export function followBlade(focus: CameraFocus, bladeX: number, bladeZ: number, distance: number, dt: number): void {
  const followFactor = 1 - Math.exp(-dt / config.camera.followLagSeconds);
  focus.x += (bladeX - focus.x) * followFactor;
  focus.z += (bladeZ - focus.z) * followFactor;
  // Five time constants per transition: 99% of the zoom is done after zoomTransitionSeconds.
  const zoomFactor = 1 - Math.exp((-5 * dt) / config.camera.zoomTransitionSeconds);
  focus.distance += (distance - focus.distance) * zoomFactor;
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
