import { config } from '../config';
import type { Direction } from './blade';

/** Screen drag to field direction: `dx` maps to `x` (east), `dy` (down) maps to `z` (south). */
export function joystickDirection(originX: number, originY: number, currentX: number, currentY: number): Direction | null {
  const dx = currentX - originX;
  const dy = currentY - originY;
  const distance = Math.hypot(dx, dy);
  if (distance <= config.input.joystickDeadZonePx) return null;
  return { x: dx / distance, z: dy / distance };
}

/** `KeyboardEvent.code` values and the field direction each one pushes toward. */
const KEY_DIRECTIONS: Readonly<Record<string, Direction>> = {
  KeyW: { x: 0, z: -1 },
  ArrowUp: { x: 0, z: -1 },
  KeyS: { x: 0, z: 1 },
  ArrowDown: { x: 0, z: 1 },
  KeyA: { x: -1, z: 0 },
  ArrowLeft: { x: -1, z: 0 },
  KeyD: { x: 1, z: 0 },
  ArrowRight: { x: 1, z: 0 },
};

export function keyboardDirection(pressedKeys: ReadonlySet<string>): Direction | null {
  let x = 0;
  let z = 0;
  for (const key of pressedKeys) {
    const keyDirection = KEY_DIRECTIONS[key];
    if (!keyDirection) continue;
    x += keyDirection.x;
    z += keyDirection.z;
  }
  const length = Math.hypot(x, z);
  if (length === 0) return null;
  return { x: x / length, z: z / length };
}

/** The joystick wins over the keyboard. */
export function combineDirections(joystick: Direction | null, keyboard: Direction | null): Direction | null {
  return joystick ?? keyboard;
}
