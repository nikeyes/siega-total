import { afterEach, describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { type CelebrationPiece, celebrationPieces } from '../../src/ui/celebration';

const SEED = 7;
const COIN_YELLOW = '#ffd23f';

const ofKind = (pieces: CelebrationPiece[], kind: CelebrationPiece['kind']) => pieces.filter((piece) => piece.kind === kind);

/** Every piece starts on screen in the first half of the celebration, drifts and spins within limits and has landed a second after the end. */
function expectEveryPieceInBounds(pieces: CelebrationPiece[]): void {
  const { celebrationSeconds } = config.effects;
  for (const piece of pieces) {
    expect(Number.isFinite(piece.leftPercent)).toBe(true);
    expect(piece.leftPercent).toBeGreaterThanOrEqual(0);
    expect(piece.leftPercent).toBeLessThanOrEqual(100);
    expect(piece.delaySeconds).toBeGreaterThanOrEqual(0);
    expect(piece.delaySeconds).toBeLessThanOrEqual(celebrationSeconds / 2);
    expect(piece.fallSeconds).toBeGreaterThan(0);
    expect(piece.delaySeconds + piece.fallSeconds).toBeLessThanOrEqual(celebrationSeconds + 1);
    expect(Math.abs(piece.driftPercent)).toBeLessThanOrEqual(10);
    expect(Math.abs(piece.spinDegrees)).toBeLessThanOrEqual(720);
  }
}

describe('celebrationPieces', () => {
  const originalEffects = { ...config.effects };
  afterEach(() => Object.assign(config.effects, originalEffects));

  describe('how many pieces drop', () => {
    it('drops the configured confetti and coins', () => {
      const pieces = celebrationPieces(SEED);
      expect(ofKind(pieces, 'confetti')).toHaveLength(config.effects.confettiPieces);
      expect(ofKind(pieces, 'coin')).toHaveLength(config.effects.coinRainPieces);
    });

    it('drops only coins when there is no confetti', () => {
      Object.assign(config.effects, { confettiPieces: 0 });
      const pieces = celebrationPieces(SEED);
      expect(pieces).toHaveLength(config.effects.coinRainPieces);
      expect(pieces.every((piece) => piece.kind === 'coin')).toBe(true);
    });

    it('drops nothing when both counts are 0', () => {
      Object.assign(config.effects, { confettiPieces: 0, coinRainPieces: 0 });
      expect(celebrationPieces(SEED)).toEqual([]);
    });
  });

  describe('seeds', () => {
    it('drops the same pieces for the same seed', () => {
      expect(celebrationPieces(SEED)).toEqual(celebrationPieces(SEED));
    });

    it('drops other pieces for another seed', () => {
      expect(celebrationPieces(SEED + 1)).not.toEqual(celebrationPieces(SEED));
    });

    it.each([SEED, 0, -1, Number.NaN, 2 ** 40 + 3, Number.MAX_SAFE_INTEGER])('drops every piece in bounds for seed %s', (seed) => {
      const pieces = celebrationPieces(seed);
      expect(pieces).toHaveLength(config.effects.confettiPieces + config.effects.coinRainPieces);
      expectEveryPieceInBounds(pieces);
    });
  });

  describe('timing', () => {
    it('staggers the starts over the whole first half of the celebration', () => {
      const lastDelay = config.effects.celebrationSeconds / 2;
      const delays = celebrationPieces(SEED).map((piece) => piece.delaySeconds);
      expect(Math.min(...delays)).toBeLessThan(lastDelay * 0.1);
      expect(Math.max(...delays)).toBeGreaterThan(lastDelay * 0.9);
    });

    it('drops fast pieces of about 1.2 s and slow ones that take until the end', () => {
      const longestFall = config.effects.celebrationSeconds + 1 - config.effects.celebrationSeconds / 2;
      const falls = celebrationPieces(SEED).map((piece) => piece.fallSeconds);
      expect(Math.min(...falls)).toBeLessThan(1.3);
      expect(Math.max(...falls)).toBeGreaterThan(longestFall * 0.9);
    });

    it('starts every piece at once and lands it within a second when the celebration lasts 0 s', () => {
      Object.assign(config.effects, { celebrationSeconds: 0 });
      const pieces = celebrationPieces(SEED);
      expectEveryPieceInBounds(pieces);
      expect(pieces.every((piece) => piece.delaySeconds === 0)).toBe(true);
    });

    it('never falls faster than 1.2 s in a long celebration', () => {
      Object.assign(config.effects, { celebrationSeconds: 10 });
      const pieces = celebrationPieces(SEED);
      expectEveryPieceInBounds(pieces);
      for (const piece of pieces) expect(piece.fallSeconds).toBeGreaterThanOrEqual(1.2);
    });
  });

  describe('motion', () => {
    it('spreads the starts across the whole width', () => {
      const lefts = celebrationPieces(SEED).map((piece) => piece.leftPercent);
      expect(Math.min(...lefts)).toBeLessThan(10);
      expect(Math.max(...lefts)).toBeGreaterThan(90);
    });

    it('drifts and spins both ways, up to their limits', () => {
      const pieces = celebrationPieces(SEED);
      const drifts = pieces.map((piece) => piece.driftPercent);
      const spins = pieces.map((piece) => piece.spinDegrees);
      expect(Math.min(...drifts)).toBeLessThan(-9);
      expect(Math.max(...drifts)).toBeGreaterThan(9);
      expect(Math.min(...spins)).toBeLessThan(-650);
      expect(Math.max(...spins)).toBeGreaterThan(650);
    });
  });

  describe('colors', () => {
    it('paints confetti in the grass green, wheat, lavender, coin yellow and red', () => {
      const confettiColors = new Set(ofKind(celebrationPieces(SEED), 'confetti').map((piece) => piece.color));
      expect(confettiColors).toEqual(new Set(['#8fe03a', '#f5d76e', '#9b6dd6', COIN_YELLOW, '#e53935']));
    });

    it('paints every coin coin yellow', () => {
      const coinColors = new Set(ofKind(celebrationPieces(SEED), 'coin').map((piece) => piece.color));
      expect(coinColors).toEqual(new Set([COIN_YELLOW]));
    });
  });
});
