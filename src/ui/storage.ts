import { defaultSave, loadSave, serializeSave, type SaveData } from '../logic/save';

const SAVE_KEY = 'siega-total';

/** The stored save, or the defaults when there is none or the browser blocks storage. */
export function readSave(): SaveData {
  try {
    return loadSave(localStorage.getItem(SAVE_KEY));
  } catch {
    return defaultSave();
  }
}

/** Keeps playing without saving when the browser blocks storage or it is full. */
export function writeSave(save: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, serializeSave(save));
  } catch (error) {
    console.warn('The game could not be saved.', error);
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (error) {
    console.warn('The saved game could not be cleared.', error);
  }
}
