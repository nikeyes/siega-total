/** Mask texels per meter of field: a blade's cut edge looks smooth at this resolution. */
export const CUT_MASK_PIXELS_PER_METER = 16;
/** Inside a sweep, the coverage fades from full to none over this last stretch before its rim. */
const RIM_SOFTNESS_METERS = 0.15;
/** Each texel holds the swept size and the coverage, both bytes. */
const CHANNELS = 2;
const MAX_BYTE = 255;

/**
 * Where the blade has swept the field, as RG bytes row by row from (0, 0):
 * R is the biggest blade size that swept the texel (255 for one that cuts everything),
 * G how fully it was covered, from 0 to 255, softened towards the rim of each sweep.
 * The grass reads it to trim each spike where the blade passed, if that blade could cut it.
 */
export interface CutMask {
  readonly columns: number;
  readonly rows: number;
  readonly data: Uint8Array;
  /** Marks the circle (x, z, radius) as swept by a blade of `size`; true when any texel changed. */
  sweep(x: number, z: number, radius: number, size: number): boolean;
}

export function createCutMask(width: number, depth: number): CutMask {
  const columns = Math.ceil(width * CUT_MASK_PIXELS_PER_METER);
  const rows = Math.ceil(depth * CUT_MASK_PIXELS_PER_METER);
  const data = new Uint8Array(columns * rows * CHANNELS);

  function sweep(x: number, z: number, radius: number, size: number): boolean {
    const sizeByte = Math.min(MAX_BYTE, Math.floor(size));
    const firstColumn = Math.max(0, Math.floor((x - radius) * CUT_MASK_PIXELS_PER_METER));
    const lastColumn = Math.min(columns - 1, Math.floor((x + radius) * CUT_MASK_PIXELS_PER_METER));
    const firstRow = Math.max(0, Math.floor((z - radius) * CUT_MASK_PIXELS_PER_METER));
    const lastRow = Math.min(rows - 1, Math.floor((z + radius) * CUT_MASK_PIXELS_PER_METER));
    let changed = false;
    for (let row = firstRow; row <= lastRow; row++) {
      const texelZ = (row + 0.5) / CUT_MASK_PIXELS_PER_METER;
      for (let column = firstColumn; column <= lastColumn; column++) {
        const texelX = (column + 0.5) / CUT_MASK_PIXELS_PER_METER;
        const distance = Math.hypot(texelX - x, texelZ - z);
        if (distance > radius) continue;
        const coverage = Math.round(MAX_BYTE * Math.min(1, (radius - distance) / RIM_SOFTNESS_METERS));
        const texel = (row * columns + column) * CHANNELS;
        if (sizeByte > data[texel]!) {
          data[texel] = sizeByte;
          changed = true;
        }
        if (coverage > data[texel + 1]!) {
          data[texel + 1] = coverage;
          changed = true;
        }
      }
    }
    return changed;
  }

  return { columns, rows, data, sweep };
}
