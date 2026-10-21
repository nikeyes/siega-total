import { config } from '../config';

/** False on browsers without the Vibration API, such as Safari on iPhone. */
export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export interface Vibration {
  /** A short buzz, when enabled and supported. */
  pulse(): void;
  setEnabled(enabled: boolean): void;
}

/** `onPulsed` hears every pulse actually sent out. */
export function createVibration(onPulsed?: () => void): Vibration {
  let enabled = true;
  return {
    pulse() {
      if (!enabled || !canVibrate()) return;
      // False when the browser refuses it, for example before the first tap on the page.
      if (navigator.vibrate(config.vibration.milliseconds)) onPulsed?.();
    },
    setEnabled(next) {
      enabled = next;
    },
  };
}
