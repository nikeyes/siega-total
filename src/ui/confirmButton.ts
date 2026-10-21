import { texts } from '../texts';

/** How long the button waits for the second press. */
export const CONFIRM_WINDOW_MS = 3000;

export interface ConfirmButtonState {
  /** 'armed' asks for a second press; 'confirmed' means go ahead. */
  press(now: number): 'armed' | 'confirmed';
  label(now: number): string;
}

/** «Borrar progreso» in two presses, without a browser dialog: the first arms it, a second within the window confirms. */
export function createConfirmButtonState(): ConfirmButtonState {
  let armedAt: number | null = null;

  function isArmed(now: number): boolean {
    return armedAt !== null && now - armedAt < CONFIRM_WINDOW_MS;
  }

  function press(now: number): 'armed' | 'confirmed' {
    if (isArmed(now)) {
      armedAt = null;
      return 'confirmed';
    }
    armedAt = now;
    return 'armed';
  }

  function label(now: number): string {
    return isArmed(now) ? texts.settings.confirmClear : texts.settings.clearProgress;
  }

  return { press, label };
}
