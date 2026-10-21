import { texts } from '../texts';

export type Outcome = 'won' | 'lost';

export interface ResultOverlay {
  show(outcome: Outcome): void;
  hide(): void;
}

const TITLES: Record<Outcome, { title: string; button: string }> = {
  won: { title: texts.result.wonTitle, button: texts.result.wonButton },
  lost: { title: texts.result.lostTitle, button: texts.result.lostButton },
};

export interface ResultActions {
  /** Victory: goes on to the next level. */
  onNext(): void;
  /** Defeat: plays the same level again. */
  onRetry(): void;
}

/** The layer shown when the level ends, with one button: next level after a win, retry after a loss. */
export function createResultOverlay(container: HTMLElement, actions: ResultActions): ResultOverlay {
  const layer = document.createElement('div');
  layer.className = 'result';
  const title = document.createElement('h1');
  title.className = 'result-title';
  const button = document.createElement('button');
  button.className = 'result-button';
  button.type = 'button';
  layer.append(title, button);
  container.append(layer);

  // The joystick listens on the container; touches on this layer belong to its button.
  layer.addEventListener('pointerdown', (event) => event.stopPropagation());
  let shownOutcome: Outcome = 'lost';
  button.addEventListener('click', () => (shownOutcome === 'won' ? actions.onNext() : actions.onRetry()));

  function show(outcome: Outcome): void {
    title.textContent = TITLES[outcome].title;
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
