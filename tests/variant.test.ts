import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { saveKeyFor, variant, withChanges } from '../src/variant';

describe('variant', () => {
  it('is the game everyone plays when the build does not ask for another', () => {
    expect(variant).toBe('actual');
  });

  it('plays with the base config', () => {
    expect(config.blade.maxSpeed).toBe(5);
  });
});

describe('saveKeyFor', () => {
  it('keeps the save of the game everyone plays where it always was', () => {
    expect(saveKeyFor('actual')).toBe('siega-total');
  });

  it('keeps the new variant in a save of its own, so trying it does not touch the other', () => {
    expect(saveKeyFor('nueva')).not.toBe(saveKeyFor('actual'));
  });
});

describe('withChanges', () => {
  const base = { blade: { speed: 5, radius: 0.5 }, camera: { fov: 45 }, list: [1, 2] };

  it('replaces only the values the changes name, however deep', () => {
    expect(withChanges(base, { blade: { speed: 3 } })).toEqual({ blade: { speed: 3, radius: 0.5 }, camera: { fov: 45 }, list: [1, 2] });
  });

  it('replaces lists whole instead of merging them', () => {
    expect(withChanges(base, { list: [9] }).list).toEqual([9]);
  });

  it('leaves the base untouched', () => {
    withChanges(base, { blade: { speed: 3 } });
    expect(base.blade.speed).toBe(5);
  });
});
