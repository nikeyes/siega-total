import { defaultSave, loadSave, serializeSave, type SaveData } from '../logic/save';

const SAVE_KEY = 'siega-total';
/** The save of the version tried out at /nueva/ for a while, which became the game. */
const NUEVA_SAVE_KEY = 'siega-total-nueva';

/** The stored save, or the defaults when there is none or the browser blocks storage. */
export function readSave(): SaveData {
  try {
    adoptNuevaSave();
    return loadSave(localStorage.getItem(SAVE_KEY));
  } catch {
    return defaultSave();
  }
}

/** Whoever played at /nueva/ keeps that progress, the one they last played, over the older one. */
function adoptNuevaSave(): void {
  const nuevaSave = localStorage.getItem(NUEVA_SAVE_KEY);
  if (nuevaSave === null) return;
  localStorage.setItem(SAVE_KEY, nuevaSave);
  localStorage.removeItem(NUEVA_SAVE_KEY);
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
