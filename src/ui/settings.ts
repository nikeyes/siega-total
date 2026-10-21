import { texts } from '../texts';
import { CONFIRM_WINDOW_MS, createConfirmButtonState } from './confirmButton';
import { createLayer, layerButton, layerTitle } from './layer';

export interface SettingsActions {
  onClearProgress(): void;
  onBack(): void;
}

/** Only «Borrar progreso» for now, confirmed with a second press instead of a browser dialog. */
export function createSettingsScreen(container: HTMLElement, actions: SettingsActions): { readonly layer: HTMLElement } {
  const layer = createLayer(container, 'settings');
  const confirmState = createConfirmButtonState();
  const clear = layerButton(confirmState.label(performance.now()), 'secondary', () => {
    const now = performance.now();
    if (confirmState.press(now) === 'confirmed') actions.onClearProgress();
    clear.textContent = confirmState.label(now);
    // Puts the label back once the second press is no longer waited for.
    if (confirmState.label(now) !== texts.settings.clearProgress) {
      setTimeout(() => (clear.textContent = confirmState.label(performance.now())), CONFIRM_WINDOW_MS);
    }
  });
  clear.classList.add('settings-clear');
  layer.append(layerTitle(texts.settings.title), clear, layerButton(texts.settings.back, 'secondary', actions.onBack));
  return { layer };
}
