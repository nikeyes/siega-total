import { config } from '../config';
import { targetDistance } from './camera';

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

/** The camera comes closer to a smaller blade, so it goes slower to cross the screen as fast as one of fullSpeedSize, and with speedFollowsCameraWhenBigger a bigger one goes faster. */
export function maxSpeedAt(size: number): number {
  const { maxSpeed, fullSpeedSize, speedFollowsCameraWhenBigger } = config.blade;
  if (size >= fullSpeedSize && !speedFollowsCameraWhenBigger) return maxSpeed;
  return (maxSpeed * targetDistance(size)) / targetDistance(fullSpeedSize);
}

/** A smaller blade turns more gently, so a small move of the finger does not swing it around. */
export function turnSmoothingSecondsAt(size: number): number {
  const { turnSmoothingSeconds, smallBladeTurnSmoothingSeconds, fullSpeedSize } = config.blade;
  if (size >= fullSpeedSize) return turnSmoothingSeconds;
  const towardFullSpeedSize = (size - 1) / (fullSpeedSize - 1);
  return smallBladeTurnSmoothingSeconds + (turnSmoothingSeconds - smallBladeTurnSmoothingSeconds) * towardFullSpeedSize;
}

/** Braking always takes `brakeSeconds`, so a faster blade brakes harder. A direction shorter than 1 is a joystick pushed part of the way, and the blade goes that share of full speed. */
export function moveBlade(
  blade: Blade,
  direction: Direction | null,
  dt: number,
  width: number,
  depth: number,
  maxSpeed = maxSpeedAt(blade.size),
): void {
  if (direction) {
    const targetHeading = Math.atan2(direction.z, direction.x);
    blade.heading = blade.speed === 0 ? targetHeading : turnToward(blade.heading, targetHeading, dt, turnSmoothingSecondsAt(blade.size));
    blade.speed = maxSpeed * Math.min(1, Math.hypot(direction.x, direction.z));
  } else {
    const deceleration = maxSpeed / config.blade.brakeSeconds;
    const brakedSpeed = blade.speed - deceleration * dt;
    blade.speed = brakedSpeed > STOPPED_SPEED_TOLERANCE ? brakedSpeed : 0;
  }
  // Each axis is clamped on its own, so the blade slides along the edge of the island.
  const shore = config.field.shoreMeters;
  blade.x = clamp(blade.x + Math.cos(blade.heading) * blade.speed * dt, -shore, width + shore);
  blade.z = clamp(blade.z + Math.sin(blade.heading) * blade.speed * dt, -shore, depth + shore);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Exponential smoothing along the shortest arc, independent of the frame rate. */
function turnToward(heading: number, targetHeading: number, dt: number, smoothingSeconds: number): number {
  const factor = 1 - Math.exp(-dt / smoothingSeconds);
  return heading + shortestAngle(heading, targetHeading) * factor;
}

/** Signed angle in [-PI, PI) that turns `from` into `to`. */
function shortestAngle(from: number, to: number): number {
  const fullTurn = 2 * Math.PI;
  const difference = (((to - from) % fullTurn) + fullTurn) % fullTurn;
  return difference >= Math.PI ? difference - fullTurn : difference;
}
