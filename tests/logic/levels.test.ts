import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import type { GrassType } from '../../src/logic/field';
import { stripesLevel, type LevelDefinition } from '../../src/logic/levels';

const { stripeWidthMeters } = config.level;

function columnCount(level: LevelDefinition): number {
  return level.width / level.cellSize;
}

function columnTypes(level: LevelDefinition, column: number): (GrassType | null)[] {
  const columns = columnCount(level);
  return level.cells.filter((_, cell) => cell % columns === column);
}

/** The grass type of each column, from west to east, when every cell in a column has the same type. */
function typeByColumn(level: LevelDefinition): (GrassType | null)[] {
  return Array.from({ length: columnCount(level) }, (_, column) => {
    const types = new Set(columnTypes(level, column));
    expect(types.size, `column ${column}`).toBe(1);
    return [...types][0]!;
  });
}

/** Runs of neighboring columns with the same grass type, from west to east. */
function stripesOf(level: LevelDefinition): { type: GrassType | null; columns: number }[] {
  const stripes: { type: GrassType | null; columns: number }[] = [];
  for (const type of typeByColumn(level)) {
    const last = stripes.at(-1);
    if (last?.type === type) last.columns++;
    else stripes.push({ type, columns: 1 });
  }
  return stripes;
}

describe('stripesLevel', () => {
  it('covers the configured field with one cell per square meter', () => {
    const level = stripesLevel();
    expect(level.width).toBe(config.field.width);
    expect(level.depth).toBe(config.field.depth);
    expect(level.cells).toHaveLength((level.width / level.cellSize) * (level.depth / level.cellSize));
  });

  it('starts with a green stripe at the west edge and alternates it with ice', () => {
    const types = stripesOf(stripesLevel()).map((stripe) => stripe.type);
    expect(types.length).toBeGreaterThan(2);
    types.forEach((type, stripe) => expect(type, `stripe ${stripe}`).toBe(stripe % 2 === 0 ? 'green' : 'ice'));
  });

  it('makes every stripe stripeWidthMeters wide', () => {
    const level = stripesLevel();
    const widths = stripesOf(level).map((stripe) => stripe.columns * level.cellSize);
    expect(widths.every((width) => width === stripeWidthMeters)).toBe(true);
  });

  it('targets ice with the configured time', () => {
    const level = stripesLevel();
    expect(level.target).toBe('ice');
    expect(level.timeSeconds).toBe(config.level.timeSeconds);
  });
});
