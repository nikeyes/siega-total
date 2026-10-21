import { texts } from '../texts';
import { formatCount } from './formatCount';
import { createLayer, layerButton, layerTitle } from './layer';

export type Outcome = 'won' | 'lost';

/** The coins of the level that just ended. */
export interface ResultSummary {
  levelCoins: number;
  bonusCoins: number;
}

export interface ResultOverlay {
  readonly layer: HTMLElement;
  /** Fills the layer for `outcome`; showing it is up to the screen flow. */
  show(outcome: Outcome, summary: ResultSummary): void;
}

const TITLES: Record<Outcome, string> = { won: texts.result.wonTitle, lost: texts.result.lostTitle };

/** A win shows the coins cut, the time bonus and their total; a defeat, only the coins cut. */
export function resultLines(outcome: Outcome, { levelCoins, bonusCoins }: ResultSummary): string[] {
  const coins = `${texts.result.coins} ${formatCount(levelCoins)}`;
  if (outcome === 'lost') return [coins];
  return [coins, `${texts.result.timeBonus} ${formatCount(bonusCoins)}`, `${texts.result.total} ${formatCount(levelCoins + bonusCoins)}`];
}

export interface ResultActions {
  /** Victory: goes on to the next level. */
  onNext(): void;
  /** Defeat: plays the same level again. */
  onRetry(): void;
  /** Victory: opens the shop, which comes back here. */
  onShop(): void;
  /** Leaves for the home screen. */
  onHome(): void;
}

/** The layer shown when the level ends, with its coins: «Siguiente», «Tienda» and «Inicio» after a win, «Reintentar» and «Inicio» after a loss. */
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
    lost: [layerButton(texts.result.lostButton, 'primary', actions.onRetry), layerButton(texts.result.home, 'secondary', actions.onHome)],
  };

  function show(outcome: Outcome, summary: ResultSummary): void {
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
