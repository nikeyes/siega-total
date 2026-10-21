import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { defaultSave, loadSave, SAVE_VERSION, serializeSave, type SaveData } from '../../src/logic/save';

/** A save far from the defaults in every field. */
function progressedSave(): SaveData {
  return {
    version: 1,
    level: 12,
    coins: 34_500,
    upgrades: { startSize: 2, speed: 3, extraTime: 1, growth: 4 },
    boosters: { upgrade: 0, compass: 5, clock: 1 },
  };
}

/** Loads `progressedSave()` with `fields` replaced. */
function loadWith(fields: Record<string, unknown>): SaveData {
  return loadSave(JSON.stringify({ ...progressedSave(), ...fields }));
}

/** JSON can spell a number too big for a double; JSON.parse reads it as Infinity. */
function withInfinite(field: 'level' | 'coins'): string {
  return serializeSave(progressedSave()).replace(`"${field}":${progressedSave()[field]}`, `"${field}":1e999`);
}

describe('default save', () => {
  it('starts at level 1 with no coins, no upgrades and the starting uses of each booster', () => {
    expect(defaultSave()).toEqual({
      version: 1,
      level: 1,
      coins: 0,
      upgrades: { startSize: 0, speed: 0, extraTime: 0, growth: 0 },
      boosters: {
        upgrade: config.boosters.upgrade.startUses,
        compass: config.boosters.compass.startUses,
        clock: config.boosters.clock.startUses,
      },
    });
  });

  it('is a fresh copy each time, so changing one does not change the next', () => {
    defaultSave().boosters.clock = 99;
    expect(defaultSave().boosters.clock).toBe(config.boosters.clock.startUses);
  });
});

describe('loading a save', () => {
  it('gives back what was serialized', () => {
    expect(loadSave(serializeSave(progressedSave()))).toEqual(progressedSave());
  });

  it.each([
    ['nothing stored', null],
    ['an empty string', ''],
    ['broken JSON', '{no json'],
    ['a number', '42'],
    ['null', 'null'],
    ['a JSON array', '[1, 2, 3]'],
    ['a string version', JSON.stringify({ ...progressedSave(), version: '1' })],
    ['no version', JSON.stringify({ ...progressedSave(), version: undefined })],
    ['a save from a newer version of the game', JSON.stringify({ ...progressedSave(), version: SAVE_VERSION + 1 })],
  ])('starts from the defaults with %s', (_, raw) => {
    expect(loadSave(raw)).toEqual(defaultSave());
  });

  it('accepts an older version and brings it up to the current one', () => {
    expect(loadWith({ version: 0 })).toEqual(progressedSave());
  });
});

describe('sanitizing a loaded save', () => {
  it.each([
    ['negative coins', { coins: -5 }, { coins: defaultSave().coins }],
    ['coins of −1', { coins: -1 }, { coins: defaultSave().coins }],
    ['coins that are not a number', { coins: 'mucho' }, { coins: defaultSave().coins }],
    ['coins that are a boolean', { coins: true }, { coins: defaultSave().coins }],
    ['level 0', { level: 0 }, { level: defaultSave().level }],
  ])('replaces %s with the default and keeps the rest', (_, damaged, repaired) => {
    expect(loadWith(damaged)).toEqual({ ...progressedSave(), ...repaired });
  });

  it.each(['level', 'coins'] as const)('replaces an infinite %s with the default', (field) => {
    expect(loadSave(withInfinite(field))[field]).toBe(defaultSave()[field]);
  });

  it('keeps zero coins and level 1, the smallest valid values', () => {
    expect(loadWith({ coins: 0, level: 1 })).toEqual({ ...progressedSave(), coins: 0, level: 1 });
  });

  it('rounds a fractional level and fractional coins down to whole ones', () => {
    const loaded = loadWith({ level: 3.7, coins: 2.5 });
    expect([loaded.level, loaded.coins]).toEqual([3, 2]);
  });

  it('gives a missing booster its starting uses and keeps the other boosters', () => {
    const { compass, clock } = progressedSave().boosters;
    expect(loadWith({ boosters: { compass, clock } }).boosters).toEqual({ upgrade: config.boosters.upgrade.startUses, compass, clock });
  });

  it('replaces an upgrade that is not a whole number of levels and keeps the others', () => {
    const upgrades = { ...progressedSave().upgrades, speed: -1 };
    expect(loadWith({ upgrades }).upgrades).toEqual({ ...upgrades, speed: defaultSave().upgrades.speed });
  });

  it.each([
    ['not objects', { upgrades: 'all', boosters: null }],
    ['arrays', { upgrades: [1, 1, 1, 1], boosters: [5, 5, 5] }],
  ])('starts from the default upgrades and boosters when they are %s', (_, damaged) => {
    const loaded = loadWith(damaged);
    expect([loaded.upgrades, loaded.boosters]).toEqual([defaultSave().upgrades, defaultSave().boosters]);
  });

  it('drops unknown upgrades and boosters', () => {
    const upgrades = { ...progressedSave().upgrades, magnet: 3 };
    const boosters = { ...progressedSave().boosters, bomb: 1 };
    expect(loadWith({ upgrades, boosters })).toEqual(progressedSave());
  });
});
