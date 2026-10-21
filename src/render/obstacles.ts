import { InstancedMesh, Matrix4, Quaternion, Vector3, type Scene } from 'three';
import type { Obstacle, ObstacleType } from '../logic/levels';
import { createRandom } from '../logic/random';
import type { ObstacleModels } from './obstacleModels';

export interface ObstacleView {
  /** Hides the given obstacles. */
  markCut(indices: number[]): void;
  /** Shows every obstacle again. */
  reset(): void;
  /** Takes the meshes out of the scene; the shared models stay loaded. */
  dispose(): void;
}

interface TypeMeshes {
  /** One mesh per model part; obstacle `i` of this type is instance `instanceOf[i]` in each. */
  readonly meshes: InstancedMesh[];
}

/** One InstancedMesh per part of each obstacle type present, each obstacle turned at random around Y. */
export function createObstacleView(scene: Scene, obstacles: readonly Obstacle[], models: ObstacleModels, seed: number): ObstacleView {
  const random = createRandom(seed);
  const standingMatrices = obstacles.map(({ x, z }) =>
    new Matrix4().compose(new Vector3(x, 0, z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), random() * Math.PI * 2), new Vector3(1, 1, 1)),
  );
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

  function reset(): void {
    standingMatrices.forEach((matrix, index) => setMatrix(index, matrix));
    for (const { meshes } of byType.values()) for (const mesh of meshes) mesh.computeBoundingSphere();
  }

  function markCut(indices: number[]): void {
    for (const index of indices) setMatrix(index, hidden);
  }

  function dispose(): void {
    for (const { meshes } of byType.values()) {
      for (const mesh of meshes) {
        scene.remove(mesh);
        mesh.dispose();
      }
    }
  }

  reset();
  return { markCut, reset, dispose };
}
