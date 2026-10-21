import {
  Box3,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  Material,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  SphereGeometry,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { ObstacleType } from '../logic/levels';
import { obstacleRadius } from '../logic/obstacles';
import { OBSTACLE_COLORS } from './obstacleColors';

export interface ObstacleModelPart {
  geometry: BufferGeometry;
  material: Material;
}

/** Parts of one obstacle, already scaled so its footprint matches `obstacleRadius(type)`. */
export type ObstacleModels = Record<ObstacleType, readonly ObstacleModelPart[]>;

const ROCK_COLOR = 0x8a8f98;
/** Flat-colored stand-ins drawn in code (phase 7 swaps them for the Kenney models). */
export function placeholderObstacleModels(): ObstacleModels {
  const rock = obstacleRadius('rock');
  const rockGeometry = new IcosahedronGeometry(rock, 0).scale(1, 0.6, 1).translate(0, rock * 0.4, 0);

  const cactus = obstacleRadius('cactus');
  const trunkRadius = cactus * 0.35;
  const trunkHeight = cactus * 2.2;
  const armRadius = trunkRadius * 0.6;
  const cactusMaterial = new MeshLambertMaterial({ color: OBSTACLE_COLORS.cactus });
  const cactusGeometries = [
    new CylinderGeometry(trunkRadius, trunkRadius, trunkHeight, 10).translate(0, trunkHeight / 2, 0),
    new CylinderGeometry(armRadius, armRadius, trunkHeight * 0.4, 8).translate(cactus - armRadius, trunkHeight * 0.6, 0),
    new CylinderGeometry(armRadius, armRadius, cactus - armRadius, 8)
      .rotateZ(Math.PI / 2)
      .translate((cactus - armRadius) / 2, trunkHeight * 0.4, 0),
    new CylinderGeometry(armRadius, armRadius, trunkHeight * 0.3, 8).translate(-(cactus - armRadius), trunkHeight * 0.5, 0),
    new CylinderGeometry(armRadius, armRadius, cactus - armRadius, 8)
      .rotateZ(Math.PI / 2)
      .translate(-(cactus - armRadius) / 2, trunkHeight * 0.35, 0),
  ];

  const watermelon = obstacleRadius('watermelon');
  const watermelonGeometry = new SphereGeometry(watermelon, 16, 12).scale(1, 0.85, 1).translate(0, watermelon * 0.85, 0);

  const strawberry = obstacleRadius('strawberry');
  const strawberryGeometry = new ConeGeometry(strawberry, strawberry * 2.2, 10).rotateX(Math.PI).translate(0, strawberry * 1.1, 0);

  return {
    rock: [{ geometry: rockGeometry, material: new MeshLambertMaterial({ color: ROCK_COLOR, flatShading: true }) }],
    cactus: cactusGeometries.map((geometry) => ({ geometry, material: cactusMaterial })),
    watermelon: [{ geometry: watermelonGeometry, material: new MeshLambertMaterial({ color: 0x2e7d32 }) }],
    strawberry: [{ geometry: strawberryGeometry, material: new MeshLambertMaterial({ color: OBSTACLE_COLORS.strawberry }) }],
  };
}

interface Vector {
  x: number;
  y: number;
  z: number;
}

/**
 * The uniform scale and the offset (applied after scaling) that give a model with bounding box `box`
 * a footprint of `radius` (half its longest side on the ground), centered on the origin and standing on y = 0.
 */
export function normalizedScale(box: { min: Vector; max: Vector }, radius: number): { scale: number; offset: Vector } {
  const footprint = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
  const scale = radius / footprint;
  return {
    scale,
    offset: {
      x: (-(box.min.x + box.max.x) / 2) * scale,
      y: -box.min.y * scale,
      z: (-(box.min.z + box.max.z) / 2) * scale,
    },
  };
}

/** Kenney's CC0 models, one file per obstacle type in `baseUrl`. */
const MODEL_FILES: Record<ObstacleType, string> = {
  rock: 'rock.glb',
  cactus: 'cactus.glb',
  watermelon: 'watermelon.glb',
  strawberry: 'strawberry.glb',
};

/** Loads the models and turns each mesh into a part, already placed and scaled to its obstacle's footprint. */
export async function loadObstacleModels(baseUrl: string): Promise<ObstacleModels> {
  const loader = new GLTFLoader();
  const load = (type: ObstacleType) => loadParts(loader, baseUrl + MODEL_FILES[type], obstacleRadius(type));
  const [rock, cactus, watermelon, strawberry] = await Promise.all([load('rock'), load('cactus'), load('watermelon'), load('strawberry')]);
  return { rock, cactus, watermelon, strawberry };
}

async function loadParts(loader: GLTFLoader, url: string, radius: number): Promise<ObstacleModelPart[]> {
  const { scene } = await loader.loadAsync(url);
  scene.updateMatrixWorld(true);
  const { scale, offset } = normalizedScale(new Box3().setFromObject(scene), radius);
  const normalize = new Matrix4().makeTranslation(offset.x, offset.y, offset.z).multiply(new Matrix4().makeScale(scale, scale, scale));
  const parts: ObstacleModelPart[] = [];
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const geometry = (object.geometry as BufferGeometry).clone().applyMatrix4(object.matrixWorld).applyMatrix4(normalize);
    parts.push({ geometry, material: object.material as Material });
  });
  return parts;
}
