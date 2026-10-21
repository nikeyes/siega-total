import {
  Color,
  DoubleSide,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type Scene,
} from 'three';

/** Same strip as a clipping in flight. */
const CLIPPING_WIDTH = 0.14;
const CLIPPING_LENGTH = 0.42;
/** Just above the sand, to avoid z-fighting. */
const LYING_HEIGHT = 0.02;

export interface GroundClippings {
  /** Lays a clipping flat on the ground at (x, z); past capacity, the oldest one is moved here. */
  place(x: number, z: number, color: number): void;
  /** Takes every clipping off the ground. */
  clear(): void;
  dispose(): void;
}

/** Clippings lying where they landed, in one InstancedMesh used as a ring buffer of `capacity` pieces. */
export function createGroundClippings(scene: Scene, capacity: number): GroundClippings {
  const geometry = new PlaneGeometry(CLIPPING_WIDTH, CLIPPING_LENGTH);
  // The plane is drawn in the XY plane; lay it flat on XZ.
  geometry.rotateX(-Math.PI / 2);
  const material = new MeshLambertMaterial({ side: DoubleSide });
  const mesh = new InstancedMesh(geometry, material, capacity);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  // Clippings lie all over the field; skipping the culling avoids recomputing bounds on every landing.
  mesh.frustumCulled = false;
  const hidden = new Matrix4().makeScale(0, 0, 0);
  const color = new Color();
  scene.add(mesh);

  const matrix = new Matrix4();
  const position = new Vector3();
  const rotation = new Quaternion();
  const unitScale = new Vector3(1, 1, 1);
  const up = new Vector3(0, 1, 0);
  let next = 0;

  function clear(): void {
    for (let piece = 0; piece < capacity; piece++) {
      mesh.setMatrixAt(piece, hidden);
      mesh.setColorAt(piece, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
    next = 0;
  }

  function place(x: number, z: number, pieceColor: number): void {
    position.set(x, LYING_HEIGHT, z);
    rotation.setFromAxisAngle(up, Math.random() * Math.PI * 2);
    mesh.setMatrixAt(next, matrix.compose(position, rotation, unitScale));
    mesh.setColorAt(next, color.setHex(pieceColor));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
    next = (next + 1) % capacity;
  }

  function dispose(): void {
    scene.remove(mesh);
    mesh.dispose();
    geometry.dispose();
    material.dispose();
  }

  clear();
  return { place, clear, dispose };
}
