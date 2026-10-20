import type { Direction } from '../logic/blade';
import { keyboardDirection } from '../logic/input';

export interface Keyboard {
  getDirection(): Direction | null;
}

/** Tracks pressed keys by `KeyboardEvent.code`. Losing focus releases them all. */
export function createKeyboard(): Keyboard {
  const pressedKeys = new Set<string>();
  window.addEventListener('keydown', (event) => pressedKeys.add(event.code));
  window.addEventListener('keyup', (event) => pressedKeys.delete(event.code));
  window.addEventListener('blur', () => pressedKeys.clear());
  return { getDirection: () => keyboardDirection(pressedKeys) };
}
