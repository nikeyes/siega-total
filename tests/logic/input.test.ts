import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import type { Direction } from '../../src/logic/blade';
import { combineDirections, joystickDirection, keyboardDirection } from '../../src/logic/input';

const { joystickDeadZonePx } = config.input;
const ORIGIN_X = 200;
const ORIGIN_Y = 300;
const NORTH: Direction = { x: 0, z: -1 };
const SOUTH: Direction = { x: 0, z: 1 };
const EAST: Direction = { x: 1, z: 0 };
const WEST: Direction = { x: -1, z: 0 };

function length(direction: Direction | null) {
  return direction ? Math.hypot(direction.x, direction.z) : 0;
}

function dragBy(dx: number, dy: number) {
  return joystickDirection(ORIGIN_X, ORIGIN_Y, ORIGIN_X + dx, ORIGIN_Y + dy);
}

describe('joystickDirection', () => {
  it('returns null without a drag', () => {
    expect(dragBy(0, 0)).toBeNull();
  });

  it('ignores a drag of exactly the dead zone and steers with one pixel more', () => {
    expect(dragBy(joystickDeadZonePx, 0)).toBeNull();
    expect(dragBy(joystickDeadZonePx + 1, 0)).toEqual(EAST);
  });

  it('ignores a diagonal drag exactly on the dead zone (3-4-5 triangle)', () => {
    expect(dragBy((-joystickDeadZonePx * 3) / 5, (-joystickDeadZonePx * 4) / 5)).toBeNull();
  });

  it.each([
    ['right', 50, 0, EAST],
    ['down', 0, 50, SOUTH],
    ['up', 0, -50, NORTH],
    ['left', -50, 0, WEST],
  ])('maps a drag %s to the matching field direction', (_name, dx, dy, expected) => {
    expect(dragBy(dx, dy)).toEqual(expected);
  });

  it.each([joystickDeadZonePx + 1, 40, 500])('returns a unit direction %s px from the origin', (distance) => {
    const angle = 2.5;
    const direction = dragBy(Math.cos(angle) * distance, Math.sin(angle) * distance);
    expect(length(direction)).toBeCloseTo(1, 12);
  });
});

describe('keyboardDirection', () => {
  it('returns null with no keys pressed', () => {
    expect(keyboardDirection(new Set())).toBeNull();
  });

  it('maps W to north and ArrowRight to east', () => {
    expect(keyboardDirection(new Set(['KeyW']))).toEqual(NORTH);
    expect(keyboardDirection(new Set(['ArrowRight']))).toEqual(EAST);
  });

  it('normalizes W + D to a northeast diagonal of length 1', () => {
    const direction = keyboardDirection(new Set(['KeyW', 'KeyD']));
    expect(direction?.x).toBeCloseTo(Math.SQRT1_2, 12);
    expect(direction?.z).toBeCloseTo(-Math.SQRT1_2, 12);
    expect(length(direction)).toBeCloseTo(1, 12);
  });

  it('treats W and ArrowUp together as plain north', () => {
    expect(keyboardDirection(new Set(['KeyW', 'ArrowUp']))).toEqual(NORTH);
  });

  it('cancels opposite keys: A + D gives null', () => {
    expect(keyboardDirection(new Set(['KeyA', 'KeyD']))).toBeNull();
  });

  it('keeps the uncancelled direction when three keys are pressed', () => {
    expect(keyboardDirection(new Set(['KeyW', 'KeyA', 'KeyD']))).toEqual(NORTH);
    expect(keyboardDirection(new Set(['KeyA', 'KeyS', 'KeyW']))).toEqual(WEST);
  });

  it('returns null when all four directions are pressed', () => {
    expect(keyboardDirection(new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']))).toBeNull();
    expect(keyboardDirection(new Set(['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']))).toBeNull();
  });

  it('ignores keys that do not steer', () => {
    expect(keyboardDirection(new Set(['Space']))).toBeNull();
  });

  it('still steers when a non-steering key was pressed first', () => {
    expect(keyboardDirection(new Set(['ShiftLeft', 'KeyW']))).toEqual(NORTH);
  });

  it('ignores inherited object keys such as toString', () => {
    expect(keyboardDirection(new Set(['toString', 'constructor', '__proto__']))).toBeNull();
  });
});

describe('combineDirections', () => {
  it('prefers the joystick over the keyboard when both are active', () => {
    expect(combineDirections(SOUTH, EAST)).toEqual(SOUTH);
  });

  it('falls back to the keyboard without a joystick direction', () => {
    expect(combineDirections(null, EAST)).toEqual(EAST);
    expect(combineDirections(null, null)).toBeNull();
  });
});
