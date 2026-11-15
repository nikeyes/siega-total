import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { GRASS_TYPE_ORDER } from '../../src/logic/field';
import { cuttingSpeedFactor, grassCutSize } from '../../src/logic/grass';

describe('grassCutSize', () => {
  it('is the minimum size of each grass while tough grass cannot be cut early', () => {
    expect(config.toughGrass.sizesEarly).toBe(0);
    for (const type of GRASS_TYPE_ORDER) expect(grassCutSize(type)).toBe(config.grassTypes[type].minSize);
  });
});

describe('cuttingSpeedFactor', () => {
  it('never slows the blade while tough grass cannot be cut early', () => {
    for (const type of GRASS_TYPE_ORDER) {
      for (let size = 1; size <= 6; size++) expect(cuttingSpeedFactor(type, size)).toBe(1);
    }
  });
});
