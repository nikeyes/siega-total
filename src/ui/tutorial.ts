import { texts } from '../texts';
import { handIconSvg } from './icons';

export interface TutorialHint {
  show(): void;
  hide(): void;
}

/** The hand that shows how to drag, with the keys hint for mouse users; it never takes touches. */
export function createTutorialHint(container: HTMLElement): TutorialHint {
  const hint = document.createElement('div');
  hint.className = 'tutorial';

  const stage = document.createElement('div');
  stage.className = 'tutorial-stage';
  const touch = document.createElement('div');
  touch.className = 'tutorial-touch';
  stage.append(touch);
  stage.insertAdjacentHTML('beforeend', handIconSvg('tutorial-hand'));

  const dragText = document.createElement('p');
  dragText.className = 'tutorial-text';
  dragText.textContent = texts.tutorial.drag;
  const keysText = document.createElement('p');
  keysText.className = 'tutorial-keys';
  keysText.textContent = texts.tutorial.keys;

  hint.append(stage, dragText, keysText);
  container.append(hint);

  return {
    show: () => hint.classList.add('visible'),
    hide: () => hint.classList.remove('visible'),
  };
}
