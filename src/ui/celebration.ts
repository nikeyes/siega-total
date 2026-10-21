import { config } from '../config';
import { createRandom } from '../logic/random';
import { coinIconSvg } from './icons';

export interface CelebrationPiece {
  kind: 'confetti' | 'coin';
  /** Horizontal start, 0–100 % of the width. */
  leftPercent: number;
  delaySeconds: number;
  fallSeconds: number;
  /** Sideways drift while falling, in % of the width. */
  driftPercent: number;
  spinDegrees: number;
  /** Confetti color; coins use the coin icon. */
  color: string;
}

/** Saturated colors that read over the field: the green, wheat and lavender grass, the coin yellow and a red. */
const CONFETTI_COLORS = ['#8fe03a', '#f5d76e', '#9b6dd6', '#ffd23f', '#e53935'] as const;
const COIN_COLOR = '#ffd23f';
/** The slowest a piece crosses the screen; the rest take up to the end of the celebration. */
const MIN_FALL_SECONDS = 1.2;
const MAX_DRIFT_PERCENT = 10;
const MAX_SPIN_DEGREES = 720;

/** The pieces of one celebration, the same for the same seed. */
export function celebrationPieces(seed: number): CelebrationPiece[] {
  const random = createRandom(seed);
  const between = (min: number, max: number) => min + random() * (max - min);
  const { confettiPieces, coinRainPieces, celebrationSeconds } = config.effects;
  // Pieces start in the first half, so all of them are falling during the celebration and have landed one second after it.
  const lastDelay = celebrationSeconds / 2;
  const longestFall = celebrationSeconds + 1 - lastDelay;
  const piece = (kind: CelebrationPiece['kind']): CelebrationPiece => ({
    kind,
    leftPercent: between(0, 100),
    delaySeconds: between(0, lastDelay),
    fallSeconds: between(Math.min(MIN_FALL_SECONDS, longestFall), longestFall),
    driftPercent: between(-MAX_DRIFT_PERCENT, MAX_DRIFT_PERCENT),
    spinDegrees: between(-MAX_SPIN_DEGREES, MAX_SPIN_DEGREES),
    color: kind === 'coin' ? COIN_COLOR : CONFETTI_COLORS[Math.floor(random() * CONFETTI_COLORS.length)]!,
  });
  return [
    ...Array.from({ length: confettiPieces }, () => piece('confetti')),
    ...Array.from({ length: coinRainPieces }, () => piece('coin')),
  ];
}

export interface Celebration {
  /** Drops the pieces over the screen; they remove themselves when they land. */
  play(seed: number): void;
  clear(): void;
}

/** Confetti and coins falling over the whole screen, above the layers but letting every touch through to their buttons. */
export function createCelebration(container: HTMLElement): Celebration {
  const overlay = document.createElement('div');
  overlay.className = 'celebration';
  container.append(overlay);
  let clearTimer: ReturnType<typeof setTimeout> | undefined;

  function clear(): void {
    clearTimeout(clearTimer);
    overlay.replaceChildren();
  }

  function play(seed: number): void {
    clear();
    overlay.append(...celebrationPieces(seed).map(pieceElement));
    clearTimer = setTimeout(clear, (config.effects.celebrationSeconds + 1) * 1000);
  }

  return { play, clear };
}

function pieceElement(piece: CelebrationPiece): HTMLElement {
  const element = document.createElement('div');
  element.className = `celebration-piece celebration-${piece.kind}`;
  element.style.setProperty('--left', `${piece.leftPercent}%`);
  element.style.setProperty('--delay', `${piece.delaySeconds}s`);
  element.style.setProperty('--fall', `${piece.fallSeconds}s`);
  element.style.setProperty('--drift', `${piece.driftPercent}vw`);
  element.style.setProperty('--spin', `${piece.spinDegrees}deg`);
  element.style.setProperty('--color', piece.color);
  if (piece.kind === 'coin') element.innerHTML = coinIconSvg('celebration-coin-icon');
  return element;
}
