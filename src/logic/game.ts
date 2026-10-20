import { config } from '../config';
import { addCuts, bladeRadius, createBlade, moveBlade, type Blade, type Direction } from './blade';
import { createField, cutInCircle, type Field } from './field';

export interface Game {
  field: Field;
  blade: Blade;
}

export interface StepResult {
  /** Blades cut during this step. */
  cutIndices: number[];
  sizesGained: number;
}

/** The configured field covered in green grass, with the blade at its center. */
export function createGame(): Game {
  const field = createField({ ...config.field, grassType: 'green' });
  return { field, blade: createBlade(field.width / 2, field.depth / 2) };
}

export function stepGame(game: Game, direction: Direction | null, dt: number): StepResult {
  const { field, blade } = game;
  moveBlade(blade, direction, dt, field.width, field.depth);
  const cutIndices = cutInCircle(field, blade.x, blade.z, bladeRadius(blade.size), blade.size);
  const sizesGained = addCuts(blade, cutIndices.length);
  return { cutIndices, sizesGained };
}
