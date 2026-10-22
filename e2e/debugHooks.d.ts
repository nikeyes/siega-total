import type { Game } from '../src/logic/game';

declare global {
  interface Window {
    /** With ?debug, the game being played (src/main.ts). */
    __siega: Game;
    /** With ?debug, every sound and buzz the game sent out, oldest first (src/main.ts). */
    __siegaFeedback: { kind: 'sound' | 'vibration'; name: string; rate?: number; at: number }[];
  }
}
