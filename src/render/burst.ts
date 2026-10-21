import {
  BoxGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  FrontSide,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Scene,
} from 'three';
import { burstPiecePosition, type Vector } from './burstMotion';

const LAUNCH_HEIGHT = 0.3;
/** A flat piece is this many times longer than it is wide, like a bit of grass. */
const FLAT_PIECE_LENGTH = 3;

export interface BurstOptions {
  /** Pieces in the pool; the oldest is reused when more are needed. */
  poolSize: number;
  /** Small cubes, or flat strips seen from both sides. */
  geometry: 'cube' | 'flat';
  pieceSize: number;
  lifetimeSeconds: number;
  minUpSpeed: number;
  maxUpSpeed: number;
  maxSideSpeed: number;
  spinSpeed: number;
  /** Pieces shrink away over their lifetime; when false they keep their size to the end. */
  shrink: boolean;
  /** Called with where each piece ends up and its color, when its lifetime is over. */
  onExpire?: (x: number, z: number, color: number) => void;
}

/** The fruit and cactus burst. */
const DEFAULT_OPTIONS: BurstOptions = {
  poolSize: 200,
  geometry: 'cube',
  pieceSize: 0.16,
  lifetimeSeconds: 0.8,
  minUpSpeed: 2.5,
  maxUpSpeed: 4.5,
  maxSideSpeed: 2.5,
  spinSpeed: 10,
  shrink: true,
};

export interface BurstView {
  /** Throws `count` pieces of `color` from the ground at (x, z). */
  spawn(x: number, z: number, color: number, count: number): void;
  /** Moves the pieces and, unless `shrink` is off, shrinks them away over their lifetime. */
  update(dt: number): void;
  /** Hides every piece still in the air without landing it. */
  clear(): void;
  dispose(): void;
}

interface Piece {
  origin: Vector;
  velocity: Vector;
  spinAxis: Vector3;
  color: number;
  /** Where the piece was drawn last, for onExpire. */
  lastX: number;
  lastZ: number;
  /** Seconds since thrown; Infinity when unused. */
  age: number;
}

/** A fixed pool of small pieces in one InstancedMesh, with a color per instance. */
export function createBurstView(scene: Scene, options: Partial<BurstOptions> = {}): BurstView {
  const { poolSize, geometry: shape, pieceSize, lifetimeSeconds, minUpSpeed, maxUpSpeed, maxSideSpeed, spinSpeed, shrink, onExpire } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  const flat = shape === 'flat';
  const geometry: BufferGeometry = flat
    ? new PlaneGeometry(pieceSize, pieceSize * FLAT_PIECE_LENGTH)
    : new BoxGeometry(pieceSize, pieceSize, pieceSize);
  // A flat piece spins, so both of its faces show.
  const material = new MeshLambertMaterial({ side: flat ? DoubleSide : FrontSide });
  const mesh = new InstancedMesh(geometry, material, poolSize);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  // Pieces fly anywhere around the field; skipping the culling avoids recomputing bounds every frame.
  mesh.frustumCulled = false;
  const pieces: Piece[] = Array.from({ length: poolSize }, () => ({
    origin: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    spinAxis: new Vector3(0, 1, 0),
    color: 0,
    lastX: 0,
    lastZ: 0,
    age: Infinity,
  }));
  const hidden = new Matrix4().makeScale(0, 0, 0);
  const color = new Color();
  for (let piece = 0; piece < poolSize; piece++) {
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
      const sideSpeed = Math.random() * maxSideSpeed;
      piece.origin = { x, y: LAUNCH_HEIGHT, z };
      piece.color = pieceColor;
      piece.lastX = x;
      piece.lastZ = z;
      piece.velocity = {
        x: Math.cos(angle) * sideSpeed,
        y: minUpSpeed + Math.random() * (maxUpSpeed - minUpSpeed),
        z: Math.sin(angle) * sideSpeed,
      };
      piece.spinAxis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      if (piece.age >= lifetimeSeconds) alive++;
      piece.age = 0;
      mesh.setColorAt(next, color);
      next = (next + 1) % poolSize;
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
      if (piece.age >= lifetimeSeconds) return;
      piece.age += dt;
      if (piece.age >= lifetimeSeconds) {
        alive--;
        mesh.setMatrixAt(index, hidden);
        onExpire?.(piece.lastX, piece.lastZ, piece.color);
        return;
      }
      const { x, y, z } = burstPiecePosition(piece.origin, piece.velocity, piece.age);
      piece.lastX = x;
      piece.lastZ = z;
      position.set(x, y, z);
      rotation.setFromAxisAngle(piece.spinAxis, piece.age * spinSpeed);
      scale.setScalar(shrink ? 1 - piece.age / lifetimeSeconds : 1);
      mesh.setMatrixAt(index, matrix.compose(position, rotation, scale));
    });
    mesh.instanceMatrix.needsUpdate = true;
  }

  function clear(): void {
    pieces.forEach((piece, index) => {
      piece.age = Infinity;
      mesh.setMatrixAt(index, hidden);
    });
    alive = 0;
    mesh.instanceMatrix.needsUpdate = true;
  }

  function dispose(): void {
    scene.remove(mesh);
    mesh.dispose();
    geometry.dispose();
    material.dispose();
  }

  return { spawn, update, clear, dispose };
}
