import { describe, expect, it } from 'vitest';
import { defaultSave, type Settings } from '../../src/logic/save';
import { texts } from '../../src/texts';
import { settingRows } from '../../src/ui/settings';

function saveWith(settings: Settings) {
  return { ...defaultSave(), settings };
}

describe('settingRows', () => {
  describe('which switches are offered', () => {
    it('offers sound and vibration where the browser can vibrate', () => {
      expect(settingRows(defaultSave(), true).map((row) => row.label)).toEqual([texts.settings.sound, texts.settings.vibration]);
    });

    it('offers only the sound switch, unchanged, where the browser cannot vibrate', () => {
      const save = saveWith({ sound: false, vibration: true });
      expect(settingRows(save, false)).toEqual([
        { key: 'sound', label: texts.settings.sound, valueLabel: texts.settings.off, pressed: false },
      ]);
    });
  });

  describe('how each switch reads', () => {
    const { on, off } = texts.settings;
    it.each([
      { settings: { sound: false, vibration: true }, sound: { valueLabel: off, pressed: false }, vibration: { valueLabel: on, pressed: true } },
      { settings: { sound: true, vibration: false }, sound: { valueLabel: on, pressed: true }, vibration: { valueLabel: off, pressed: false } },
    ])('shows each switch as the save has it: $settings', ({ settings, sound, vibration }) => {
      expect(settingRows(saveWith(settings), true)).toEqual([
        { key: 'sound', label: texts.settings.sound, ...sound },
        { key: 'vibration', label: texts.settings.vibration, ...vibration },
      ]);
    });
  });
});
