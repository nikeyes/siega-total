import { describe, expect, it } from 'vitest';
import { createField, GRASS_TYPE_ORDER, type Field, type GrassType } from '../../src/logic/field';
import { changedInstanceRanges, layoutGrass } from '../../src/render/grassLayout';

/** 3 × 1 cells of 1 m: wheat, green and wheat; ice, lavender and bramble are absent. */
function wheatAndGreenField() {
  const cells: GrassType[] = ['wheat', 'green', 'wheat'];
  return createField({ width: 3, depth: 1, cellSize: 1, cells, bladeCount: 30, gridCellSize: 1, seed: 1 });
}

/** The field's blades of `type`, in field order. */
function bladesOfType(field: Field, type: GrassType): number[] {
  return [...field.types.keys()].filter((blade) => field.types[blade] === GRASS_TYPE_ORDER.indexOf(type));
}

describe('layoutGrass', () => {
  it('makes one layer per grass type in the field, in GRASS_TYPE_ORDER', () => {
    const layout = layoutGrass(wheatAndGreenField());
    expect(layout.layers.map((layer) => GRASS_TYPE_ORDER[layer.type])).toEqual(['green', 'wheat']);
  });

  it('draws in each layer the blades of its type, in field order, so nearby cuts touch nearby instances', () => {
    const field = wheatAndGreenField();
    const { layers } = layoutGrass(field);
    const [green, wheat] = layers;
    expect([...green!.blades]).toEqual(bladesOfType(field, 'green'));
    expect([...wheat!.blades]).toEqual(bladesOfType(field, 'wheat'));
  });

  it('finds the layer and instance that draw each blade', () => {
    const field = wheatAndGreenField();
    const layout = layoutGrass(field);
    for (let blade = 0; blade < field.bladeCount; blade++) {
      const layer = layout.layers[layout.layerOf[blade]!]!;
      expect(layer.blades[layout.instanceOf[blade]!], `blade ${blade}`).toBe(blade);
    }
  });

  it('makes a single layer drawing the blades in field order when the field has one grass type', () => {
    const field = createField({ width: 2, depth: 1, cellSize: 1, cells: ['ice', 'ice'], bladeCount: 10, gridCellSize: 1, seed: 1 });
    const layout = layoutGrass(field);
    expect(layout.layers).toHaveLength(1);
    expect([...layout.instanceOf]).toEqual([...field.types.keys()]);
  });

  it('makes no layers for a field without blades', () => {
    const field = createField({ width: 1, depth: 1, cellSize: 1, cells: ['green'], bladeCount: 0, gridCellSize: 1, seed: 1 });
    expect(layoutGrass(field).layers).toEqual([]);
  });
});

describe('changedInstanceRanges', () => {
  it('spans from the lowest to the highest instance of the cut blades in their layer, and leaves the other layer out', () => {
    const field = wheatAndGreenField();
    const layout = layoutGrass(field);
    const wheat = bladesOfType(field, 'wheat');
    const cut = [wheat[5]!, wheat[2]!, wheat[8]!];
    const [greenRange, wheatRange] = changedInstanceRanges(layout, cut);
    expect(greenRange).toBeNull();
    expect(wheatRange).toEqual({ first: layout.instanceOf[wheat[2]!], last: layout.instanceOf[wheat[8]!] });
  });

  it('gives each layer its own range of instances when blades of several types are cut', () => {
    const field = wheatAndGreenField();
    const layout = layoutGrass(field);
    const green = bladesOfType(field, 'green');
    const wheat = bladesOfType(field, 'wheat');
    const ranges = changedInstanceRanges(layout, [green[3]!, wheat[1]!, green[0]!, wheat[4]!]);
    expect(ranges).toEqual([
      { first: 0, last: 3 },
      { first: 1, last: 4 },
    ]);
  });

  it('changes no layer when no blade is cut', () => {
    const layout = layoutGrass(wheatAndGreenField());
    expect(changedInstanceRanges(layout, [])).toEqual([null, null]);
  });
});
