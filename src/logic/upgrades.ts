import { config } from '../config';
import type { SaveData, UpgradeKind } from './save';

/** How the bought upgrades change one game; the level itself stays the same for every player. */
export interface GameBonuses {
  /** Size the blade starts at. */
  startSize: number;
  speedMultiplier: number;
  extraSeconds: number;
  /** Each cut counts this many times toward the next size. */
  growthMultiplier: number;
}

export function noBonuses(): GameBonuses {
  return { startSize: config.blade.startSize, speedMultiplier: 1, extraSeconds: 0, growthMultiplier: 1 };
}

/** Read on every call, so values tuned from the debug panel apply to the next game. */
export function bonusesFor(upgrades: SaveData['upgrades']): GameBonuses {
  const { startSize, speed, extraTime, growth } = config.upgrades;
  return {
    startSize: config.blade.startSize + upgrades.startSize * startSize.perLevel,
    speedMultiplier: 1 + upgrades.speed * speed.perLevel,
    extraSeconds: upgrades.extraTime * extraTime.perLevel,
    growthMultiplier: 1 + upgrades.growth * growth.perLevel,
  };
}

/** Price of the next level of `kind`, or null when it is at its max. */
export function upgradePrice(kind: UpgradeKind, currentLevel: number): number | null {
  const { basePrice, priceGrowth, max } = config.upgrades[kind];
  if (currentLevel >= max) return null;
  const { priceRoundTo } = config.upgrades;
  return Math.round((basePrice * priceGrowth ** currentLevel) / priceRoundTo) * priceRoundTo;
}

/** Spends the coins and raises the level; false (and no change) without coins or at max. */
export function buyUpgrade(save: SaveData, kind: UpgradeKind): boolean {
  const price = upgradePrice(kind, save.upgrades[kind]);
  if (price === null || save.coins < price) return false;
  save.coins -= price;
  save.upgrades[kind]++;
  return true;
}
