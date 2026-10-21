import { DoubleSide, Mesh, MeshBasicMaterial, Shape, ShapeGeometry, type Scene } from 'three';
import type { Blade } from '../logic/blade';
import { compassPlacement } from './compassMath';

const ARROW_COLOR = 0xffd23f;
const ARROW_OPACITY = 0.9;
/** Just above the ground, like the blade's shadow. */
const ARROW_HEIGHT = 0.02;
/** Drawn after the grass and over it, so the tall grass around the blade never hides it. */
const ARROW_RENDER_ORDER = 10;

export interface CompassView {
  /** Points the arrow from the blade toward `target`; hidden when target is null. */
  update(blade: Blade, target: { x: number; z: number } | null): void;
  dispose(): void;
}

/** A flat yellow arrow on the ground beside the blade. */
export function createCompassView(scene: Scene): CompassView {
  const geometry = new ShapeGeometry(createArrowShape());
  // The shape is drawn in the XY plane pointing +x; lay it flat on XZ.
  geometry.rotateX(-Math.PI / 2);
  const material = new MeshBasicMaterial({
    color: ARROW_COLOR,
    transparent: true,
    opacity: ARROW_OPACITY,
    depthWrite: false,
    depthTest: false,
    side: DoubleSide,
  });
  const arrow = new Mesh(geometry, material);
  arrow.position.y = ARROW_HEIGHT;
  arrow.renderOrder = ARROW_RENDER_ORDER;
  arrow.visible = false;
  scene.add(arrow);

  function update(blade: Blade, target: { x: number; z: number } | null): void {
    arrow.visible = target !== null;
    if (!target) return;
    const { x, z, angle } = compassPlacement(blade, target);
    arrow.position.x = x;
    arrow.position.z = z;
    // A turn of θ around Y takes +x to (cos θ, −sin θ), so the field angle is negated.
    arrow.rotation.y = -angle;
  }

  function dispose(): void {
    scene.remove(arrow);
    geometry.dispose();
    material.dispose();
  }

  return { update, dispose };
}

/** An arrow 0.9 m long pointing +x, its tail at the origin. */
function createArrowShape(): Shape {
  const shape = new Shape();
  shape.moveTo(0, -0.12);
  shape.lineTo(0.5, -0.12);
  shape.lineTo(0.5, -0.3);
  shape.lineTo(0.9, 0);
  shape.lineTo(0.5, 0.3);
  shape.lineTo(0.5, 0.12);
  shape.lineTo(0, 0.12);
  shape.closePath();
  return shape;
}
