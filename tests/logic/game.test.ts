import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { addCuts, bladeRadius, createBlade, type Direction } from '../../src/logic/blade';
import { createField, GRASS_TYPE_ORDER, type Field } from '../../src/logic/field';
import { createGame, stepGame, type Game, type StepResult } from '../../src/logic/game';

const { width, depth } = config.field;
const { startSize } = config.blade;
const SIXTY_FPS_FRAME = 1 / 60;
const EAST: Direction = { x: 1, z: 0 };
const WEST: Direction = { x: -1, z: 0 };
const NORTH: Direction = { x: 0, z: -1 };
const SOUTH: Direction = { x: 0, z: 1 };

type StepListener = (result: StepResult, radiusDuringStep: number) => void;

/** Steps the game one 60 fps frame at a time in `direction` until `arrived` holds. */
function driveUntil(game: Game, direction: Direction | null, arrived: () => boolean, onStep: StepListener = () => {}) {
  while (!arrived()) {
    const radiusDuringStep = bladeRadius(game.blade.size);
    onStep(stepGame(game, direction, SIXTY_FPS_FRAME), radiusDuringStep);
  }
}

function bladesWithin(field: Field, centerX: number, centerZ: number, radius: number): number[] {
  const inside: number[] = [];
  for (let blade = 0; blade < field.bladeCount; blade++) {
    const distance = Math.hypot(field.positionsX[blade]! - centerX, field.positionsZ[blade]! - centerZ);
    if (distance <= radius) inside.push(blade);
  }
  return inside;
}

/** Brakes to a stop, so the next direction starts a straight line instead of a curve. */
function stopBlade(game: Game, onStep?: StepListener) {
  driveUntil(game, null, () => game.blade.speed === 0, onStep);
}

/**
 * Mows the whole field in east-west lanes, starting from the northwest corner.
 * Lanes are a quarter of the starting cut width apart; braking after each lane change
 * adds some drift, but consecutive lanes stay close enough for their cuts to overlap.
 */
function mowInZigzag(game: Game) {
  const laneSpacing = config.blade.baseRadius / 2;
  driveUntil(game, NORTH, () => game.blade.z === 0);
  stopBlade(game);
  driveUntil(game, WEST, () => game.blade.x === 0);
  stopBlade(game);
  for (let lane = 0; ; lane++) {
    const goingEast = lane % 2 === 0;
    const edgeX = goingEast ? width : 0;
    driveUntil(game, goingEast ? EAST : WEST, () => game.blade.x === edgeX);
    stopBlade(game);
    if (game.blade.z === depth) return;
    const nextLaneZ = Math.min(depth, game.blade.z + laneSpacing);
    driveUntil(game, SOUTH, () => game.blade.z >= nextLaneZ);
    stopBlade(game);
  }
}

describe('createGame', () => {
  it('covers the whole field in green grass', () => {
    const { field } = createGame();
    const green = GRASS_TYPE_ORDER.indexOf('green');
    expect(field.types.every((type) => type === green)).toBe(true);
  });
});

describe('stepGame', () => {
  it('cuts the blades under the starting position on the first step without a direction', () => {
    const game = createGame();
    const result = stepGame(game, null, SIXTY_FPS_FRAME);
    const underStart = bladesWithin(game.field, width / 2, depth / 2, bladeRadius(startSize));
    expect(underStart.length).toBeGreaterThan(0);
    expect([...result.cutIndices].sort((a, b) => a - b)).toEqual(underStart);
    expect(game.field.cutCount).toBe(underStart.length);
  });

  it('only cuts blades within bladeRadius of the path when crossing the field from west to east', () => {
    const game = createGame();
    driveUntil(game, WEST, () => game.blade.x === 0);
    stopBlade(game);
    const pathZ = game.blade.z;
    const farthestCuts: number[] = [];
    let cutsOnTheWay = 0;
    driveUntil(game, EAST, () => game.blade.x === width, ({ cutIndices }, radius) => {
      cutsOnTheWay += cutIndices.length;
      for (const blade of cutIndices) {
        const distanceToBlade = Math.hypot(
          game.field.positionsX[blade]! - game.blade.x,
          game.field.positionsZ[blade]! - game.blade.z,
        );
        if (distanceToBlade > radius) farthestCuts.push(blade);
      }
    });
    expect(cutsOnTheWay).toBeGreaterThan(0);
    expect(farthestCuts).toEqual([]);
    expect(game.blade.z).toBe(pathZ);
  });

  it('grows the blade by the same sizes as addCuts over all the blades cut', () => {
    const game = createGame();
    let totalCut = 0;
    let totalSizesGained = 0;
    const record: StepListener = ({ cutIndices, sizesGained }) => {
      totalCut += cutIndices.length;
      totalSizesGained += sizesGained;
    };
    driveUntil(game, WEST, () => game.blade.x === 0, record);
    stopBlade(game, record);
    driveUntil(game, EAST, () => game.blade.x === width, record);

    const reference = createBlade(0, 0);
    const expectedSizesGained = addCuts(reference, totalCut);
    expect(expectedSizesGained).toBeGreaterThan(0);
    expect(totalSizesGained).toBe(expectedSizesGained);
    expect(game.blade.size).toBe(reference.size);
    expect(game.blade.growthProgress).toBe(reference.growthProgress);
  });

  it('cuts with the new, larger radius right after growing a size', () => {
    const game = createGame();
    let grown = false;
    driveUntil(game, WEST, () => grown || game.blade.x === 0, ({ sizesGained }) => (grown = sizesGained > 0));
    expect(grown).toBe(true);
    const oldRadius = bladeRadius(game.blade.size - 1);
    const newRadius = bladeRadius(game.blade.size);

    const standingStill = 0;
    const { cutIndices } = stepGame(game, null, standingStill);
    const distances = cutIndices.map((blade) =>
      Math.hypot(game.field.positionsX[blade]! - game.blade.x, game.field.positionsZ[blade]! - game.blade.z),
    );
    expect(distances.length).toBeGreaterThan(0);
    expect(distances.every((distance) => distance > oldRadius && distance <= newRadius)).toBe(true);
  });

  it('cuts every blade exactly once when mowing the whole field in a zigzag', () => {
    const game = createGame();
    mowInZigzag(game);
    expect(game.field.cutCount).toBe(game.field.bladeCount);
    expect(game.field.cut.every((cut) => cut === 1)).toBe(true);
  });

  it('keeps the blade still and cuts nothing new when repeated with dt 0', () => {
    const game = createGame();
    stepGame(game, EAST, 0);
    const { x, z } = game.blade;
    const second = stepGame(game, EAST, 0);
    expect(game.blade.x).toBe(x);
    expect(game.blade.z).toBe(z);
    expect(second.cutIndices).toEqual([]);
    expect(second.sizesGained).toBe(0);
  });

  it('grows several sizes in one step when enough blades are cut at once', () => {
    const field = createField({ width: 2, depth: 2, bladeCount: 5000, gridCellSize: 1, seed: 1, grassType: 'green' });
    const game: Game = { field, blade: createBlade(1, 1) };
    const result = stepGame(game, null, 0);
    const reference = createBlade(0, 0);
    const expectedSizesGained = addCuts(reference, result.cutIndices.length);
    expect(expectedSizesGained).toBeGreaterThan(1);
    expect(result.sizesGained).toBe(expectedSizesGained);
    expect(game.blade.size).toBe(startSize + expectedSizesGained);
    expect(game.blade.growthProgress).toBe(reference.growthProgress);
  });

  it('cuts every blade under the blade when it is pushed into a corner', () => {
    const game = createGame();
    driveUntil(game, { x: -Math.SQRT1_2, z: -Math.SQRT1_2 }, () => game.blade.x === 0 && game.blade.z === 0);
    const atCorner = bladesWithin(game.field, 0, 0, bladeRadius(game.blade.size));
    expect(atCorner.every((blade) => game.field.cut[blade] === 1)).toBe(true);
  });
});
