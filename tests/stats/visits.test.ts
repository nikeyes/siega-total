import { describe, expect, it } from 'vitest';
import { gameStartedPage } from '../../src/stats/visits';

describe('gameStartedPage', () => {
  it('is a page of the game, under its base path', () => {
    expect(gameStartedPage('https://nikeyes.github.io', '/siega-total/')).toBe(
      'https://nikeyes.github.io/siega-total/partida',
    );
  });
});
