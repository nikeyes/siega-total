import {
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Path,
  Shape,
  ShapeGeometry,
  Vector2,
  type Scene,
} from 'three';
import { bladeRadius, type Blade } from '../logic/blade';
import { armOutline, bladeShapeFor, discOutline, HUB_HOLE_RADIUS, HUB_RADIUS, type BladeShape, type Vec2 } from './bladeShapes';

const HUB_COLOR = 0x1fb6f2;
const BLADE_COLOR = 0xf2f4f7;
const HUB_HOLE_COLOR = 0x0b3a4d;
const HUB_HEIGHT = 0.14;
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

/** A blue hub with the arms or disc of `bladeShapeFor(size)`, sized to a radius of 1 and scaled to `bladeRadius(size)`, plus a fake shadow. */
export function createBladeView(scene: Scene): BladeView {
  const spinner = new Group();
  spinner.add(
    new Mesh(new CylinderGeometry(HUB_RADIUS, HUB_RADIUS * 1.1, HUB_HEIGHT, 24), new MeshLambertMaterial({ color: HUB_COLOR })),
  );
  const bladeMaterial = new MeshLambertMaterial({ color: BLADE_COLOR, side: DoubleSide });
  const hubHoleMaterial = new MeshBasicMaterial({ color: HUB_HOLE_COLOR });
  const shapeGroups = new Map<string, Group>();
  let currentShape: Group | null = null;

  /** The blade's arms or disc for `shape`, built the first time it is needed. */
  function shapeGroup(shape: BladeShape): Group {
    const key = JSON.stringify(shape);
    let group = shapeGroups.get(key);
    if (!group) {
      group = createShapeGroup(shape, bladeMaterial, hubHoleMaterial);
      shapeGroups.set(key, group);
    }
    return group;
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
    const nextShape = shapeGroup(bladeShapeFor(blade.size));
    if (nextShape !== currentShape) {
      if (currentShape) spinner.remove(currentShape);
      spinner.add(nextShape);
      currentShape = nextShape;
    }
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

/** The arms around the hub, or the disc, drawn flat at a radius of 1. */
function createShapeGroup(shape: BladeShape, bladeMaterial: MeshLambertMaterial, hubHoleMaterial: MeshBasicMaterial): Group {
  const group = new Group();
  if (shape.kind === 'disc') {
    const { outer, hole } = discOutline(shape.teeth);
    const disc = new Shape(outer.map(toVector2));
    disc.holes.push(new Path(hole.map(toVector2)));
    group.add(new Mesh(flatGeometry(disc), bladeMaterial));
    return group;
  }
  const armGeometry = flatGeometry(new Shape(armOutline(shape.width, shape.teeth).map(toVector2)));
  for (let arm = 0; arm < shape.arms; arm++) {
    const armMesh = new Mesh(armGeometry, bladeMaterial);
    armMesh.rotation.y = (arm / shape.arms) * Math.PI * 2;
    group.add(armMesh);
  }
  if (shape.hubHole) {
    const hole = new Mesh(new CircleGeometry(HUB_HOLE_RADIUS, 24), hubHoleMaterial);
    hole.rotation.x = -Math.PI / 2;
    // Just above the hub's cap, so it does not flicker into it.
    hole.position.y = HUB_HEIGHT / 2 + 0.002;
    group.add(hole);
  }
  return group;
}

/** The outline is drawn in the XY plane; the blade lies flat on XZ. */
function flatGeometry(shape: Shape): ShapeGeometry {
  const geometry = new ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function toVector2({ x, y }: Vec2): Vector2 {
  return new Vector2(x, y);
}
