import { describe, expect, it } from 'vitest';
import { texts } from '../../src/texts';
import { CONFIRM_WINDOW_MS, createConfirmButtonState } from '../../src/ui/confirmButton';

const START = 10_000;

describe('confirm button', () => {
  it('arms on the first press and asks to press again', () => {
    const button = createConfirmButtonState();
    expect(button.label(START)).toBe(texts.settings.clearProgress);
    expect(button.press(START)).toBe('armed');
    expect(button.label(START)).toBe(texts.settings.confirmClear);
  });

  it('confirms on a second press within the window and goes back to its label', () => {
    const button = createConfirmButtonState();
    button.press(START);
    expect(button.press(START + CONFIRM_WINDOW_MS - 1)).toBe('confirmed');
    expect(button.label(START + CONFIRM_WINDOW_MS - 1)).toBe(texts.settings.clearProgress);
  });

  it('goes back to its label once the window has passed, and a press then only arms it again', () => {
    const button = createConfirmButtonState();
    button.press(START);
    expect(button.label(START + CONFIRM_WINDOW_MS)).toBe(texts.settings.clearProgress);
    expect(button.press(START + CONFIRM_WINDOW_MS)).toBe('armed');
  });

  it('arms again after confirming, so a third press does not clear twice', () => {
    const button = createConfirmButtonState();
    button.press(START);
    button.press(START + 1);
    expect(button.press(START + 2)).toBe('armed');
  });

  it('keeps asking until the very end of the window', () => {
    const button = createConfirmButtonState();
    button.press(START);
    expect(button.label(START + CONFIRM_WINDOW_MS - 1)).toBe(texts.settings.confirmClear);
  });
});
