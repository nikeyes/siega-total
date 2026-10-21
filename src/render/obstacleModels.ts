import {
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  Material,
  MeshLambertMaterial,
  SphereGeometry,
} from 'three';
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
