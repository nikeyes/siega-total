import { BoxGeometry, Color, DynamicDrawUsage, InstancedMesh, Matrix4, MeshLambertMaterial, Quaternion, Vector3, type Scene } from 'three';
import { burstPiecePosition, type Vector } from './burstMotion';

/** Pieces in the pool; the oldest is reused when more are needed. */
const POOL_SIZE = 200;
const PIECE_SIZE = 0.16;
const LIFETIME_SECONDS = 0.8;
const LAUNCH_HEIGHT = 0.3;
const MIN_UP_SPEED = 2.5;
const MAX_UP_SPEED = 4.5;
const MAX_SIDE_SPEED = 2.5;
const SPIN_SPEED = 10;

export interface BurstView {
  /** Throws `count` pieces of `color` from the ground at (x, z). */
  spawn(x: number, z: number, color: number, count: number): void;
  /** Moves the pieces and shrinks them away over their lifetime. */
  update(dt: number): void;
  dispose(): void;
}

interface Piece {
  origin: Vector;
  velocity: Vector;
  spinAxis: Vector3;
  /** Seconds since thrown; Infinity when unused. */
  age: number;
}

/** A fixed pool of small cubes in one InstancedMesh, with a color per instance. */
export function createBurstView(scene: Scene): BurstView {
  const geometry = new BoxGeometry(PIECE_SIZE, PIECE_SIZE, PIECE_SIZE);
  const material = new MeshLambertMaterial();
  const mesh = new InstancedMesh(geometry, material, POOL_SIZE);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  // Pieces fly anywhere around the field; skipping the culling avoids recomputing bounds every frame.
  mesh.frustumCulled = false;
  const pieces: Piece[] = Array.from({ length: POOL_SIZE }, () => ({
    origin: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    spinAxis: new Vector3(0, 1, 0),
    age: Infinity,
  }));
  const hidden = new Matrix4().makeScale(0, 0, 0);
  const color = new Color();
  for (let piece = 0; piece < POOL_SIZE; piece++) {
    mesh.setMatrixAt(piece, hidden);
    mesh.setColorAt(piece, color);
  }
  scene.add(mesh);

  let next = 0;
  let alive = 0;

  function spawn(x: number, z: number, pieceColor: number, count: number): void {
    color.setHex(pieceColor);
    for (let thrown = 0; thrown < count; thrown++) {
      const piece = pieces[next]!;
      const angle = Math.random() * Math.PI * 2;
      const sideSpeed = Math.random() * MAX_SIDE_SPEED;
      piece.origin = { x, y: LAUNCH_HEIGHT, z };
      piece.velocity = {
        x: Math.cos(angle) * sideSpeed,
        y: MIN_UP_SPEED + Math.random() * (MAX_UP_SPEED - MIN_UP_SPEED),
        z: Math.sin(angle) * sideSpeed,
      };
      piece.spinAxis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      if (piece.age >= LIFETIME_SECONDS) alive++;
      piece.age = 0;
      mesh.setColorAt(next, color);
      next = (next + 1) % POOL_SIZE;
    }
    mesh.instanceColor!.needsUpdate = true;
  }

  const matrix = new Matrix4();
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();

  function update(dt: number): void {
    if (alive === 0) return;
    pieces.forEach((piece, index) => {
      if (piece.age >= LIFETIME_SECONDS) return;
      piece.age += dt;
      if (piece.age >= LIFETIME_SECONDS) {
        alive--;
        mesh.setMatrixAt(index, hidden);
        return;
      }
      const { x, y, z } = burstPiecePosition(piece.origin, piece.velocity, piece.age);
      position.set(x, y, z);
      rotation.setFromAxisAngle(piece.spinAxis, piece.age * SPIN_SPEED);
      scale.setScalar(1 - piece.age / LIFETIME_SECONDS);
      mesh.setMatrixAt(index, matrix.compose(position, rotation, scale));
    });
    mesh.instanceMatrix.needsUpdate = true;
  }

  function dispose(): void {
    scene.remove(mesh);
    mesh.dispose();
    geometry.dispose();
    material.dispose();
  }

  return { spawn, update, dispose };
}
