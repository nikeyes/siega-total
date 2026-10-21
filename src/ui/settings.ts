import { defaultSave, type SaveData, type Settings } from '../logic/save';
import { texts } from '../texts';
import { CONFIRM_WINDOW_MS, createConfirmButtonState } from './confirmButton';
import { createLayer, layerButton, layerTitle } from './layer';

export interface SettingsActions {
  onToggleSound(): void;
  onToggleVibration(): void;
  onClearProgress(): void;
  onBack(): void;
}

export interface SettingRow {
  key: keyof Settings;
  label: string;
  valueLabel: string;
  pressed: boolean;
}

/** The switches to show; vibration is left out where the browser cannot vibrate. */
export function settingRows(save: SaveData, vibrationSupported: boolean): SettingRow[] {
  const rows: SettingRow[] = [settingRow(save.settings, 'sound', texts.settings.sound)];
  if (vibrationSupported) rows.push(settingRow(save.settings, 'vibration', texts.settings.vibration));
  return rows;
}

function settingRow(settings: Settings, key: keyof Settings, label: string): SettingRow {
  const pressed = settings[key];
  return { key, label, valueLabel: pressed ? texts.settings.on : texts.settings.off, pressed };
}

/** The sound and vibration switches, and «Borrar progreso» confirmed with a second press instead of a browser dialog. */
export function createSettingsScreen(
  container: HTMLElement,
  actions: SettingsActions,
  vibrationSupported: boolean,
): { readonly layer: HTMLElement; render(save: SaveData): void } {
  const layer = createLayer(container, 'settings');
  const toggles: Record<keyof Settings, () => void> = { sound: actions.onToggleSound, vibration: actions.onToggleVibration };
  const switches = settingRows(defaultSave(), vibrationSupported).map((row) => {
    const button = layerButton(row.label, 'secondary', toggles[row.key]);
    button.classList.add('settings-switch');
    return button;
  });
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
  layer.append(
    layerTitle(texts.settings.title),
    ...switches,
    clear,
    layerButton(texts.settings.back, 'secondary', actions.onBack),
  );

  function render(save: SaveData): void {
    settingRows(save, vibrationSupported).forEach((row, index) => {
      const button = switches[index]!;
      button.textContent = `${row.label} · ${row.valueLabel}`;
      button.setAttribute('aria-pressed', String(row.pressed));
    });
  }

  return { layer, render };
}
