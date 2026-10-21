import { config } from '../config';
import type { SaveData } from '../logic/save';
import { texts } from '../texts';
import { formatCount } from './formatCount';
import { coinIconSvg } from './icons';
import { createLayer, layerButton, layerTitle } from './layer';

export type Outcome = 'won' | 'lost';

/** The coins of the level that just ended. */
export interface ResultSummary {
  levelCoins: number;
  bonusCoins: number;
}

export interface ResultOverlay {
  readonly layer: HTMLElement;
  /** Fills the layer for `outcome`; showing it is up to the screen flow. `save` sets the «+30 s» button. */
  show(outcome: Outcome, summary: ResultSummary, save: SaveData): void;
}

const TITLES: Record<Outcome, string> = { won: texts.result.wonTitle, lost: texts.result.lostTitle };

/** A win shows the coins cut, the time bonus and their total; a defeat, only the coins cut. */
export function resultLines(outcome: Outcome, { levelCoins, bonusCoins }: ResultSummary): string[] {
  const coins = `${texts.result.coins} ${formatCount(levelCoins)}`;
  if (outcome === 'lost') return [coins];
  return [coins, `${texts.result.timeBonus} ${formatCount(bonusCoins)}`, `${texts.result.total} ${formatCount(levelCoins + bonusCoins)}`];
}

export interface ContinueButton {
  label: string;
  /** The clocks left, or the price of one when none are left. */
  detail: string;
  /** True when `detail` is a price, shown with the coin icon. */
  showsPrice: boolean;
  disabled: boolean;
}

/** Defeat's «+30 s»: spends a clock, or buys one when none are left; off without either. */
export function continueButton(save: SaveData): ContinueButton {
  const clocks = save.boosters.clock;
  const { price } = config.boosters.clock;
  if (clocks > 0) return { label: texts.result.continue, detail: `${texts.boosters.clock} ${formatCount(clocks)}`, showsPrice: false, disabled: false };
  return { label: texts.result.continue, detail: formatCount(price), showsPrice: true, disabled: save.coins < price };
}

export interface ResultActions {
  /** Defeat: «+30 s» plays on with the field as it was. */
  onContinue(): void;
  /** Victory: goes on to the next level. */
  onNext(): void;
  /** Defeat: plays the same level again. */
  onRetry(): void;
  /** Victory: opens the shop, which comes back here. */
  onShop(): void;
  /** Leaves for the home screen. */
  onHome(): void;
}

/** The layer shown when the level ends, with its coins: «Siguiente», «Tienda» and «Inicio» after a win, «+30 s», «Reintentar» and «Inicio» after a loss. */
export function createResultOverlay(container: HTMLElement, actions: ResultActions): ResultOverlay {
  const layer = createLayer(container, 'result');
  const title = layerTitle('');
  const lines = document.createElement('div');
  lines.className = 'result-lines';
  const buttons = document.createElement('div');
  buttons.className = 'layer-buttons';
  layer.append(title, lines, buttons);
  const buttonsFor: Record<Outcome, HTMLButtonElement[]> = {
    won: [
      layerButton(texts.result.wonButton, 'primary', actions.onNext),
      layerButton(texts.result.shop, 'secondary', actions.onShop),
      layerButton(texts.result.home, 'secondary', actions.onHome),
    ],
    lost: [
      layerButton('', 'primary', actions.onContinue),
      layerButton(texts.result.lostButton, 'secondary', actions.onRetry),
      layerButton(texts.result.home, 'secondary', actions.onHome),
    ],
  };
  const continueElement = buttonsFor.lost[0]!;
  continueElement.classList.add('result-continue');

  function show(outcome: Outcome, summary: ResultSummary, save: SaveData): void {
    const { label, detail, showsPrice, disabled } = continueButton(save);
    continueElement.innerHTML = `${label} <span class="result-continue-detail">${showsPrice ? coinIconSvg('result-continue-icon') : ''}${detail}</span>`;
    continueElement.disabled = disabled;
    title.textContent = TITLES[outcome];
    layer.dataset.outcome = outcome;
    lines.replaceChildren(
      ...resultLines(outcome, summary).map((text) => {
        const line = document.createElement('p');
        line.className = 'result-line';
        line.textContent = text;
        return line;
      }),
    );
    buttons.replaceChildren(...buttonsFor[outcome]);
  }

  return { layer, show };
}
