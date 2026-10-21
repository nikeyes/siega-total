import { config } from '../config';

export type UpgradeKind = 'startSize' | 'speed' | 'extraTime' | 'growth';
export type BoosterKind = keyof typeof config.boosters;

const UPGRADE_KINDS: readonly UpgradeKind[] = ['startSize', 'speed', 'extraTime', 'growth'];
const BOOSTER_KINDS = Object.keys(config.boosters) as BoosterKind[];

export interface SaveData {
  version: 1;
  /** Next level to play, ≥ 1. */
  level: number;
  coins: number;
  /** Bought level of each upgrade. */
  upgrades: Record<UpgradeKind, number>;
  /** Uses left of each booster. */
  boosters: Record<BoosterKind, number>;
}

export const SAVE_VERSION = 1;

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    level: 1,
    coins: 0,
    upgrades: Object.fromEntries(UPGRADE_KINDS.map((kind) => [kind, 0])) as SaveData['upgrades'],
    boosters: Object.fromEntries(BOOSTER_KINDS.map((kind) => [kind, config.boosters[kind].startUses])) as SaveData['boosters'],
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

/**
 * Brings older saves up to SAVE_VERSION. Version 1 is the first format, so there is nothing to do yet.
 * When M5 adds version 2, it raises SAVE_VERSION and adds a step here:
 * `if (data.version === 1) data = { ...data, version: 2, <new fields> };`
 */
function migrate(data: { version: number }): unknown {
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
    upgrades: sanitizeCounts(data.upgrades, defaults.upgrades),
    boosters: sanitizeCounts(data.boosters, defaults.boosters),
  };
}

/** A whole number ≥ 0 for each key of `defaults`, kept from `stored` when valid. */
function sanitizeCounts<Kind extends string>(stored: unknown, defaults: Record<Kind, number>): Record<Kind, number> {
  const counts = (stored ?? {}) as Partial<Record<Kind, unknown>>;
  const kinds = Object.keys(defaults) as Kind[];
  return Object.fromEntries(kinds.map((kind) => [kind, wholeNumberAtLeast(0, counts[kind], defaults[kind])])) as Record<Kind, number>;
}

function wholeNumberAtLeast(min: number, value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min ? Math.floor(value) : fallback;
}
