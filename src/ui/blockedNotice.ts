import { config } from '../config';

export interface BlockedNotice {
  /** True in the step where «Necesitas tamaño N» should appear. */
  step(blocked: boolean, dt: number): boolean;
}

/** Shows the notice when a block starts and, while it lasts, once every blockedMessageSeconds. */
export function createBlockedNotice(): BlockedNotice {
  let secondsSinceShown: number | null = null;

  function step(blocked: boolean, dt: number): boolean {
    if (!blocked) {
      secondsSinceShown = null;
      return false;
    }
    if (secondsSinceShown === null || secondsSinceShown + dt >= config.collision.blockedMessageSeconds) {
      secondsSinceShown = 0;
      return true;
    }
    secondsSinceShown += dt;
    return false;
  }

  return { step };
}
