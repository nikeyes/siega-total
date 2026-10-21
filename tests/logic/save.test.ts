import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { defaultSave, loadSave, SAVE_VERSION, serializeSave, type SaveData } from '../../src/logic/save';

/** A save far from the defaults in every field. */
function progressedSave(): SaveData {
  return {
    version: 3,
    level: 12,
    coins: 34_500,
    upgrades: { startSize: 2, speed: 3, extraTime: 1, growth: 4 },
    boosters: { upgrade: 0, compass: 5, clock: 1 },
    settings: { sound: false, vibration: true, quality: 'low' },
    tutorialDone: true,
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

/** `progressedSave()` as version 2 stored it, without the quality setting. */
function versionTwoSave(): string {
  const { quality, ...settings } = progressedSave().settings;
  return JSON.stringify({ ...progressedSave(), version: 2, settings });
}

/** `progressedSave()` as version 1 stored it, without settings or the tutorial flag. */
function versionOneSave(): string {
  const { settings, tutorialDone, ...versionOne } = { ...progressedSave(), version: 1 };
  return JSON.stringify(versionOne);
}

describe('default save', () => {
  it('starts at level 1 with no coins, no upgrades, the starting uses of each booster, everything on and the tutorial pending', () => {
    expect(defaultSave()).toEqual({
      version: 3,
      level: 1,
      coins: 0,
      upgrades: { startSize: 0, speed: 0, extraTime: 0, growth: 0 },
      boosters: {
        upgrade: config.boosters.upgrade.startUses,
        compass: config.boosters.compass.startUses,
        clock: config.boosters.clock.startUses,
      },
      settings: { sound: true, vibration: true, quality: 'auto' },
      tutorialDone: false,
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

  it('brings a version 1 save up to the current version, with the tutorial done and everything on', () => {
    expect(loadSave(versionOneSave())).toEqual({
      ...progressedSave(),
      version: SAVE_VERSION,
      settings: defaultSave().settings,
      tutorialDone: true,
    });
  });

  it('brings a version 2 save up to the current version, with the quality on auto and the rest kept', () => {
    expect(loadSave(versionTwoSave())).toEqual({
      ...progressedSave(),
      version: SAVE_VERSION,
      settings: { ...progressedSave().settings, quality: 'auto' },
    });
  });

  it('keeps a migrated version 1 save the same when it is saved and loaded again', () => {
    const migrated = loadSave(versionOneSave());
    expect(loadSave(serializeSave(migrated))).toEqual(migrated);
  });
});

describe('sanitizing a loaded save', () => {
  it.each([
    ['negative coins', { coins: -5 }, { coins: defaultSave().coins }],
    ['coins of −1', { coins: -1 }, { coins: defaultSave().coins }],
    ['coins that are not a number', { coins: 'mucho' }, { coins: defaultSave().coins }],
    ['coins that are a boolean', { coins: true }, { coins: defaultSave().coins }],
    ['level 0', { level: 0 }, { level: defaultSave().level }],
    [
      'a sound setting that is not a boolean',
      { settings: { sound: 'no', vibration: false, quality: 'low' } },
      { settings: { sound: defaultSave().settings.sound, vibration: false, quality: 'low' } },
    ],
    [
      'a missing sound setting',
      { settings: { vibration: false, quality: 'low' } },
      { settings: { sound: defaultSave().settings.sound, vibration: false, quality: 'low' } },
    ],
    ['settings that are a number', { settings: 5 }, { settings: defaultSave().settings }],
    ['settings that are an array', { settings: [] }, { settings: defaultSave().settings }],
    ['settings that are null', { settings: null }, { settings: defaultSave().settings }],
    ['missing settings', { settings: undefined }, { settings: defaultSave().settings }],
    ['a tutorial flag that is a number', { tutorialDone: 1 }, { tutorialDone: defaultSave().tutorialDone }],
    ['a tutorial flag that is null', { tutorialDone: null }, { tutorialDone: defaultSave().tutorialDone }],
    ['a missing tutorial flag', { tutorialDone: undefined }, { tutorialDone: defaultSave().tutorialDone }],
  ])('replaces %s with the default and keeps the rest', (_, damaged, repaired) => {
    expect(loadWith(damaged)).toEqual({ ...progressedSave(), ...repaired });
  });

  it.each(['ultra', 3, undefined])('puts a quality setting of %s back on auto and keeps the rest', (quality) => {
    const settings = { ...progressedSave().settings, quality };
    expect(loadWith({ settings })).toEqual({ ...progressedSave(), settings: { ...settings, quality: defaultSave().settings.quality } });
  });

  it('drops unknown settings', () => {
    expect(loadWith({ settings: { ...progressedSave().settings, music: true } })).toEqual(progressedSave());
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

  it('lowers an upgrade above its max to the max', () => {
    const upgrades = { ...progressedSave().upgrades, startSize: config.upgrades.startSize.max + 3 };
    expect(loadWith({ upgrades }).upgrades).toEqual({ ...upgrades, startSize: config.upgrades.startSize.max });
  });

  it('drops unknown upgrades and boosters', () => {
    const upgrades = { ...progressedSave().upgrades, magnet: 3 };
    const boosters = { ...progressedSave().boosters, bomb: 1 };
    expect(loadWith({ upgrades, boosters })).toEqual(progressedSave());
  });
});

describe('quality setting in a save', () => {
  it.each(['auto', 'high', 'medium', 'low'] as const)('keeps a quality setting of %s', (quality) => {
    expect(loadWith({ settings: { ...progressedSave().settings, quality } }).settings.quality).toBe(quality);
  });

  it.each([null, 'AUTO', 'Alta', ''])('puts a quality setting of %j back on auto', (quality) => {
    expect(loadWith({ settings: { ...progressedSave().settings, quality } }).settings.quality).toBe('auto');
  });

  it('keeps a quality setting a version 2 save already had', () => {
    const raw = JSON.stringify({ ...progressedSave(), version: 2 });
    expect(loadSave(raw).settings.quality).toBe(progressedSave().settings.quality);
  });

  it('brings a version 1 save up with the quality on auto', () => {
    const { settings, tutorialDone, ...versionOne } = { ...progressedSave(), version: 1 };
    expect(loadSave(JSON.stringify(versionOne)).settings.quality).toBe('auto');
  });
});
