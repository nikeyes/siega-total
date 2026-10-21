import { describe, expect, it } from 'vitest';
import { PATTERNS, SAND_REGION, type PatternName, type RegionMap } from '../../src/logic/patterns';
import { createRandom } from '../../src/logic/random';

const COLUMNS = 30;
const ROWS = 30;
/** Enough seeds to see each pattern's random parameters vary. */
const SEEDS = Array.from({ length: 20 }, (_, index) => index * 7919 + 1);
const NAMES = Object.keys(PATTERNS) as PatternName[];

function mapOf(name: PatternName, seed: number, regionCount: number, columns = COLUMNS, rows = ROWS): RegionMap {
  return PATTERNS[name](createRandom(seed), { columns, rows, regionCount });
}

function regionsPresent(map: RegionMap): Set<number> {
  return new Set(map.regions);
}

describe.each(NAMES)('pattern %s', (name) => {
  it('covers columns × rows with regions in [SAND_REGION, regionCount)', () => {
    for (const regionCount of [1, 2, 3, 4]) {
      for (const seed of SEEDS) {
        const map = mapOf(name, seed, regionCount, 30, 24);
        expect([map.columns, map.rows, map.regions.length, map.regionCount]).toEqual([30, 24, 30 * 24, regionCount]);
        expect(map.regions.every((region) => region >= SAND_REGION && region < regionCount), `seed ${seed}`).toBe(true);
      }
    }
  });

  it('draws the same map for the same seed', () => {
    expect(mapOf(name, 42, 3)).toEqual(mapOf(name, 42, 3));
  });

  it('draws different maps for different seeds', () => {
    const maps = new Set(SEEDS.map((seed) => mapOf(name, seed, 3).regions.join(',')));
    expect(maps.size).toBeGreaterThan(1);
  });

  it('uses every region when asked for two or more', () => {
    for (const regionCount of [2, 3, 4]) {
      for (const seed of SEEDS) {
        const present = regionsPresent(mapOf(name, seed, regionCount));
        for (let region = 0; region < regionCount; region++) expect(present.has(region), `seed ${seed}, region ${region} of ${regionCount}`).toBe(true);
      }
    }
  });

  it('uses only region 0 and sand when asked for one region', () => {
    for (const seed of SEEDS) {
      const present = regionsPresent(mapOf(name, seed, 1));
      present.delete(SAND_REGION);
      expect([...present]).toEqual([0]);
    }
  });
});

const regionAt = (map: RegionMap, column: number, row: number) => map.regions[row * map.columns + column]!;
const range = (length: number) => Array.from({ length }, (_, index) => index);

describe('pattern shapes', () => {
  it('stripes: every column, or every row, has a single region', () => {
    for (const seed of SEEDS) {
      const map = mapOf('stripes', seed, 3);
      const columnsUniform = range(COLUMNS).every((column) => new Set(range(ROWS).map((row) => regionAt(map, column, row))).size === 1);
      const rowsUniform = range(ROWS).every((row) => new Set(range(COLUMNS).map((column) => regionAt(map, column, row))).size === 1);
      expect(columnsUniform || rowsUniform, `seed ${seed}`).toBe(true);
    }
  });

  it('checkerboard: neighboring squares have different regions', () => {
    for (const seed of SEEDS) {
      const map = mapOf('checkerboard', seed, 2);
      // Cells where the region changes along a row and along a column mark square edges; a 2-region board alternates at each.
      const changesAlongRow = range(COLUMNS - 1).filter((column) => regionAt(map, column, 0) !== regionAt(map, column + 1, 0));
      const changesAlongColumn = range(ROWS - 1).filter((row) => regionAt(map, 0, row) !== regionAt(map, 0, row + 1));
      expect(changesAlongRow.length, `seed ${seed}`).toBeGreaterThan(1);
      expect(changesAlongRow).toEqual(changesAlongColumn);
      for (const row of range(ROWS)) {
        for (const column of range(COLUMNS - 1)) {
          const edge = changesAlongRow.includes(column);
          expect(regionAt(map, column, row) !== regionAt(map, column + 1, row), `seed ${seed} at ${column},${row}`).toBe(edge);
        }
      }
    }
  });

  it('circles: cells at the same distance from some center share a region', () => {
    for (const seed of SEEDS) {
      const map = mapOf('circles', seed, 3);
      // Find a center in the middle third for which the region depends on the distance alone.
      const candidates = range(COLUMNS * 2 + 1)
        .map((half) => half / 2)
        .filter((x) => x >= COLUMNS / 3 && x <= (2 * COLUMNS) / 3);
      const consistentCenter = candidates.some((cx) =>
        candidates.some((cz) => {
          const regionByDistance = new Map<number, number>();
          return range(COLUMNS * ROWS).every((cell) => {
            const distance = Math.round(Math.hypot((cell % COLUMNS) + 0.5 - cx, Math.floor(cell / COLUMNS) + 0.5 - cz) * 1e6);
            const region = map.regions[cell]!;
            if (!regionByDistance.has(distance)) regionByDistance.set(distance, region);
            return regionByDistance.get(distance) === region;
          });
        }),
      );
      expect(consistentCenter, `seed ${seed}`).toBe(true);
    }
  });

  it('spiral: bands of every region wind through all four quadrants', () => {
    for (const seed of SEEDS) {
      const map = mapOf('spiral', seed, 2);
      const half = COLUMNS / 2;
      const quadrants = [
        [0, 0],
        [half, 0],
        [0, half],
        [half, half],
      ];
      for (const [left, top] of quadrants) {
        const present = new Set(range(half * half).map((index) => regionAt(map, left! + (index % half), top! + Math.floor(index / half))));
        expect(present, `seed ${seed}, quadrant at ${left},${top}`).toEqual(new Set([0, 1]));
      }
    }
  });

  it('windingPath: each path is connected and crosses the field from one edge to the opposite one', () => {
    for (const regionCount of [2, 3, 4]) {
      for (const seed of SEEDS) {
        const map = mapOf('windingPath', seed, regionCount);
        for (let region = 1; region < regionCount; region++) {
          const cells = range(COLUMNS * ROWS).filter((cell) => map.regions[cell] === region);
          const component = connectedComponent(map, cells[0]!);
          const description = `seed ${seed}, path ${region} of ${regionCount}`;
          expect(component.size, description).toBe(cells.length);
          const columnsTouched = new Set([...component].map((cell) => cell % COLUMNS));
          const rowsTouched = new Set([...component].map((cell) => Math.floor(cell / COLUMNS)));
          const crossesWestEast = columnsTouched.has(0) && columnsTouched.has(COLUMNS - 1);
          const crossesNorthSouth = rowsTouched.has(0) && rowsTouched.has(ROWS - 1);
          expect(crossesWestEast || crossesNorthSouth, description).toBe(true);
        }
      }
    }
  });

  it('soccerField: is symmetric left to right, with a sand border', () => {
    for (const seed of SEEDS) {
      const map = mapOf('soccerField', seed, 2);
      for (const row of range(ROWS)) {
        for (const column of range(COLUMNS)) {
          expect(regionAt(map, column, row), `seed ${seed} at ${column},${row}`).toBe(regionAt(map, COLUMNS - 1 - column, row));
        }
      }
      const border = range(COLUMNS * ROWS).filter((cell) => {
        const column = cell % COLUMNS;
        const row = Math.floor(cell / COLUMNS);
        return column === 0 || row === 0 || column === COLUMNS - 1 || row === ROWS - 1;
      });
      expect(border.every((cell) => map.regions[cell] === SAND_REGION), `seed ${seed}`).toBe(true);
    }
  });

  it('islands: islands of different regions never touch', () => {
    for (const seed of SEEDS) {
      const map = mapOf('islands', seed, 4);
      for (const row of range(ROWS)) {
        for (const column of range(COLUMNS)) {
          const here = regionAt(map, column, row);
          if (here === 0) continue;
          const neighbors = [
            [column + 1, row],
            [column, row + 1],
            [column + 1, row + 1],
            [column - 1, row + 1],
          ].filter(([c, r]) => c! >= 0 && c! < COLUMNS && r! < ROWS);
          for (const [c, r] of neighbors) {
            const there = regionAt(map, c!, r!);
            expect(there === 0 || there === here, `seed ${seed} at ${column},${row}`).toBe(true);
          }
        }
      }
    }
  });
});

/** The cells 4-connected to `start` that share its region. */
function connectedComponent(map: RegionMap, start: number): Set<number> {
  const region = map.regions[start];
  const seen = new Set([start]);
  const pending = [start];
  while (pending.length > 0) {
    const cell = pending.pop()!;
    const column = cell % map.columns;
    const neighbors = [
      column > 0 ? cell - 1 : -1,
      column < map.columns - 1 ? cell + 1 : -1,
      cell - map.columns,
      cell + map.columns,
    ];
    for (const next of neighbors) {
      if (next < 0 || next >= map.regions.length || seen.has(next) || map.regions[next] !== region) continue;
      seen.add(next);
      pending.push(next);
    }
  }
  return seen;
}
