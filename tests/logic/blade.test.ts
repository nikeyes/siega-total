import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { createRandom } from '../../src/logic/random';
import {
  addCuts,
  bladeRadius,
  createBlade,
  cutsToNextSize,
  moveBlade,
  type Blade,
  type Direction,
} from '../../src/logic/blade';

const { startSize, maxSpeed, brakeSeconds, turnSmoothingSeconds, cutsPerSizeFactor } = config.blade;
const { width, depth } = config.field;

const EAST: Direction = { x: 1, z: 0 };
const WEST: Direction = { x: -1, z: 0 };
const NORTH: Direction = { x: 0, z: -1 };
const SOUTH: Direction = { x: 0, z: 1 };
const NORTHEAST: Direction = { x: Math.SQRT1_2, z: -Math.SQRT1_2 };
const WEST_HEADING = Math.PI;
const FULL_TURN = 2 * Math.PI;
const SIXTY_FPS_FRAME = 1 / 60;

/** Smallest absolute angle between two headings, in radians. */
function angleBetween(first: number, second: number) {
  const difference = Math.abs(first - second) % FULL_TURN;
  return Math.min(difference, FULL_TURN - difference);
}

function directionAt(angle: number): Direction {
  return { x: Math.cos(angle), z: Math.sin(angle) };
}

/** Moves the blade on the configured field. */
function move(blade: Blade, direction: Direction | null, dt: number) {
  moveBlade(blade, direction, dt, width, depth);
}

function bladeAtFieldCenter() {
  return createBlade(width / 2, depth / 2);
}

function bladeMovingEastAtFullSpeed() {
  const blade = bladeAtFieldCenter();
  move(blade, EAST, 0.1);
  return blade;
}

function isInsideField(blade: Blade) {
  return blade.x >= 0 && blade.x <= width && blade.z >= 0 && blade.z <= depth;
}

describe('addCuts', () => {
  it('grows one size only when the cuts reach the threshold', () => {
    const blade = createBlade(0, 0);
    addCuts(blade, cutsToNextSize(startSize) - 1);
    expect(blade.size).toBe(startSize);
    addCuts(blade, 1);
    expect(blade.size).toBe(startSize + 1);
  });

  it('needs cutsPerSizeFactor times the current size per size, gaining several sizes and keeping the remainder', () => {
    const blade = createBlade(0, 0);
    const remainder = 50;
    const sizesGained = addCuts(blade, cutsPerSizeFactor * startSize + cutsPerSizeFactor * (startSize + 1) + remainder);
    expect(sizesGained).toBe(2);
    expect(blade.size).toBe(startSize + 2);
    expect(blade.growthProgress).toBe(remainder);
  });

  it('leaves no progress when the cuts land exactly on a threshold', () => {
    const blade = createBlade(0, 0);
    expect(addCuts(blade, cutsToNextSize(startSize) + cutsToNextSize(startSize + 1))).toBe(2);
    expect(blade.growthProgress).toBe(0);
  });

  it('changes nothing with zero cuts', () => {
    const blade = createBlade(0, 0);
    expect(addCuts(blade, 0)).toBe(0);
    expect(blade.size).toBe(startSize);
    expect(blade.growthProgress).toBe(0);
  });

  it('ends in the same state with a million cuts at once as with the same cuts in small batches', () => {
    const bulkBlade = createBlade(0, 0);
    const batchedBlade = createBlade(0, 0);
    const total = 1_000_000;
    const batch = 997;
    const sizesGained = addCuts(bulkBlade, total);
    for (let added = 0; added < total; added += batch) {
      addCuts(batchedBlade, Math.min(batch, total - added));
    }
    expect(bulkBlade.size).toBe(batchedBlade.size);
    expect(bulkBlade.growthProgress).toBe(batchedBlade.growthProgress);
    expect(sizesGained).toBe(bulkBlade.size - startSize);
    expect(bulkBlade.growthProgress).toBeLessThan(cutsToNextSize(bulkBlade.size));
  });
});

describe('bladeRadius', () => {
  it('starts at baseRadius and grows by radiusPerSize with each size', () => {
    expect(bladeRadius(startSize)).toBe(config.blade.baseRadius);
    for (let size = startSize; size < startSize + 4; size++) {
      expect(bladeRadius(size + 1) - bladeRadius(size)).toBeCloseTo(config.blade.radiusPerSize);
    }
  });
});

describe('moveBlade: speed', () => {
  it('moves maxSpeed * dt east in the first step from a stop', () => {
    const blade = bladeAtFieldCenter();
    const dt = 0.1;
    move(blade, EAST, dt);
    expect(blade.x).toBeCloseTo(width / 2 + maxSpeed * dt);
    expect(blade.z).toBeCloseTo(depth / 2);
  });

  it('moves at the same speed at size 5 as at size 1', () => {
    const smallBlade = bladeAtFieldCenter();
    const bigBlade = bladeAtFieldCenter();
    const bigSize = 5;
    for (let size = startSize; size < bigSize; size++) {
      addCuts(bigBlade, cutsToNextSize(size));
    }
    expect(bigBlade.size).toBe(bigSize);
    move(smallBlade, EAST, 0.1);
    move(bigBlade, EAST, 0.1);
    expect(bigBlade.speed).toBe(smallBlade.speed);
    expect(bigBlade.x).toBe(smallBlade.x);
  });

  it('does not move, turn or brake with dt = 0', () => {
    const blade = bladeMovingEastAtFullSpeed();
    const before = { ...blade };
    move(blade, null, 0);
    expect(blade).toEqual(before);
    move(blade, NORTH, 0);
    expect(blade.x).toBe(before.x);
    expect(blade.z).toBe(before.z);
    expect(blade.heading).toBe(before.heading);
  });
});

describe('moveBlade: braking', () => {
  it('stops after brakeSeconds without a direction and never moves backward', () => {
    const blade = bladeMovingEastAtFullSpeed();
    const steps = 10;
    const dt = brakeSeconds / steps;
    let previousX = blade.x;
    for (let step = 0; step < steps; step++) {
      move(blade, null, dt);
      expect(blade.x).toBeGreaterThanOrEqual(previousX);
      previousX = blade.x;
    }
    expect(blade.speed).toBe(0);
    move(blade, null, dt);
    expect(blade.speed).toBe(0);
    expect(blade.x).toBe(previousX);
  });

  it('brakes linearly: half of brakeSeconds in two steps leaves half of maxSpeed', () => {
    const blade = bladeMovingEastAtFullSpeed();
    move(blade, null, brakeSeconds / 4);
    move(blade, null, brakeSeconds / 4);
    expect(blade.speed).toBeCloseTo(maxSpeed / 2, 10);
  });

  it('keeps braking linearly until the end: 99% of brakeSeconds leaves 1% of maxSpeed', () => {
    const blade = bladeMovingEastAtFullSpeed();
    move(blade, null, brakeSeconds * 0.99);
    expect(blade.speed).toBeCloseTo(maxSpeed * 0.01, 10);
  });

  it('counts as stopped after exactly brakeSeconds of 60 fps frames', () => {
    const blade = bladeMovingEastAtFullSpeed();
    const frames = Math.round(brakeSeconds / SIXTY_FPS_FRAME);
    for (let frame = 0; frame < frames; frame++) move(blade, null, SIXTY_FPS_FRAME);
    expect(blade.speed).toBe(0);
  });

  it('counts as stopped after exactly brakeSeconds of uneven frames', () => {
    const blade = bladeMovingEastAtFullSpeed();
    const frames = [0.016, 0.017, 0.016, 0.017, 0.016, 0.017, 0.016, 0.017, 0.018];
    expect(frames.reduce((sum, dt) => sum + dt, 0)).toBeCloseTo(brakeSeconds, 12);
    for (const dt of frames) move(blade, null, dt);
    expect(blade.speed).toBe(0);
  });

  it('returns to full speed instantly when a direction returns mid-brake', () => {
    const blade = bladeMovingEastAtFullSpeed();
    move(blade, null, brakeSeconds / 2);
    move(blade, EAST, 0.01);
    expect(blade.speed).toBe(maxSpeed);
  });
});

describe('moveBlade: turning', () => {
  it('snaps a new blade to the first direction instead of turning toward it', () => {
    const blade = bladeAtFieldCenter();
    move(blade, WEST, 0.01);
    expect(angleBetween(blade.heading, WEST_HEADING)).toBeCloseTo(0, 10);
  });

  it('snaps a braked-to-a-stop blade to the new direction, ignoring its old heading', () => {
    const blade = bladeMovingEastAtFullSpeed();
    move(blade, null, brakeSeconds);
    expect(blade.speed).toBe(0);
    move(blade, WEST, 0.01);
    expect(angleBetween(blade.heading, WEST_HEADING)).toBeCloseTo(0, 10);
  });

  it('turns 180 degrees gradually and is within 1% of the turn after 5 * turnSmoothingSeconds', () => {
    const blade = bladeMovingEastAtFullSpeed();
    const shortStep = 0.01;
    move(blade, WEST, shortStep);
    expect(angleBetween(blade.heading, WEST_HEADING)).toBeGreaterThan(Math.PI / 2);

    const steps = 100;
    const remainingTime = 5 * turnSmoothingSeconds - shortStep;
    for (let step = 0; step < steps; step++) move(blade, WEST, remainingTime / steps);
    expect(angleBetween(blade.heading, WEST_HEADING)).toBeLessThan(0.01 * Math.PI);
  });

  it('turns by the same amount with one 0.1 s step as with ten 0.01 s steps', () => {
    const oneStepBlade = bladeMovingEastAtFullSpeed();
    const tenStepsBlade = bladeMovingEastAtFullSpeed();
    move(oneStepBlade, NORTH, 0.1);
    for (let step = 0; step < 10; step++) move(tenStepsBlade, NORTH, 0.01);
    expect(tenStepsBlade.heading).toBeCloseTo(oneStepBlade.heading, 10);
  });

  describe('takes the shortest arc across the +-PI seam', () => {
    const almostWestFromNorthSide = directionAt(Math.PI - 0.1);
    const almostWestFromSouthSide = directionAt(-Math.PI + 0.1);

    it('turning from just below PI to just above -PI turns slightly positive', () => {
      const blade = bladeAtFieldCenter();
      move(blade, almostWestFromNorthSide, 0.1);
      const start = blade.heading;
      move(blade, almostWestFromSouthSide, 0.01);
      const turned = blade.heading - start;
      expect(turned).toBeGreaterThan(0);
      expect(turned).toBeLessThan(0.2);
    });

    it('turning from just above -PI to just below PI turns slightly negative', () => {
      const blade = bladeAtFieldCenter();
      move(blade, almostWestFromSouthSide, 0.1);
      const start = blade.heading;
      move(blade, almostWestFromNorthSide, 0.01);
      const turned = blade.heading - start;
      expect(turned).toBeLessThan(0);
      expect(turned).toBeGreaterThan(-0.2);
    });
  });

  it('turns the same with a heading wound up by thousands of circles as with the equivalent wrapped heading', () => {
    const someAngle = 2;
    const woundUpBlade = { ...bladeAtFieldCenter(), speed: maxSpeed, heading: someAngle + 5000 * FULL_TURN };
    const wrappedBlade = { ...bladeAtFieldCenter(), speed: maxSpeed, heading: someAngle };
    move(woundUpBlade, NORTH, SIXTY_FPS_FRAME);
    move(wrappedBlade, NORTH, SIXTY_FPS_FRAME);
    expect(angleBetween(woundUpBlade.heading, wrappedBlade.heading)).toBeLessThan(1e-9);
  });
});

describe('moveBlade: field edges', () => {
  it('slides along the east edge when moving northeast into it', () => {
    const blade = createBlade(width - 0.1, depth / 2);
    move(blade, NORTHEAST, 0.1);
    const zAtEdge = blade.z;
    move(blade, NORTHEAST, 0.1);
    expect(blade.x).toBe(width);
    expect(blade.z).toBeLessThan(zAtEdge);
  });

  it('stops dead at a corner without leaving the field', () => {
    const blade = createBlade(width, 0);
    move(blade, NORTHEAST, 1);
    expect(blade.x).toBe(width);
    expect(blade.z).toBe(0);
  });

  it('stays inside the field with a huge dt (tab returning from background)', () => {
    const blade = bladeAtFieldCenter();
    move(blade, NORTHEAST, 0.1);
    move(blade, WEST, 30);
    expect(blade.x).toBe(0);
    expect(angleBetween(blade.heading, WEST_HEADING)).toBeLessThan(1e-9);
  });

  it('stops at the east edge of a field narrower than it is deep', () => {
    const narrowWidth = 10;
    const deepDepth = 20;
    const blade = createBlade(narrowWidth - 0.1, deepDepth / 2);
    moveBlade(blade, EAST, 1, narrowWidth, deepDepth);
    expect(blade.x).toBe(narrowWidth);
  });

  it('stops at the south edge of a field deeper than it is wide', () => {
    const narrowWidth = 10;
    const deepDepth = 20;
    const blade = createBlade(narrowWidth / 2, deepDepth - 0.1);
    moveBlade(blade, SOUTH, 1, narrowWidth, deepDepth);
    expect(blade.z).toBe(deepDepth);
  });

  it('never leaves the field during a long seeded random drive', () => {
    const random = createRandom(config.field.seed);
    const blade = bladeAtFieldCenter();
    let firstPositionOutside: { x: number; z: number } | undefined;
    for (let run = 0; run < 50 && !firstPositionOutside; run++) {
      const angle = random() * FULL_TURN;
      const direction = random() < 0.2 ? null : directionAt(angle);
      for (let step = 0; step < 100; step++) {
        move(blade, direction, random() * 0.05);
        if (!isInsideField(blade)) {
          firstPositionOutside = { x: blade.x, z: blade.z };
          break;
        }
      }
    }
    expect(firstPositionOutside).toBeUndefined();
  });
});
