import { GRASS_TYPE_ORDER, type GrassType } from './field';

/** The grass type with the most cells; ties go to the first in GRASS_TYPE_ORDER, and a field with no grass is green. */
export function dominantGrassType(cells: readonly (GrassType | null)[]): GrassType {
  const counts = new Map<GrassType, number>();
  for (const cell of cells) {
    if (cell !== null) counts.set(cell, (counts.get(cell) ?? 0) + 1);
  }
  let dominant: GrassType = 'green';
  let dominantCount = 0;
  for (const type of GRASS_TYPE_ORDER) {
    const count = counts.get(type) ?? 0;
    if (count > dominantCount) {
      dominant = type;
      dominantCount = count;
    }
  }
  return dominant;
}
