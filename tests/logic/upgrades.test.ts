import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { defaultSave, type SaveData, type UpgradeKind } from '../../src/logic/save';
import { bonusesFor, buyUpgrade, noBonuses, upgradePrice } from '../../src/logic/upgrades';

const UPGRADE_KINDS = Object.keys(defaultSave().upgrades) as UpgradeKind[];
const PLENTY_OF_COINS = Number.MAX_SAFE_INTEGER;

function saveWithCoins(coins: number): SaveData {
  return { ...defaultSave(), coins };
}

describe('upgrade prices', () => {
  it('starts at the base price and grows with each level bought', () => {
    const { basePrice, max } = config.upgrades.speed;
    const prices = Array.from({ length: max }, (_, level) => upgradePrice('speed', level)!);
    expect(prices[0]).toBe(basePrice);
    prices.slice(1).forEach((price, index) => expect(price).toBeGreaterThan(prices[index]!));
  });

  it('prices a level by the growth from the base, rounded to the nearest hundred', () => {
    const { basePrice, priceGrowth } = config.upgrades.speed;
    const { priceRoundTo } = config.upgrades;
    expect(upgradePrice('speed', 2)).toBe(Math.round((basePrice * priceGrowth ** 2) / priceRoundTo) * priceRoundTo);
  });

  it.each(UPGRADE_KINDS)('rounds every price of %s to whole hundreds', (kind) => {
    for (let level = 0; level < config.upgrades[kind].max; level++) {
      expect(upgradePrice(kind, level)! % config.upgrades.priceRoundTo).toBe(0);
    }
  });

  it.each(UPGRADE_KINDS)('has no price for %s once it is at its max', (kind) => {
    expect(upgradePrice(kind, config.upgrades[kind].max)).toBeNull();
  });
});

describe('buying an upgrade', () => {
  it('spends the exact price and raises the level', () => {
    const price = upgradePrice('speed', 0)!;
    const save = saveWithCoins(price + 1);
    expect(buyUpgrade(save, 'speed')).toBe(true);
    expect(save.coins).toBe(1);
    expect(save.upgrades.speed).toBe(1);
  });

  it('buys with exactly the price, leaving no coins', () => {
    const save = saveWithCoins(upgradePrice('growth', 0)!);
    expect(buyUpgrade(save, 'growth')).toBe(true);
    expect(save.coins).toBe(0);
  });

  it('raises only the upgrade bought', () => {
    const save = saveWithCoins(PLENTY_OF_COINS);
    buyUpgrade(save, 'extraTime');
    expect(save.upgrades).toEqual({ ...defaultSave().upgrades, extraTime: 1 });
  });

  it('changes nothing without enough coins', () => {
    const save = saveWithCoins(upgradePrice('speed', 0)! - 1);
    const before = structuredClone(save);
    expect(buyUpgrade(save, 'speed')).toBe(false);
    expect(save).toEqual(before);
  });

  it('buys the last level up to the max and then no more', () => {
    const { max } = config.upgrades.startSize;
    const save = saveWithCoins(PLENTY_OF_COINS);
    save.upgrades.startSize = max - 1;
    expect(buyUpgrade(save, 'startSize')).toBe(true);
    expect(save.upgrades.startSize).toBe(max);
    const before = structuredClone(save);
    expect(buyUpgrade(save, 'startSize')).toBe(false);
    expect(save).toEqual(before);
  });
});

describe('game bonuses', () => {
  it('without upgrades, are the base blade and level', () => {
    expect(bonusesFor(defaultSave().upgrades)).toEqual(noBonuses());
    expect(noBonuses()).toEqual({ startSize: config.blade.startSize, speedMultiplier: 1, extraSeconds: 0, growthMultiplier: 1 });
  });

  it('add the effect of each level bought', () => {
    const { startSize, speed, extraTime, growth } = config.upgrades;
    expect(bonusesFor({ startSize: 2, speed: 3, extraTime: 4, growth: 5 })).toEqual({
      startSize: config.blade.startSize + 2 * startSize.perLevel,
      speedMultiplier: 1 + 3 * speed.perLevel,
      extraSeconds: 4 * extraTime.perLevel,
      growthMultiplier: 1 + 5 * growth.perLevel,
    });
  });
});
