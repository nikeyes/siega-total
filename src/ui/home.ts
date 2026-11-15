import type { SaveData } from '../logic/save';
import { texts } from '../texts';
import { formatCount } from './formatCount';
import { levelLabel } from './hud';
import { coinIconSvg } from './icons';
import { createLayer, layerButton, layerTitle } from './layer';

export interface HomeDisplay {
  coinsLabel: string;
  /** «Jugar · Nivel N». */
  playLabel: string;
  /** The mode the next level starts in; the label alone tells it, so the switch has no pressed state. */
  modeLabel: string;
}

export function homeDisplay(save: SaveData): HomeDisplay {
  return {
    coinsLabel: formatCount(save.coins),
    playLabel: `${texts.home.play} · ${levelLabel(save.level)}`,
    modeLabel: save.timed ? texts.home.timed : texts.home.untimed,
  };
}

export interface HomeActions {
  onPlay(): void;
  /** Switches between playing with and without time. */
  onToggleTimed(): void;
  onShop(): void;
  onSettings(): void;
}

export interface HomeScreen {
  readonly layer: HTMLElement;
  /** Shows the balance and the level to play from `save`. */
  render(save: SaveData): void;
}

/** The title, the balance, «Jugar · Nivel N» with the switch for playing with or without time, the shop and the settings; the saved level shows behind it. */
export function createHomeScreen(container: HTMLElement, actions: HomeActions): HomeScreen {
  const layer = createLayer(container, 'home');
  const settings = layerButton('⚙', 'icon', actions.onSettings);
  settings.classList.add('home-settings');
  settings.setAttribute('aria-label', texts.home.settings);
  const coins = document.createElement('div');
  coins.className = 'layer-coins';
  coins.innerHTML = coinIconSvg('layer-coins-icon');
  const coinsText = document.createElement('span');
  coins.append(coinsText);
  const play = layerButton('', 'primary', actions.onPlay);
  const mode = layerButton('', 'secondary', actions.onToggleTimed);
  layer.append(settings, layerTitle(texts.home.title), coins, play, mode, layerButton(texts.home.shop, 'secondary', actions.onShop));

  function render(save: SaveData): void {
    const display = homeDisplay(save);
    coinsText.textContent = display.coinsLabel;
    play.textContent = display.playLabel;
    mode.textContent = display.modeLabel;
  }

  return { layer, render };
}
