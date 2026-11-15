import { describe, expect, it } from 'vitest';
import { variant } from '../../src/variant';

describe('the nueva build', () => {
  it('is the new variant', () => {
    expect(variant).toBe('nueva');
  });
});
