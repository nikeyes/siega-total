import { config } from '../config';
import { QUALITY_SETTINGS, type QualitySetting } from './quality';

export type UpgradeKind = Exclude<keyof typeof config.upgrades, 'priceRoundTo'>;
export type BoosterKind = keyof typeof config.boosters;

const UPGRADE_KINDS: readonly UpgradeKind[] = ['startSize', 'speed', 'extraTime', 'growth'];
const BOOSTER_KINDS = Object.keys(config.boosters) as BoosterKind[];

export interface Settings {
  sound: boolean;
  music: boolean;
  vibration: boolean;
  quality: QualitySetting;
  /** Where each volume slider sits, from 0 (silent) to 1 (full). */
  soundVolume: number;
  musicVolume: number;
}

export interface SaveData {
  version: 5;
  /** Next level to play, ≥ 1. */
  level: number;
  coins: number;
  /** Bought level of each upgrade. */
  upgrades: Record<UpgradeKind, number>;
  /** Uses left of each booster. */
  boosters: Record<BoosterKind, number>;
  settings: Settings;
  /** True once the player has made the first move with the hand hint on screen. */
  tutorialDone: boolean;
}

export const SAVE_VERSION = 5;
/** The effects start a little down, so they sit well with the music at full. */
const DEFAULT_SOUND_VOLUME = 0.65;

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    level: 1,
    coins: 0,
    upgrades: Object.fromEntries(UPGRADE_KINDS.map((kind) => [kind, 0])) as SaveData['upgrades'],
    boosters: Object.fromEntries(BOOSTER_KINDS.map((kind) => [kind, config.boosters[kind].startUses])) as SaveData['boosters'],
    settings: { sound: true, music: true, vibration: true, quality: 'auto', soundVolume: DEFAULT_SOUND_VOLUME, musicVolume: 1 },
    tutorialDone: false,
  };
}

export function serializeSave(save: SaveData): string {
  return JSON.stringify(save);
}

/** Reads stored JSON; damaged, missing or unknown-version data gives the defaults, and every field is sanitized. */
export function loadSave(raw: string | null): SaveData {
  const stored = parseOrNull(raw);
  if (!isVersioned(stored) || stored.version > SAVE_VERSION) return defaultSave();
  return sanitize(migrate(stored) as Partial<SaveData>);
}

/** Brings older saves up to SAVE_VERSION, one version at a time. */
function migrate(data: { version: number } & Record<string, unknown>): unknown {
  // A version 1 save belongs to someone who has already played, so the hand hint is not shown again.
  if (data.version === 1) data = { ...data, version: 2, tutorialDone: true };
  // Version 2 had no quality setting; sanitize gives it the default, 'auto'.
  if (data.version === 2) data = { ...data, version: 3 };
  // Version 3 had no music setting; sanitize gives it the default, on.
  if (data.version === 3) data = { ...data, version: 4 };
  // Version 4 had no volumes; sanitize gives them the defaults.
  if (data.version === 4) data = { ...data, version: 5 };
  return data;
}

function parseOrNull(raw: string | null): unknown {
  try {
    return JSON.parse(raw ?? 'null');
  } catch {
    return null;
  }
}

function isVersioned(data: unknown): data is { version: number } {
  return typeof data === 'object' && data !== null && typeof (data as { version?: unknown }).version === 'number';
}

/** Each field that is missing or invalid takes its default; the others are kept. */
function sanitize(data: Partial<SaveData>): SaveData {
  const defaults = defaultSave();
  return {
    version: SAVE_VERSION,
    level: wholeNumberAtLeast(1, data.level, defaults.level),
    coins: wholeNumberAtLeast(0, data.coins, defaults.coins),
    upgrades: sanitizeCounts(data.upgrades, defaults.upgrades, (kind) => config.upgrades[kind].max),
    boosters: sanitizeCounts(data.boosters, defaults.boosters),
    settings: sanitizeSettings(data.settings, defaults.settings),
    tutorialDone: booleanOr(data.tutorialDone, defaults.tutorialDone),
  };
}

/** A whole number from 0 to `maxOf(kind)` for each key of `defaults`, kept from `stored` when valid. */
function sanitizeCounts<Kind extends string>(
  stored: unknown,
  defaults: Record<Kind, number>,
  maxOf: (kind: Kind) => number = () => Infinity,
): Record<Kind, number> {
  const counts = (stored ?? {}) as Partial<Record<Kind, unknown>>;
  const kinds = Object.keys(defaults) as Kind[];
  return Object.fromEntries(
    kinds.map((kind) => [kind, Math.min(maxOf(kind), wholeNumberAtLeast(0, counts[kind], defaults[kind]))]),
  ) as Record<Kind, number>;
}

/** Each known setting kept from `stored` when valid; unknown ones are dropped. */
function sanitizeSettings(stored: unknown, defaults: Settings): Settings {
  const settings = (stored ?? {}) as Partial<Record<keyof Settings, unknown>>;
  return {
    sound: booleanOr(settings.sound, defaults.sound),
    music: booleanOr(settings.music, defaults.music),
    vibration: booleanOr(settings.vibration, defaults.vibration),
    quality: oneOf(QUALITY_SETTINGS, settings.quality, defaults.quality),
    soundVolume: fractionOr(settings.soundVolume, defaults.soundVolume),
    musicVolume: fractionOr(settings.musicVolume, defaults.musicVolume),
  };
}

function oneOf<Value>(allowed: readonly Value[], value: unknown, fallback: Value): Value {
  return allowed.includes(value as Value) ? (value as Value) : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function fractionOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && value >= 0 && value <= 1 ? value : fallback;
}

function wholeNumberAtLeast(min: number, value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min ? Math.floor(value) : fallback;
}
