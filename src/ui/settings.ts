import { config } from '../config';
import type { QualityLevel } from '../logic/quality';
import { defaultSave, type SaveData, type Settings } from '../logic/save';
import { texts } from '../texts';
import { CONFIRM_WINDOW_MS, createConfirmButtonState } from './confirmButton';
import { createLayer, layerButton, layerTitle } from './layer';

export interface SettingsActions {
  onToggleSound(): void;
  onToggleMusic(): void;
  /** A volume slider moved, to `position` from 0 to 1. */
  onSoundVolume(position: number): void;
  onMusicVolume(position: number): void;
  onToggleVibration(): void;
  onCycleQuality(): void;
  onClearProgress(): void;
  onBack(): void;
}

type SwitchKey = 'sound' | 'music' | 'vibration' | 'quality';

export interface SettingRow {
  key: SwitchKey;
  label: string;
  valueLabel: string;
  /** On or off for the switches; null for the quality picker, which has no pressed state. */
  pressed: boolean | null;
}

/** Sound, music, vibration where the browser can vibrate, and quality, which under Auto names the level in use. */
export function settingRows(save: SaveData, vibrationSupported: boolean, activeQuality: QualityLevel): SettingRow[] {
  const rows: SettingRow[] = [settingRow(save.settings, 'sound', texts.settings.sound), settingRow(save.settings, 'music', texts.settings.music)];
  if (vibrationSupported) rows.push(settingRow(save.settings, 'vibration', texts.settings.vibration));
  rows.push(qualityRow(save.settings, activeQuality));
  return rows;
}

function qualityRow(settings: Settings, activeQuality: QualityLevel): SettingRow {
  const { autoQuality, qualityLevels } = texts.settings;
  const valueLabel =
    settings.quality === 'auto' ? autoQuality.replace('{level}', qualityLevels[activeQuality]) : qualityLevels[settings.quality];
  return { key: 'quality', label: texts.settings.quality, valueLabel, pressed: null };
}

function settingRow(settings: Settings, key: 'sound' | 'music' | 'vibration', label: string): SettingRow {
  const pressed = settings[key];
  return { key, label, valueLabel: pressed ? texts.settings.on : texts.settings.off, pressed };
}

/** The sound and music switches each with its volume slider under it, the vibration switch, the quality picker, and «Borrar progreso» confirmed with a second press instead of a browser dialog. */
export function createSettingsScreen(
  container: HTMLElement,
  actions: SettingsActions,
  vibrationSupported: boolean,
): { readonly layer: HTMLElement; render(save: SaveData, activeQuality: QualityLevel): void } {
  const layer = createLayer(container, 'settings');
  const actionOf: Record<SwitchKey, () => void> = {
    sound: actions.onToggleSound,
    music: actions.onToggleMusic,
    vibration: actions.onToggleVibration,
    quality: actions.onCycleQuality,
  };
  // The rows only depend on the browser, so the buttons are made once and filled in by render.
  const rows = settingRows(defaultSave(), vibrationSupported, config.quality.startLevel);
  const switches = rows.map((row) => {
    const button = layerButton(row.label, 'secondary', actionOf[row.key]);
    button.classList.add('settings-switch');
    return button;
  });
  const sliders = {
    sound: volumeSlider(texts.settings.soundVolume, actions.onSoundVolume),
    music: volumeSlider(texts.settings.musicVolume, actions.onMusicVolume),
  };
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
    ...switches.flatMap((button, index) => {
      const key = rows[index]!.key;
      return key === 'sound' || key === 'music' ? [button, sliders[key]] : [button];
    }),
    clear,
    layerButton(texts.settings.back, 'secondary', actions.onBack),
  );

  function render(save: SaveData, activeQuality: QualityLevel): void {
    settingRows(save, vibrationSupported, activeQuality).forEach((row, index) => {
      const button = switches[index]!;
      button.textContent = `${row.label} · ${row.valueLabel}`;
      if (row.pressed === null) button.removeAttribute('aria-pressed');
      else button.setAttribute('aria-pressed', String(row.pressed));
    });
    sliders.sound.value = String(Math.round(save.settings.soundVolume * SLIDER_STEPS));
    sliders.music.value = String(Math.round(save.settings.musicVolume * SLIDER_STEPS));
  }

  return { layer, render };
}

/** Slider positions from silent to full. */
const SLIDER_STEPS = 100;

/** A volume slider that reports its position, from 0 to 1, while it moves. */
function volumeSlider(label: string, onMove: (position: number) => void): HTMLInputElement {
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = String(SLIDER_STEPS);
  slider.className = 'settings-volume';
  slider.setAttribute('aria-label', label);
  slider.addEventListener('input', () => onMove(Number(slider.value) / SLIDER_STEPS));
  return slider;
}
