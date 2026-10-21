import { config } from '../config';
import type { SaveData, UpgradeKind } from '../logic/save';
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
  onBack(): void;
}

export interface ShopScreen {
  readonly layer: HTMLElement;
  /** Shows the balance and every row from `save`. */
  render(save: SaveData): void;
}

/** The balance and one row per upgrade: name, level, effect and a price button, off without coins. */
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
  layer.append(layerTitle(texts.shop.title), coins, heading, list, layerButton(texts.shop.back, 'secondary', actions.onBack));

  function render(save: SaveData): void {
    coinsText.textContent = formatCount(save.coins);
    list.replaceChildren(...shopUpgradeRows(save).map((row) => upgradeRowElement(row, actions)));
  }

  return { layer, render };
}

function upgradeRowElement(row: ShopUpgradeRow, actions: ShopActions): HTMLElement {
  const element = document.createElement('div');
  element.className = 'shop-row';
  element.dataset.kind = row.kind;
  const text = document.createElement('div');
  text.className = 'shop-row-text';
  const name = document.createElement('span');
  name.className = 'shop-row-name';
  name.textContent = row.label;
  const details = document.createElement('span');
  details.className = 'shop-row-details';
  details.textContent = `${row.levelLabel} · ${row.effectLabel}`;
  text.append(name, details);
  const buy = layerButton(row.price ?? texts.shop.max, 'primary', () => actions.onBuyUpgrade(row.kind));
  buy.classList.add('shop-row-buy');
  buy.disabled = !row.canBuy;
  element.append(text, buy);
  return element;
}
