import { config } from '../config';

const { direction, swayMeters, speed, waveNumber, phaseJitter } = config.world.wind;
const directionLength = Math.hypot(direction.x, direction.z);
/** Unit vector (x, z) the wind blows towards. */
export const WIND_DIRECTION = { x: direction.x / directionLength, z: direction.z / directionLength };

const HASH_X = 12.9898;
const HASH_Z = 78.233;
const HASH_SCALE = 43758.5453;

/** How far a blade's tip leans downwind, from 0 to config.world.wind.swayMeters, before height scaling. */
export function windLean(rootX: number, rootZ: number, time: number): number {
  const downwindDistance = rootX * WIND_DIRECTION.x + rootZ * WIND_DIRECTION.z;
  const phase = time * speed - downwindDistance * waveNumber + (bladePhaseJitter(rootX, rootZ) * 2 - 1) * phaseJitter;
  return swayMeters * (0.5 + 0.5 * Math.sin(phase));
}

/** The same 0–1 jitter the shader uses for each blade, from its root. */
export function bladePhaseJitter(rootX: number, rootZ: number): number {
  const hash = Math.sin(rootX * HASH_X + rootZ * HASH_Z) * HASH_SCALE;
  return hash - Math.floor(hash);
}

/** GLSL for windLean: `float windLean(vec2 root, float time)`, with `root` as (x, z). */
export const WIND_LEAN_GLSL = /* glsl */ `
  float windLean(vec2 root, float time) {
    vec2 windDirection = vec2(${WIND_DIRECTION.x.toFixed(6)}, ${WIND_DIRECTION.z.toFixed(6)});
    float jitter = fract(sin(dot(root, vec2(${HASH_X}, ${HASH_Z}))) * ${HASH_SCALE});
    float phase = time * ${speed.toFixed(3)} - dot(root, windDirection) * ${waveNumber.toFixed(3)}
      + (jitter * 2.0 - 1.0) * ${phaseJitter.toFixed(3)};
    return ${swayMeters.toFixed(3)} * (0.5 + 0.5 * sin(phase));
  }
`;
