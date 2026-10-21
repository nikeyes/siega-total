import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { isObstacleType } from '../../src/logic/levels';
import { generateLevel } from '../../src/logic/generator';
import { obstacleCutSize } from '../../src/logic/obstacles';
import { analyzeLevel, validateLevel } from '../../src/logic/validation';

const SEEDS_PER_LEVEL = 500;
const LEVELS = [1, 7, 13, 22, 40];

/** The generator never hands out an impossible level: whatever validateLevel accepts keeps these invariants. */
describe.each(LEVELS)('every accepted level %i out of 500 seeds', (levelNumber) => {
  it('has units of every target, a free start, a time that fits and a reachable blade size for every target', () => {
    let accepted = 0;
    for (let seed = 1; seed <= SEEDS_PER_LEVEL; seed++) {
      const level = generateLevel(levelNumber, seed);
      if (!validateLevel(level).valid) continue;
      accepted++;
      const description = `level ${levelNumber}, seed ${seed}`;
      const { finalSize } = analyzeLevel(level);
      const startCell = (level.depth / 2) * (level.width / level.cellSize) + level.width / 2;
      expect(level.cells[startCell], description).toBeNull();
      expect(level.timeSeconds, description).toBeLessThanOrEqual(config.generator.maxTimeSeconds);
      for (const target of level.targets) {
        const units = isObstacleType(target)
          ? level.obstacles.filter(({ type }) => type === target).length
          : level.cells.filter((type) => type === target).length;
        expect(units, `${description}, ${target}`).toBeGreaterThan(0);
        const minSize = isObstacleType(target) ? obstacleCutSize(target) : config.grassTypes[target].minSize;
        expect(finalSize, `${description}, ${target}`).toBeGreaterThanOrEqual(minSize);
      }
    }
    expect(accepted).toBeGreaterThan(SEEDS_PER_LEVEL / 4);
  });
});
