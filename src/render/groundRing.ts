import { Mesh, MeshBasicMaterial, RingGeometry, type Scene } from 'three';

/** Width of the ring's band, as a fraction of its radius. */
const BAND_FRACTION = 0.08;
/** Just above the ground, like the compass arrow. */
const RING_HEIGHT = 0.03;
/** Drawn after the grass and over it, so the tall grass never hides it. */
const RING_RENDER_ORDER = 10;
const RING_SEGMENTS = 64;

export interface GroundRing {
  /** Draws the ring at (x, z) with `radius` and `opacity`; opacity 0 hides it. */
  show(x: number, z: number, radius: number, opacity: number): void;
  dispose(): void;
}

/** A thin flat ring on the ground, of radius 1 scaled to the radius asked for. */
export function createGroundRing(scene: Scene, color: number): GroundRing {
  const geometry = new RingGeometry(1 - BAND_FRACTION, 1, RING_SEGMENTS);
  // The ring is drawn in the XY plane; lay it flat on XZ.
  geometry.rotateX(-Math.PI / 2);
  const material = new MeshBasicMaterial({ color, transparent: true, depthWrite: false, depthTest: false });
  const ring = new Mesh(geometry, material);
  ring.position.y = RING_HEIGHT;
  ring.renderOrder = RING_RENDER_ORDER;
  ring.visible = false;
  scene.add(ring);

  function show(x: number, z: number, radius: number, opacity: number): void {
    ring.visible = opacity > 0 && radius > 0;
    if (!ring.visible) return;
    ring.position.x = x;
    ring.position.z = z;
    ring.scale.set(radius, 1, radius);
    material.opacity = opacity;
  }

  function dispose(): void {
    scene.remove(ring);
    geometry.dispose();
    material.dispose();
  }

  return { show, dispose };
}
