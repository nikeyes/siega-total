import { InstancedMesh, Matrix4, Quaternion, Vector3, type Scene } from 'three';
import type { Obstacle, ObstacleType } from '../logic/levels';
import { createRandom } from '../logic/random';
import { obstacleHits } from '../logic/obstacles';
import { damageScale, fruitPose, FRUIT_POSE, hitWobble } from './fruitPose';
import type { ObstacleModels } from './obstacleModels';

export interface ObstacleView {
  /** Hides the given obstacles. */
  markCut(indices: number[]): void;
  /** Starts the shake of the given obstacles, hit at `time`, and shows them smaller for every hit taken. */
  markHit(indices: number[], time: number): void;
  /** Bobs and turns the standing fruit, and shakes every piece hit, to `time`. */
  update(time: number): void;
  /** Takes the meshes out of the scene; the shared models stay loaded. */
  dispose(): void;
}

interface TypeMeshes {
  /** One mesh per model part; obstacle `i` of this type is instance `instanceOf[i]` in each. */
  readonly meshes: InstancedMesh[];
}

const Y_AXIS = new Vector3(0, 1, 0);
const X_AXIS = new Vector3(1, 0, 0);

const isFruit = (type: ObstacleType) => type === 'watermelon' || type === 'strawberry';

/** One InstancedMesh per part of each obstacle type present, each obstacle turned at random around Y; fruit floats on the grass. */
export function createObstacleView(scene: Scene, obstacles: readonly Obstacle[], models: ObstacleModels, seed: number): ObstacleView {
  const random = createRandom(seed);
  const standingMatrices = obstacles.map(({ x, z }) =>
    new Matrix4().compose(new Vector3(x, 0, z), new Quaternion().setFromAxisAngle(Y_AXIS, random() * Math.PI * 2), new Vector3(1, 1, 1)),
  );
  const fruitPhases = obstacles.map(() => random());
  const cut = new Set<number>();
  const hitsTaken = new Uint8Array(obstacles.length);
  const lastHitAt = new Float64Array(obstacles.length).fill(-Infinity);
  const instanceOf = new Int32Array(obstacles.length);
  const byType = new Map<ObstacleType, TypeMeshes>();
  const countByType = new Map<ObstacleType, number>();
  obstacles.forEach(({ type }, index) => {
    instanceOf[index] = countByType.get(type) ?? 0;
    countByType.set(type, instanceOf[index]! + 1);
  });
  for (const [type, count] of countByType) {
    const meshes = models[type].map(({ geometry, material }) => new InstancedMesh(geometry, material, count));
    byType.set(type, { meshes });
    for (const mesh of meshes) scene.add(mesh);
  }

  const hidden = new Matrix4().makeScale(0, 0, 0);

  function setMatrix(index: number, matrix: Matrix4): void {
    for (const mesh of byType.get(obstacles[index]!.type)!.meshes) {
      mesh.setMatrixAt(instanceOf[index]!, matrix);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  function showAllStanding(): void {
    standingMatrices.forEach((matrix, index) => setMatrix(index, matrix));
  }

  function markCut(indices: number[]): void {
    for (const index of indices) {
      cut.add(index);
      setMatrix(index, hidden);
    }
  }

  function markHit(indices: number[], time: number): void {
    for (const index of indices) {
      hitsTaken[index]!++;
      lastHitAt[index] = time;
    }
  }

  const position = new Vector3();
  const turn = new Quaternion();
  const tilt = new Quaternion();
  const pieceScale = new Vector3();
  const pieceMatrix = new Matrix4();

  function update(time: number): void {
    obstacles.forEach(({ type, x, z }, index) => {
      if (cut.has(index)) return;
      const shrink = damageScale(hitsTaken[index]!, obstacleHits(type));
      const shake = tilt.setFromAxisAngle(X_AXIS, hitWobble(time - lastHitAt[index]!));
      if (isFruit(type)) {
        const pose = fruitPose(time, fruitPhases[index]!);
        turn.setFromAxisAngle(Y_AXIS, pose.turn).multiply(shake);
        pieceScale.setScalar(FRUIT_POSE.scale * shrink);
        setMatrix(index, pieceMatrix.compose(position.set(x, pose.height, z), turn, pieceScale));
      } else if (hitsTaken[index]! > 0) {
        // A cactus stands still on the ground; only its hits shake and shrink it.
        setMatrix(index, pieceMatrix.makeRotationFromQuaternion(shake).scale(pieceScale.setScalar(shrink)).premultiply(standingMatrices[index]!));
      }
    });
  }

  function dispose(): void {
    for (const { meshes } of byType.values()) {
      for (const mesh of meshes) {
        scene.remove(mesh);
        mesh.dispose();
      }
    }
  }

  showAllStanding();
  update(0);
  // From the fruit already afloat, so the camera does not cull them; their bob stays well inside it.
  for (const { meshes } of byType.values()) for (const mesh of meshes) mesh.computeBoundingSphere();
  return { markCut, markHit, update, dispose };
}
