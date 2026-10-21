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

describe('stripes', () => {
  it('gives every column, or every row, a single region', () => {
    for (const seed of SEEDS) {
      const map = mapOf('stripes', seed, 3);
      expect(stripeOrientation(map), `seed ${seed}`).toBeDefined();
    }
  });

  it('draws both orientations, with stripes from 2 to 5 cells wide', () => {
    const orientations = new Set<string>();
    const widths = new Set<number>();
    for (const seed of SEEDS) {
      const map = mapOf('stripes', seed, 3);
      const orientation = stripeOrientation(map)!;
      orientations.add(orientation);
      // The first stripe starts at the edge, so its width is where region 0 first ends.
      widths.add(range(COLUMNS).findIndex((index) => (orientation === 'vertical' ? regionAt(map, index, 0) : regionAt(map, 0, index)) !== 0));
    }
    expect(orientations).toEqual(new Set(['vertical', 'horizontal']));
    expect(widths).toEqual(new Set([2, 3, 4, 5]));
  });
});

function stripeOrientation(map: RegionMap): 'vertical' | 'horizontal' | undefined {
  const isUniform = (cells: number[]) => new Set(cells).size === 1;
  if (range(COLUMNS).every((column) => isUniform(range(ROWS).map((row) => regionAt(map, column, row))))) return 'vertical';
  if (range(ROWS).every((row) => isUniform(range(COLUMNS).map((column) => regionAt(map, column, row))))) return 'horizontal';
  return undefined;
}

describe('checkerboard', () => {
  /** Columns after which the region changes along the first row; a 2-region board alternates at each square edge. */
  const squareEdges = (map: RegionMap) => range(COLUMNS - 1).filter((column) => regionAt(map, column, 0) !== regionAt(map, column + 1, 0));

  it('gives neighboring squares different regions', () => {
    for (const seed of SEEDS) {
      const map = mapOf('checkerboard', seed, 2);
      const edges = squareEdges(map);
      const changesAlongColumn = range(ROWS - 1).filter((row) => regionAt(map, 0, row) !== regionAt(map, 0, row + 1));
      expect(edges.length, `seed ${seed}`).toBeGreaterThan(1);
      expect(edges).toEqual(changesAlongColumn);
      for (const row of range(ROWS)) {
        for (const column of range(COLUMNS - 1)) {
          const edge = edges.includes(column);
          expect(regionAt(map, column, row) !== regionAt(map, column + 1, row), `seed ${seed} at ${column},${row}`).toBe(edge);
        }
      }
    }
  });

  it('draws squares from 3 to 6 cells wide', () => {
    const sides = new Set(SEEDS.map((seed) => squareEdges(mapOf('checkerboard', seed, 2))[0]! + 1));
    expect(sides).toEqual(new Set([3, 4, 5, 6]));
  });
});

describe('circles', () => {
  it('gives cells at the same distance from a center in the middle third the same region', () => {
    for (const seed of SEEDS) expect(ringCenter(mapOf('circles', seed, 3)), `seed ${seed}`).toBeDefined();
  });

  it('moves the center around the middle third', () => {
    const centers = SEEDS.map((seed) => ringCenter(mapOf('circles', seed, 3))!);
    expect(new Set(centers.map(({ x }) => x)).size).toBeGreaterThan(1);
    expect(new Set(centers.map(({ z }) => z)).size).toBeGreaterThan(1);
  });

  it('draws rings from 2 to 4 cells wide', () => {
    const widths = new Set<number>();
    for (const seed of SEEDS) {
      const map = mapOf('circles', seed, 3);
      const { x, z } = ringCenter(map)!;
      // The inner disc is region 0; the first cell outside it lies just past one ring width.
      const outsideInnerDisc = range(COLUMNS * ROWS).filter((cell) => map.regions[cell] !== 0);
      widths.add(Math.floor(Math.min(...outsideInnerDisc.map((cell) => Math.hypot((cell % COLUMNS) + 0.5 - x, Math.floor(cell / COLUMNS) + 0.5 - z)))));
    }
    expect(widths).toEqual(new Set([2, 3, 4]));
  });
});

/** A center in the middle third, on the half-cell grid, around which the region depends on the distance alone. */
function ringCenter(map: RegionMap): { x: number; z: number } | undefined {
  const candidates = range(COLUMNS * 2 + 1)
    .map((half) => half / 2)
    .filter((value) => value >= COLUMNS / 3 && value <= (2 * COLUMNS) / 3);
  for (const x of candidates) {
    for (const z of candidates) {
      const regionByDistance = new Map<number, number>();
      const consistent = range(COLUMNS * ROWS).every((cell) => {
        const distance = Math.round(Math.hypot((cell % COLUMNS) + 0.5 - x, Math.floor(cell / COLUMNS) + 0.5 - z) * 1e6);
        const region = map.regions[cell]!;
        if (!regionByDistance.has(distance)) regionByDistance.set(distance, region);
        return regionByDistance.get(distance) === region;
      });
      if (consistent) return { x, z };
    }
  }
  return undefined;
}

describe('spiral', () => {
  it('winds bands of every region through all four quadrants', () => {
    for (const seed of SEEDS) {
      const map = mapOf('spiral', seed, 2);
      const half = COLUMNS / 2;
      for (const [left, top] of [
        [0, 0],
        [half, 0],
        [0, half],
        [half, half],
      ] as const) {
        const present = new Set(range(half * half).map((index) => regionAt(map, left + (index % half), top + Math.floor(index / half))));
        expect(present, `seed ${seed}, quadrant at ${left},${top}`).toEqual(new Set([0, 1]));
      }
    }
  });

  it('has no straight seam where the angle wraps west of the center', () => {
    for (const regionCount of [2, 3, 4]) {
      for (const seed of SEEDS) {
        const map = mapOf('spiral', seed, regionCount);
        // Rows 14 and 15 lie on either side of the ray where atan2 jumps from π to −π.
        const changesAcrossTheRay = range(COLUMNS / 2).filter((column) => regionAt(map, column, ROWS / 2 - 1) !== regionAt(map, column, ROWS / 2));
        expect(changesAcrossTheRay.length, `seed ${seed}, ${regionCount} regions`).toBeLessThan(COLUMNS / 4);
      }
    }
  });

  it('turns around the field center, either way round: a quarter turn shifts four arms by one region', () => {
    const shifts = new Set<number>();
    for (const seed of SEEDS) {
      const map = mapOf('spiral', seed, 4);
      // A quarter turn around the center of a 30 × 30 field takes cell (column, row) to (29 − row, column).
      const shiftsOfThisMap = new Set(range(COLUMNS * ROWS).map((cell) => {
        const column = cell % COLUMNS;
        const row = Math.floor(cell / COLUMNS);
        return (regionAt(map, COLUMNS - 1 - row, column) - regionAt(map, column, row) + 4) % 4;
      }));
      expect(shiftsOfThisMap.size, `seed ${seed}`).toBe(1);
      shifts.add([...shiftsOfThisMap][0]!);
    }
    expect(shifts).toEqual(new Set([1, 3]));
  });

  it('draws arms from 4 to 7 cells wide', () => {
    // On a big field the diagonal from the center crosses enough arms to measure their width to the cell.
    const size = 200;
    const widths = new Set<number>();
    for (const seed of SEEDS) {
      const map = mapOf('spiral', seed, 2, size, size);
      // Along the diagonal the angle stays the same, so the region changes once every arm width.
      const changes = range(size / 2 - 1).filter((step) => regionAt(map, size / 2 + step, size / 2 + step) !== regionAt(map, size / 2 + step + 1, size / 2 + step + 1));
      const diagonalSpan = (changes.at(-1)! - changes[0]!) * Math.SQRT2;
      widths.add(Math.round(diagonalSpan / (changes.length - 1)));
    }
    expect(widths).toEqual(new Set([4, 5, 6, 7]));
  });
});

describe('windingPath', () => {
  /** Cells of `region` in each column, west to east. */
  const pathRowsByColumn = (map: RegionMap, region: number) =>
    range(COLUMNS).map((column) => range(ROWS).filter((row) => regionAt(map, column, row) === region));

  it('keeps each path connected, crossing the field from one edge to the opposite one', () => {
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

  it('draws paths 3 cells wide where they run flat, and wider only on steep stretches', () => {
    for (const regionCount of [2, 3, 4]) {
      for (const seed of SEEDS) {
        const map = mapOf('windingPath', seed, regionCount);
        for (let region = 1; region < regionCount; region++) {
          const narrowest = Math.min(...pathRowsByColumn(map, region).map((rows) => rows.length));
          expect(narrowest, `seed ${seed}, path ${region} of ${regionCount}`).toBe(3);
        }
      }
    }
  });

  it('winds the path up and down instead of drawing a straight band', () => {
    for (const seed of SEEDS) {
      const topRows = new Set(pathRowsByColumn(mapOf('windingPath', seed, 2), 1).map((rows) => rows[0]));
      expect(topRows.size, `seed ${seed}`).toBeGreaterThan(1);
    }
  });

  it('never lets two paths touch', () => {
    for (const regionCount of [3, 4]) {
      for (const seed of SEEDS) expect(touchingRegions(mapOf('windingPath', seed, regionCount)), `seed ${seed}, ${regionCount} regions`).toEqual([]);
    }
  });
});

describe('soccerField', () => {
  it('is symmetric left to right, with a sand border', () => {
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

  it('draws the border, the halfway line, the center circle and both penalty areas in sand, one cell thick', () => {
    // The halfway line takes the two middle columns so the field stays symmetric on an even width.
    const sand = [
      '##############################',
      '#.............##.............#',
      '#.............##.............#',
      '#.............##.............#',
      '#.............##.............#',
      '#.............##.............#',
      '#.............##.............#',
      '#.............##.............#',
      '#.............##.............#',
      '######........##........######',
      '#....#......######......#....#',
      '#....#.....#..##..#.....#....#',
      '#....#....#...##...#....#....#',
      '#....#....#...##...#....#....#',
      '#....#....#...##...#....#....#',
      '#....#....#...##...#....#....#',
      '#....#....#...##...#....#....#',
      '#....#....#...##...#....#....#',
      '#....#.....#..##..#.....#....#',
      '#....#......######......#....#',
      '######........##........######',
      '#.............##.............#',
      '#.............##.............#',
      '#.............##.............#',
      '#.............##.............#',
      '#.............##.............#',
      '#.............##.............#',
      '#.............##.............#',
      '#.............##.............#',
      '##############################',
    ];
    for (const seed of SEEDS) {
      const map = mapOf('soccerField', seed, 2);
      const drawn = range(ROWS).map((row) => range(COLUMNS).map((column) => (regionAt(map, column, row) === SAND_REGION ? '#' : '.')).join(''));
      expect(drawn, `seed ${seed}`).toEqual(sand);
    }
  });

  it('alternates the grass in horizontal stripes 2 or 3 cells wide', () => {
    const widths = new Set<number>();
    for (const seed of SEEDS) {
      const map = mapOf('soccerField', seed, 2);
      // Below the top border, the first stripe is region 0 down to its width.
      widths.add(range(ROWS).findIndex((row) => regionAt(map, 3, row) === 1));
    }
    expect(widths).toEqual(new Set([2, 3]));
  });
});

describe('islands', () => {
  /** Each island as its set of cells; islands never touch, so each is one connected patch. */
  const islandsOf = (map: RegionMap) => {
    const seen = new Set<number>();
    const found: Set<number>[] = [];
    for (const cell of range(COLUMNS * ROWS)) {
      if (map.regions[cell] === 0 || seen.has(cell)) continue;
      const island = connectedComponent(map, cell);
      island.forEach((member) => seen.add(member));
      found.push(island);
    }
    return found;
  };

  it('never lets islands of different regions touch', () => {
    for (const seed of SEEDS) expect(touchingRegions(mapOf('islands', seed, 4)), `seed ${seed}`).toEqual([]);
  });

  it('draws 4 to 8 whole round islands, 2 to 5 cells in radius', () => {
    // Cells whose centers lie within radius 2, 3, 4 and 5 of a cell center.
    const discAreas = [13, 29, 49, 81];
    const areasSeen = new Set<number>();
    for (const seed of SEEDS) {
      const found = islandsOf(mapOf('islands', seed, 4));
      expect(found.length, `seed ${seed}`).toBeGreaterThanOrEqual(4);
      expect(found.length, `seed ${seed}`).toBeLessThanOrEqual(8);
      for (const island of found) {
        expect(discAreas, `seed ${seed}`).toContain(island.size);
        areasSeen.add(island.size);
      }
    }
    expect(areasSeen).toEqual(new Set(discAreas));
  });

  it('still uses every region when the first islands crowd the middle', () => {
    // Seed 505 draws two big islands in the middle; a third one of radius 5 no longer fits.
    const present = regionsPresent(mapOf('islands', 505, 4));
    expect([...present].sort()).toEqual([0, 1, 2, 3]);
  });
});

/** Cells of a non-zero region that touch, even at a corner, a cell of another non-zero region. */
function touchingRegions(map: RegionMap): string[] {
  const touching: string[] = [];
  for (const row of range(map.rows)) {
    for (const column of range(map.columns)) {
      const here = regionAt(map, column, row);
      if (here === 0) continue;
      for (const [c, r] of [
        [column + 1, row],
        [column - 1, row + 1],
        [column, row + 1],
        [column + 1, row + 1],
      ] as const) {
        if (c < 0 || c >= map.columns || r >= map.rows) continue;
        const there = regionAt(map, c, r);
        if (there !== 0 && there !== here) touching.push(`${column},${row}`);
      }
    }
  }
  return touching;
}

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
