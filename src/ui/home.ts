import { defaultSave, type SaveData } from '../logic/save';
import { texts } from '../texts';
import { formatCount } from './formatCount';
import { levelLabel } from './hud';
import { coinIconSvg } from './icons';
import { createLayer, layerButton, layerTitle } from './layer';

export interface HomeDisplay {
  coinsLabel: string;
  /** «Jugar · Nivel N». */
  playLabel: string;
  /** Both modes, free play first, with the one the next level starts in chosen. */
  modes: ModeOption[];
}

export interface ModeOption {
  timed: boolean;
  label: string;
  chosen: boolean;
}

export function homeDisplay(save: SaveData): HomeDisplay {
  return {
    coinsLabel: formatCount(save.coins),
    playLabel: `${texts.home.play} · ${levelLabel(save.level)}`,
    modes: [
      { timed: false, label: texts.home.untimed, chosen: !save.timed },
      { timed: true, label: texts.home.timed, chosen: save.timed },
    ],
  };
}

export interface HomeActions {
  onPlay(): void;
  /** Picks playing against the clock (true) or free, without time (false). */
  onChooseTimed(timed: boolean): void;
  onShop(): void;
  onSettings(): void;
}

export interface HomeScreen {
  readonly layer: HTMLElement;
  /** Shows the balance and the level to play from `save`. */
  render(save: SaveData): void;
}

/** The title, the balance, «Jugar · Nivel N» with the picker for playing free or against the clock, the shop and the settings; the saved level shows behind it. */
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
  const modePicker = document.createElement('div');
  modePicker.className = 'home-mode';
  modePicker.setAttribute('role', 'group');
  modePicker.setAttribute('aria-label', texts.home.mode);
  const modeButtons = homeDisplay(defaultSave()).modes.map(({ timed, label }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'home-mode-option';
    button.textContent = label;
    button.addEventListener('click', () => actions.onChooseTimed(timed));
    return button;
  });
  modePicker.append(...modeButtons);
  layer.append(settings, layerTitle(texts.home.title), coins, play, modePicker, layerButton(texts.home.shop, 'secondary', actions.onShop));

  function render(save: SaveData): void {
    const display = homeDisplay(save);
    coinsText.textContent = display.coinsLabel;
    play.textContent = display.playLabel;
    display.modes.forEach(({ chosen }, index) => modeButtons[index]!.setAttribute('aria-pressed', String(chosen)));
  }

  return { layer, render };
}
