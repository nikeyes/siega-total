import { config } from '../config';

/** Unit vector on the field plane. */
export interface Direction {
  x: number;
  z: number;
}

export interface Blade {
  x: number;
  z: number;
  /** Radians; 0 = +x (east). */
  heading: number;
  /** Meters per second. */
  speed: number;
  size: number;
  /** Blades cut toward the next size. */
  growthProgress: number;
}

/** Speeds below this are floating-point leftovers from braking, so the blade counts as stopped. */
const STOPPED_SPEED_TOLERANCE = 1e-9;

export function createBlade(x: number, z: number, size = config.blade.startSize): Blade {
  return { x, z, heading: 0, speed: 0, size, growthProgress: 0 };
}

export function bladeRadius(size: number): number {
  return config.blade.baseRadius + config.blade.radiusPerSize * (size - 1);
}

export function cutsToNextSize(size: number): number {
  return config.blade.cutsPerSizeFactor * size;
}

/** How far the blade is toward its next size, from 0 to 1. */
export function growthFraction(blade: Blade): number {
  return blade.growthProgress / cutsToNextSize(blade.size);
}

export function addCuts(blade: Blade, count: number): number {
  blade.growthProgress += count;
  let sizesGained = 0;
  while (blade.growthProgress >= cutsToNextSize(blade.size)) {
    blade.growthProgress -= cutsToNextSize(blade.size);
    blade.size++;
    sizesGained++;
  }
  return sizesGained;
}

/** Braking always takes `brakeSeconds`, so a faster blade brakes harder. */
export function moveBlade(
  blade: Blade,
  direction: Direction | null,
  dt: number,
  width: number,
  depth: number,
  maxSpeed = config.blade.maxSpeed,
): void {
  if (direction) {
    const targetHeading = Math.atan2(direction.z, direction.x);
    blade.heading = blade.speed === 0 ? targetHeading : turnToward(blade.heading, targetHeading, dt);
    blade.speed = maxSpeed;
  } else {
    const deceleration = maxSpeed / config.blade.brakeSeconds;
    const brakedSpeed = blade.speed - deceleration * dt;
    blade.speed = brakedSpeed > STOPPED_SPEED_TOLERANCE ? brakedSpeed : 0;
  }
  // Each axis is clamped on its own, so the blade slides along the edge.
  blade.x = clamp(blade.x + Math.cos(blade.heading) * blade.speed * dt, 0, width);
  blade.z = clamp(blade.z + Math.sin(blade.heading) * blade.speed * dt, 0, depth);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Exponential smoothing along the shortest arc, independent of the frame rate. */
function turnToward(heading: number, targetHeading: number, dt: number): number {
  const factor = 1 - Math.exp(-dt / config.blade.turnSmoothingSeconds);
  return heading + shortestAngle(heading, targetHeading) * factor;
}

/** Signed angle in [-PI, PI) that turns `from` into `to`. */
function shortestAngle(from: number, to: number): number {
  const fullTurn = 2 * Math.PI;
  const difference = (((to - from) % fullTurn) + fullTurn) % fullTurn;
  return difference >= Math.PI ? difference - fullTurn : difference;
}
