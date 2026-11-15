/** How far, at most, the blade pushes a spike's tip away from its centre. */
export const BEND_TIP_METERS = 0.3;
/** Fully bent spikes also lose this share of their height, as if pressed down. */
export const BEND_FLATTENING = 0.35;
/** Beyond the rim, the bend fades out over this share of the blade radius. */
const REACH_PER_RADIUS = 0.8;

/** How bent, from 0 to 1, a tuft is with its root `distance` from the centre of a blade of `radius`. */
export function bendFraction(distance: number, radius: number): number {
  const reach = radius * REACH_PER_RADIUS;
  return 1 - smoothstep(radius, radius + reach, distance);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** GLSL for bendFraction: `float bendFraction(float rootDistance, float radius)`. */
export const BEND_FRACTION_GLSL = /* glsl */ `
  float bendFraction(float rootDistance, float radius) {
    return 1.0 - smoothstep(radius, radius * ${(1 + REACH_PER_RADIUS).toFixed(3)}, rootDistance);
  }
`;
