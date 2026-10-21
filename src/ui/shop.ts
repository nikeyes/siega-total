import { config } from '../config';
import type { BoosterKind, SaveData, UpgradeKind } from '../logic/save';
import { upgradePrice } from '../logic/upgrades';
import { texts } from '../texts';
import { formatCount } from './formatCount';
import { coinIconSvg } from './icons';
import { createLayer, layerButton, layerTitle } from './layer';

const UPGRADE_ORDER: readonly UpgradeKind[] = ['startSize', 'speed', 'extraTime', 'growth'];

export interface ShopUpgradeRow {
  kind: UpgradeKind;
  label: string;
  /** «Nivel k/máx». */
  levelLabel: string;
  /** What one more level adds, like «+6 % velocidad». */
  effectLabel: string;
  /** The price of the next level, or null at the max. */
  price: string | null;
  canBuy: boolean;
}

/** One row per upgrade, in the order the shop lists them. */
export function shopUpgradeRows(save: SaveData): ShopUpgradeRow[] {
  return UPGRADE_ORDER.map((kind) => {
    const level = save.upgrades[kind];
    const price = upgradePrice(kind, level);
    return {
      kind,
      label: texts.shop[kind],
      levelLabel: `${texts.shop.level} ${level}/${config.upgrades[kind].max}`,
      effectLabel: upgradeEffect(kind),
      price: price === null ? null : formatCount(price),
      canBuy: price !== null && save.coins >= price,
    };
  });
}

const BOOSTER_ORDER: readonly BoosterKind[] = ['upgrade', 'compass', 'clock'];

export interface ShopBoosterRow {
  kind: BoosterKind;
  label: string;
  /** What one use does, like «Flecha 15 s». */
  effectLabel: string;
  /** «Usos N». */
  usesLabel: string;
  price: string;
  canBuy: boolean;
}

/** One row per booster, in the order of the HUD buttons. */
export function shopBoosterRows(save: SaveData): ShopBoosterRow[] {
  return BOOSTER_ORDER.map((kind) => ({
    kind,
    label: texts.boosters[kind],
    effectLabel: boosterEffect(kind),
    usesLabel: `${texts.shop.uses} ${formatCount(save.boosters[kind])}`,
    price: formatCount(config.boosters[kind].price),
    canBuy: save.coins >= config.boosters[kind].price,
  }));
}

function boosterEffect(kind: BoosterKind): string {
  const { boosters } = config;
  switch (kind) {
    case 'upgrade':
      return `+${boosters.upgrade.sizes} ${texts.shop.sizeEffect}`;
    case 'compass':
      return `${texts.boosters.compassEffect} ${boosters.compass.seconds} s`;
    case 'clock':
      return `+${boosters.clock.seconds} s`;
  }
}

/** Read from the config on every call, so effects tuned in the debug panel show at once. */
function upgradeEffect(kind: UpgradeKind): string {
  const { perLevel } = config.upgrades[kind];
  switch (kind) {
    case 'startSize':
      return `+${perLevel} ${texts.shop.sizeEffect}`;
    case 'speed':
      return `+${asPercent(perLevel)} % ${texts.shop.speedEffect}`;
    case 'extraTime':
      return `+${perLevel} s`;
    case 'growth':
      return `+${asPercent(perLevel)} % ${texts.shop.growthEffect}`;
  }
}

function asPercent(fraction: number): number {
  return Math.round(fraction * 100);
}

export interface ShopActions {
  onBuyUpgrade(kind: UpgradeKind): void;
  onBuyBooster(kind: BoosterKind): void;
  onBack(): void;
}

export interface ShopScreen {
  readonly layer: HTMLElement;
  /** Shows the balance and every row from `save`. */
  render(save: SaveData): void;
}

/** The balance, one row per upgrade (name, level, effect, price) and one per booster (name, uses, effect, price); buttons are off without coins. */
export function createShopScreen(container: HTMLElement, actions: ShopActions): ShopScreen {
  const layer = createLayer(container, 'shop');
  const coins = document.createElement('div');
  coins.className = 'layer-coins';
  coins.innerHTML = coinIconSvg('layer-coins-icon');
  const coinsText = document.createElement('span');
  coins.append(coinsText);
  const heading = document.createElement('h2');
  heading.className = 'shop-heading';
  heading.textContent = texts.shop.upgrades;
  const list = document.createElement('div');
  list.className = 'shop-list';
  const boostersHeading = document.createElement('h2');
  boostersHeading.className = 'shop-heading';
  boostersHeading.textContent = texts.shop.boosters;
  const boosterList = document.createElement('div');
  boosterList.className = 'shop-list';
  layer.append(
    layerTitle(texts.shop.title),
    coins,
    heading,
    list,
    boostersHeading,
    boosterList,
    layerButton(texts.shop.back, 'secondary', actions.onBack),
  );

  function render(save: SaveData): void {
    coinsText.textContent = formatCount(save.coins);
    list.replaceChildren(
      ...shopUpgradeRows(save).map((row) =>
        rowElement(row.kind, row.label, `${row.levelLabel} · ${row.effectLabel}`, row.price ?? texts.shop.max, row.canBuy, () =>
          actions.onBuyUpgrade(row.kind),
        ),
      ),
    );
    boosterList.replaceChildren(
      ...shopBoosterRows(save).map((row) =>
        rowElement(row.kind, row.label, `${row.usesLabel} · ${row.effectLabel}`, row.price, row.canBuy, () => actions.onBuyBooster(row.kind)),
      ),
    );
  }

  return { layer, render };
}

function rowElement(kind: string, label: string, detailsText: string, buyLabel: string, canBuy: boolean, onBuy: () => void): HTMLElement {
  const element = document.createElement('div');
  element.className = 'shop-row';
  element.dataset.kind = kind;
  const text = document.createElement('div');
  text.className = 'shop-row-text';
  const name = document.createElement('span');
  name.className = 'shop-row-name';
  name.textContent = label;
  const details = document.createElement('span');
  details.className = 'shop-row-details';
  details.textContent = detailsText;
  text.append(name, details);
  const buy = layerButton(buyLabel, 'primary', onBuy);
  buy.classList.add('shop-row-buy');
  buy.disabled = !canBuy;
  element.append(text, buy);
  return element;
}
