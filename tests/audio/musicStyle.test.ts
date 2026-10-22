import { describe, expect, it } from 'vitest';
import { musicStyleFor } from '../../src/audio/musicStyle';

describe('musicStyleFor', () => {
  it.each(['playing', 'paused'] as const)('plays the game style while %s', (screen) => {
    expect(musicStyleFor(screen)).toBe('game');
  });

  it.each(['home', 'shop', 'settings', 'result'] as const)('plays the menu style on %s', (screen) => {
    expect(musicStyleFor(screen)).toBe('menu');
  });
});
