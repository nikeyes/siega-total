import type { MusicStyle } from './lofi';

export type Screen = 'home' | 'playing' | 'paused' | 'result' | 'shop' | 'settings';

/** The game style while a level is on screen, paused or not; the calmer menu style everywhere else, the result included. */
export function musicStyleFor(screen: Screen): MusicStyle {
  return screen === 'playing' || screen === 'paused' ? 'game' : 'menu';
}
