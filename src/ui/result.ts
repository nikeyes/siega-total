import { texts } from '../texts';
import { formatCount } from './formatCount';

export type Outcome = 'won' | 'lost';

/** The coins of the level that just ended. */
export interface ResultSummary {
  levelCoins: number;
  bonusCoins: number;
}

export interface ResultOverlay {
  show(outcome: Outcome, summary: ResultSummary): void;
  hide(): void;
}

const TITLES: Record<Outcome, { title: string; button: string }> = {
  won: { title: texts.result.wonTitle, button: texts.result.wonButton },
  lost: { title: texts.result.lostTitle, button: texts.result.lostButton },
};

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
}

/** The layer shown when the level ends, with its coins and one button: next level after a win, retry after a loss. */
export function createResultOverlay(container: HTMLElement, actions: ResultActions): ResultOverlay {
  const layer = document.createElement('div');
  layer.className = 'result';
  const title = document.createElement('h1');
  title.className = 'result-title';
  const lines = document.createElement('div');
  lines.className = 'result-lines';
  const button = document.createElement('button');
  button.className = 'result-button';
  button.type = 'button';
  layer.append(title, lines, button);
  container.append(layer);

  // The joystick listens on the container; touches on this layer belong to its button.
  layer.addEventListener('pointerdown', (event) => event.stopPropagation());
  let shownOutcome: Outcome = 'lost';
  button.addEventListener('click', () => (shownOutcome === 'won' ? actions.onNext() : actions.onRetry()));

  function show(outcome: Outcome, summary: ResultSummary): void {
    title.textContent = TITLES[outcome].title;
    lines.replaceChildren(
      ...resultLines(outcome, summary).map((text) => {
        const line = document.createElement('p');
        line.className = 'result-line';
        line.textContent = text;
        return line;
      }),
    );
    button.textContent = TITLES[outcome].button;
    layer.dataset.outcome = outcome;
    shownOutcome = outcome;
    layer.classList.add('visible');
  }

  function hide(): void {
    layer.classList.remove('visible');
  }

  return { show, hide };
}
