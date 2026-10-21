import { describe, expect, it } from 'vitest';
import { QUALITY_LEVELS, type QualityLevel } from '../../src/logic/quality';
import { defaultSave, type SaveData, type Settings } from '../../src/logic/save';
import { texts } from '../../src/texts';
import { settingRows } from '../../src/ui/settings';

function saveWith(settings: Settings) {
  return { ...defaultSave(), settings };
}

/** The on/off rows, leaving the quality picker out. */
function switchRows(save: SaveData, vibrationSupported: boolean) {
  return settingRows(save, vibrationSupported, 'medium').filter((row) => row.key !== 'quality');
}

describe('settingRows', () => {
  describe('which switches are offered', () => {
    it('offers sound and vibration where the browser can vibrate', () => {
      expect(switchRows(defaultSave(), true).map((row) => row.label)).toEqual([texts.settings.sound, texts.settings.vibration]);
    });

    it('offers only the sound switch, unchanged, where the browser cannot vibrate', () => {
      const save = saveWith({ sound: false, vibration: true, quality: 'auto' });
      expect(switchRows(save, false)).toEqual([
        { key: 'sound', label: texts.settings.sound, valueLabel: texts.settings.off, pressed: false },
      ]);
    });
  });

  describe('how each switch reads', () => {
    const { on, off } = texts.settings;
    it.each([
      { settings: { sound: false, vibration: true, quality: 'auto' as const }, sound: { valueLabel: off, pressed: false }, vibration: { valueLabel: on, pressed: true } },
      { settings: { sound: true, vibration: false, quality: 'auto' as const }, sound: { valueLabel: on, pressed: true }, vibration: { valueLabel: off, pressed: false } },
    ])('shows each switch as the save has it: $settings', ({ settings, sound, vibration }) => {
      expect(switchRows(saveWith(settings), true)).toEqual([
        { key: 'sound', label: texts.settings.sound, ...sound },
        { key: 'vibration', label: texts.settings.vibration, ...vibration },
      ]);
    });
  });

  describe('the quality picker', () => {
    const { autoQuality, qualityLevels } = texts.settings;
    const qualityRowOf = (quality: Settings['quality'], active: QualityLevel) =>
      settingRows(saveWith({ sound: true, vibration: true, quality }), true, active).find((row) => row.key === 'quality')!;

    it('comes last, after the switches, whether or not the browser can vibrate', () => {
      expect(settingRows(defaultSave(), true, 'medium').map((row) => row.key)).toEqual(['sound', 'vibration', 'quality']);
      expect(settingRows(defaultSave(), false, 'medium').map((row) => row.key)).toEqual(['sound', 'quality']);
    });

    it.each([true, false])('keeps the same rows in the same order whatever the save says (vibration %s)', (vibrationSupported) => {
      const keysOf = (save: SaveData, active: QualityLevel) => settingRows(save, vibrationSupported, active).map((row) => row.key);
      const reference = keysOf(defaultSave(), 'medium');
      expect(keysOf(saveWith({ sound: false, vibration: true, quality: 'high' }), 'low')).toEqual(reference);
      expect(keysOf(saveWith({ sound: true, vibration: false, quality: 'auto' }), 'high')).toEqual(reference);
    });

    it('is labelled as the quality', () => {
      expect(qualityRowOf('auto', 'medium').label).toBe(texts.settings.quality);
    });

    it.each(QUALITY_LEVELS)('names the level in use under auto (%s)', (active) => {
      expect(qualityRowOf('auto', active).valueLabel).toBe(autoQuality.replace('{level}', qualityLevels[active]));
    });

    it.each(QUALITY_LEVELS)('shows the fixed level %s by its name, whatever level is in use', (fixed) => {
      const otherLevel = QUALITY_LEVELS.find((level) => level !== fixed)!;
      expect(qualityRowOf(fixed, otherLevel).valueLabel).toBe(qualityLevels[fixed]);
    });

    it('has no pressed state, unlike the switches', () => {
      expect(qualityRowOf('high', 'high').pressed).toBeNull();
    });
  });
});
