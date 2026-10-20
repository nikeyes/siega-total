import type { Field } from '../logic/field';

export interface GrassLayer {
  /** Index into GRASS_TYPE_ORDER. */
  readonly type: number;
  /** The field blade drawn by each instance of this layer. */
  readonly blades: Int32Array;
}

export interface GrassLayout {
  readonly layers: readonly GrassLayer[];
  /** The layer that draws each field blade. */
  readonly layerOf: Int32Array;
  /** The instance that draws each field blade, within its layer. */
  readonly instanceOf: Int32Array;
}

/** One layer per grass type present in the field, so each type is drawn with its own colors. */
export function layoutGrass(field: Field): GrassLayout {
  const layerOfType = new Int32Array(field.countByType.length).fill(-1);
  const layers: GrassLayer[] = [];
  field.countByType.forEach((count, type) => {
    if (count === 0) return;
    layerOfType[type] = layers.length;
    layers.push({ type, blades: new Int32Array(count) });
  });

  const layerOf = new Int32Array(field.bladeCount);
  const instanceOf = new Int32Array(field.bladeCount);
  const instancesPlaced = new Int32Array(layers.length);
  for (let blade = 0; blade < field.bladeCount; blade++) {
    const layer = layerOfType[field.types[blade]!]!;
    const instance = instancesPlaced[layer]!++;
    layers[layer]!.blades[instance] = blade;
    layerOf[blade] = layer;
    instanceOf[blade] = instance;
  }
  return { layers, layerOf, instanceOf };
}

export interface InstanceRange {
  readonly first: number;
  readonly last: number;
}

/** For each layer, the range of instances that draw the given blades, or null when none of them is in that layer. */
export function changedInstanceRanges(layout: GrassLayout, blades: readonly number[]): (InstanceRange | null)[] {
  const ranges: (InstanceRange | null)[] = layout.layers.map(() => null);
  for (const blade of blades) {
    const layer = layout.layerOf[blade]!;
    const instance = layout.instanceOf[blade]!;
    const range = ranges[layer];
    ranges[layer] = range
      ? { first: Math.min(range.first, instance), last: Math.max(range.last, instance) }
      : { first: instance, last: instance };
  }
  return ranges;
}
