import { texts } from '../texts';
import { createLayer, layerButton, layerTitle } from './layer';

export interface PauseActions {
  onResume(): void;
  onRetry(): void;
  onHome(): void;
}

/** «Pausa» with «Continuar», «Reintentar» and «Inicio». */
export function createPauseScreen(container: HTMLElement, actions: PauseActions): { readonly layer: HTMLElement } {
  const layer = createLayer(container, 'pause');
  layer.append(
    layerTitle(texts.pause.title),
    layerButton(texts.pause.resume, 'primary', actions.onResume),
    layerButton(texts.pause.retry, 'secondary', actions.onRetry),
    layerButton(texts.pause.home, 'secondary', actions.onHome),
  );
  return { layer };
}
