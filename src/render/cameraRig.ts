import { MathUtils, PerspectiveCamera } from 'three';
import { config } from '../config';
import type { CameraFocus } from '../logic/camera';

const NEAR_PLANE = 0.1;
const FAR_PLANE = 200;

const tilt = MathUtils.degToRad(config.camera.tiltDegrees);

export interface CameraRig {
  readonly camera: PerspectiveCamera;
  setAspect(aspect: number): void;
  /** Places the camera south of the focus and above it, looking at it, so north stays up. */
  update(focus: CameraFocus): void;
}

export function createCameraRig(): CameraRig {
  const camera = new PerspectiveCamera(config.camera.fovDegrees, 1, NEAR_PLANE, FAR_PLANE);

  function setAspect(aspect: number): void {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  function update(focus: CameraFocus): void {
    camera.position.set(
      focus.x,
      focus.distance * Math.sin(tilt),
      focus.z + focus.distance * Math.cos(tilt),
    );
    camera.lookAt(focus.x, 0, focus.z);
  }

  return { camera, setAspect, update };
}

/** Approximate half size of the ground area the camera sees around its focus. */
export function halfVisible(distance: number, aspect: number): { halfVisibleX: number; halfVisibleZ: number } {
  const halfVisibleZ = distance * Math.tan(MathUtils.degToRad(config.camera.fovDegrees) / 2);
  return { halfVisibleX: halfVisibleZ * aspect, halfVisibleZ };
}
