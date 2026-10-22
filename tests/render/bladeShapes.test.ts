import { describe, expect, it } from 'vitest';
import { armOutline, bladeShapeFor, discOutline, HUB_RADIUS } from '../../src/render/bladeShapes';

describe('bladeShapeFor', () => {
  it('adds arms as the blade grows and turns into a toothed disc from size 7', () => {
    const shapes = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(bladeShapeFor);
    expect(shapes.map((shape) => (shape.kind === 'arms' ? shape.arms : 'disc'))).toEqual([2, 3, 4, 5, 6, 8, 'disc', 'disc', 'disc']);
  });

  it('keeps the smallest shape for a size below 1', () => {
    expect(bladeShapeFor(0)).toEqual(bladeShapeFor(1));
  });

  it('keeps sizes 1 to 3 as plain arms without teeth or a hub hole', () => {
    expect([1, 2, 3].map(bladeShapeFor)).toEqual([2, 3, 4].map((arms) => ({ kind: 'arms', arms, width: 1, teeth: 0, hubHole: false })));
  });

  it('gives the 4 a wider arm and a hub hole, and teeth from size 5', () => {
    expect(bladeShapeFor(4)).toEqual({ kind: 'arms', arms: 5, width: 1.4, teeth: 0, hubHole: true });
    expect(bladeShapeFor(5)).toEqual({ kind: 'arms', arms: 6, width: 1.2, teeth: 3, hubHole: false });
    expect(bladeShapeFor(6)).toEqual({ kind: 'arms', arms: 8, width: 1, teeth: 3, hubHole: false });
    expect(bladeShapeFor(7)).toEqual({ kind: 'disc', teeth: 24 });
  });
});

const radius = ({ x, y }: { x: number; y: number }) => Math.hypot(x, y);

describe('armOutline', () => {
  it.each([1, 2, 3, 4, 5, 6])('reaches radius 1 with the tip of a size %i arm and never past it', (size) => {
    const shape = bladeShapeFor(size);
    if (shape.kind !== 'arms') throw new Error('expected arms');
    const radii = armOutline(shape.width, shape.teeth).map(radius);
    expect(Math.max(...radii)).toBeLessThanOrEqual(1);
    expect(Math.max(...radii)).toBeGreaterThanOrEqual(0.98);
  });

  /** Points on the outer edge, from the hub to the tip, where the radius peaks: one per saw tooth. */
  function outerEdgePeaks(outline: { x: number; y: number }[]): number {
    const radii = outline.map(radius);
    const tip = radii.indexOf(Math.max(...radii));
    let peaks = 0;
    for (let point = 1; point < tip; point++) {
      if (radii[point]! > radii[point - 1]! && radii[point]! > radii[point + 1]!) peaks++;
    }
    return peaks;
  }

  it('cuts its teeth into the arm rather than adding them on', () => {
    const area = (outline: { x: number; y: number }[]) =>
      Math.abs(outline.reduce((sum, point, index) => {
        const next = outline[(index + 1) % outline.length]!;
        return sum + point.x * next.y - next.x * point.y;
      }, 0)) / 2;
    expect(area(armOutline(1.2, 3))).toBeLessThan(area(armOutline(1.2, 0)));
  });

  it.each([0, 3])('has %i saw teeth along its outer edge', (teeth) => {
    expect(outerEdgePeaks(armOutline(1.2, teeth))).toBe(teeth);
  });
});

describe('discOutline', () => {
  it('has 24 saw teeth around its rim, none past radius 1', () => {
    const radii = discOutline(24).outer.map(radius);
    const peaks = radii.filter((r, point) => r > radii.at(point - 1)! && r > radii[(point + 1) % radii.length]!).length;
    expect(peaks).toBe(24);
    expect(Math.max(...radii)).toBeLessThanOrEqual(1);
    expect(Math.max(...radii)).toBeGreaterThanOrEqual(0.98);
  });

  it('has a hole that fits inside the hub', () => {
    const holeRadii = discOutline(24).hole.map(radius);
    expect(Math.max(...holeRadii)).toBeLessThan(HUB_RADIUS);
    expect(Math.min(...holeRadii)).toBeGreaterThan(0);
  });
});

describe('blade shape outlines', () => {

  it.each([
    ['arm', armOutline(1.2, 3)],
    ['disc', discOutline(24).outer],
  ])('has no repeated neighbouring points in the %s outline, which would break triangulation', (_, outline) => {
    const repeats = outline.filter((point, index) => {
      const next = outline[(index + 1) % outline.length]!;
      return Math.hypot(point.x - next.x, point.y - next.y) < 1e-6;
    });
    expect(repeats).toEqual([]);
  });
});
