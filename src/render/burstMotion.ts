export interface Vector {
  x: number;
  y: number;
  z: number;
}

/** Meters per second squared pulling the burst pieces down. */
const GRAVITY = 9.8;

/** Where a piece thrown from `origin` with `velocity` is after `age` seconds; it stops where it lands. */
export function burstPiecePosition(origin: Vector, velocity: Vector, age: number): Vector {
  const flightTime = landingTime(origin.y, velocity.y);
  const t = Math.min(age, flightTime);
  const y = t === flightTime ? 0 : origin.y + velocity.y * t - (GRAVITY / 2) * t * t;
  return { x: origin.x + velocity.x * t, y, z: origin.z + velocity.z * t };
}

/** Positive root of y + vy·t − g·t²/2 = 0. */
function landingTime(height: number, verticalSpeed: number): number {
  return (verticalSpeed + Math.sqrt(verticalSpeed * verticalSpeed + 2 * GRAVITY * height)) / GRAVITY;
}
