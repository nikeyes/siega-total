import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { defaultSave, type SaveData } from '../../src/logic/save';
import { upgradePrice } from '../../src/logic/upgrades';
import { texts } from '../../src/texts';
import { formatCount } from '../../src/ui/formatCount';
import { shopUpgradeRows } from '../../src/ui/shop';

function saveWithCoins(coins: number): SaveData {
  return { ...defaultSave(), coins };
}

function speedRow(save: SaveData) {
  return shopUpgradeRows(save).find((row) => row.kind === 'speed')!;
}

describe('shop upgrade rows', () => {
  it('cannot buy an upgrade without enough coins', () => {
    expect(speedRow(saveWithCoins(upgradePrice('speed', 0)! - 1)).canBuy).toBe(false);
  });

  it('can buy an upgrade with exactly its price', () => {
    expect(speedRow(saveWithCoins(upgradePrice('speed', 0)!)).canBuy).toBe(true);
  });

  it('shows the name, the level bought out of the max and the price of the next level', () => {
    const save = saveWithCoins(0);
    save.upgrades.speed = 2;
    expect(speedRow(save)).toMatchObject({
      label: texts.shop.speed,
      levelLabel: `${texts.shop.level} 2/${config.upgrades.speed.max}`,
      price: formatCount(upgradePrice('speed', 2)!),
    });
  });

  it('has no price and cannot be bought at the max, however many coins there are', () => {
    const save = saveWithCoins(Number.MAX_SAFE_INTEGER);
    save.upgrades.speed = config.upgrades.speed.max;
    expect(speedRow(save)).toMatchObject({ price: null, canBuy: false });
  });

  it('describes the effect of one level from the config', () => {
    const effects = Object.fromEntries(shopUpgradeRows(defaultSave()).map((row) => [row.kind, row.effectLabel]));
    const { startSize, speed, extraTime, growth } = config.upgrades;
    expect(effects).toEqual({
      startSize: `+${startSize.perLevel} ${texts.shop.sizeEffect}`,
      speed: `+${Math.round(speed.perLevel * 100)} % ${texts.shop.speedEffect}`,
      extraTime: `+${extraTime.perLevel} s`,
      growth: `+${Math.round(growth.perLevel * 100)} % ${texts.shop.growthEffect}`,
    });
  });

  it('prices by the level already bought, so the base price no longer buys the second level', () => {
    const save = saveWithCoins(upgradePrice('speed', 0)!);
    save.upgrades.speed = 1;
    expect(speedRow(save)).toMatchObject({ price: formatCount(upgradePrice('speed', 1)!), canBuy: false });
  });

  it('shows the max level as «Nivel máx/máx»', () => {
    const save = saveWithCoins(0);
    save.upgrades.startSize = config.upgrades.startSize.max;
    const row = shopUpgradeRows(save).find((candidate) => candidate.kind === 'startSize')!;
    expect(row.levelLabel).toBe(`${texts.shop.level} ${config.upgrades.startSize.max}/${config.upgrades.startSize.max}`);
  });

  it('lists the four upgrades in a fixed order', () => {
    expect(shopUpgradeRows(defaultSave()).map((row) => row.kind)).toEqual(['startSize', 'speed', 'extraTime', 'growth']);
  });
});
