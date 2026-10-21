import { bladeRadius } from '../logic/blade';

/** The arrow sits this far beyond the edge of the blade, so it never covers it. */
export const COMPASS_GAP_METERS = 0.6;

export interface CompassPlacement {
  x: number;
  z: number;
  /** Radians on the field plane; 0 = +x (east), like the blade's heading. */
  angle: number;
}

/** Where the arrow goes and where it points: just outside the blade, toward `target`. */
export function compassPlacement(blade: { x: number; z: number; size: number }, target: { x: number; z: number }): CompassPlacement {
  const angle = Math.atan2(target.z - blade.z, target.x - blade.x);
  const distance = bladeRadius(blade.size) + COMPASS_GAP_METERS;
  return { x: blade.x + Math.cos(angle) * distance, z: blade.z + Math.sin(angle) * distance, angle };
}
