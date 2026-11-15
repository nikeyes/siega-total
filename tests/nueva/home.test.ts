import { describe, expect, it } from 'vitest';
import { defaultSave } from '../../src/logic/save';
import { texts } from '../../src/texts';
import { homeDisplay } from '../../src/ui/home';

describe('homeDisplay in the nueva build', () => {
  it('says it is the new variant, so it is not mistaken for the other', () => {
    expect(homeDisplay(defaultSave()).variantLabel).toBe(texts.home.nuevaVariant);
  });
});
