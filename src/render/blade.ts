import {
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Shape,
  ShapeGeometry,
  type Scene,
} from 'three';
import { bladeRadius, type Blade } from '../logic/blade';

const HUB_COLOR = 0x1fb6f2;
const BLADE_COLOR = 0xf2f4f7;
const BLADE_ARM_COUNT = 2;
const HUB_RADIUS = 0.22;
/** The blade spins low, inside the hole it cuts, with the tall grass around it. */
const HOVER_HEIGHT = 0.4;
const SPIN_RADIANS_PER_SECOND = 14;
const SHADOW_OPACITY = 0.2;
/** Keeps the shadow just above the ground to avoid z-fighting. */
const SHADOW_HEIGHT = 0.01;

export interface BladeView {
  update(blade: Blade, dt: number): void;
  setShadowVisible(visible: boolean): void;
}

/** A blue hub with curved arms, sized to a radius of 1 and scaled to `bladeRadius(size)`, plus a fake shadow. */
export function createBladeView(scene: Scene): BladeView {
  const spinner = new Group();
  spinner.add(
    new Mesh(new CylinderGeometry(HUB_RADIUS, HUB_RADIUS * 1.1, 0.14, 24), new MeshLambertMaterial({ color: HUB_COLOR })),
  );
  const armGeometry = new ShapeGeometry(createCurvedArmShape(), 12);
  // The shape is drawn in the XY plane; lay it flat on XZ.
  armGeometry.rotateX(-Math.PI / 2);
  const armMaterial = new MeshLambertMaterial({ color: BLADE_COLOR, side: DoubleSide });
  for (let arm = 0; arm < BLADE_ARM_COUNT; arm++) {
    const armMesh = new Mesh(armGeometry, armMaterial);
    armMesh.rotation.y = (arm / BLADE_ARM_COUNT) * Math.PI * 2;
    spinner.add(armMesh);
  }
  spinner.position.y = HOVER_HEIGHT;
  scene.add(spinner);

  const shadow = new Mesh(
    new CircleGeometry(1, 32),
    new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: SHADOW_OPACITY, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = SHADOW_HEIGHT;
  scene.add(shadow);

  function update(blade: Blade, dt: number): void {
    const radius = bladeRadius(blade.size);
    spinner.position.x = blade.x;
    spinner.position.z = blade.z;
    spinner.scale.setScalar(radius);
    spinner.rotation.y -= SPIN_RADIANS_PER_SECOND * dt;
    shadow.position.x = blade.x;
    shadow.position.z = blade.z;
    shadow.scale.setScalar(radius);
  }

  function setShadowVisible(visible: boolean): void {
    shadow.visible = visible;
  }

  return { update, setShadowVisible };
}

/** A scythe-like arm from the hub to a pointed tip at radius 1, curving back against the spin. */
function createCurvedArmShape(): Shape {
  const shape = new Shape();
  shape.moveTo(0.1, -0.12);
  shape.quadraticCurveTo(0.6, -0.2, 1, 0.12);
  shape.quadraticCurveTo(0.55, 0, 0.1, 0.12);
  shape.closePath();
  return shape;
}
