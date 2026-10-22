export type BladeShape =
  | { kind: 'arms'; arms: number; width: number; teeth: number; hubHole: boolean }
  | { kind: 'disc'; teeth: number };

/** Shapes for sizes 1 to 6; size 7 and up is the disc. */
const ARM_SHAPES: readonly BladeShape[] = [
  { kind: 'arms', arms: 2, width: 1, teeth: 0, hubHole: false },
  { kind: 'arms', arms: 3, width: 1, teeth: 0, hubHole: false },
  { kind: 'arms', arms: 4, width: 1, teeth: 0, hubHole: false },
  { kind: 'arms', arms: 5, width: 1.4, teeth: 0, hubHole: true },
  { kind: 'arms', arms: 6, width: 1.2, teeth: 3, hubHole: false },
  { kind: 'arms', arms: 8, width: 1, teeth: 3, hubHole: false },
];
const DISC_SHAPE: BladeShape = { kind: 'disc', teeth: 24 };

/** Sizes 1–6 add arms, teeth from 5; size 7 and up is a toothed disc. */
export function bladeShapeFor(size: number): BladeShape {
  return ARM_SHAPES[Math.max(size, 1) - 1] ?? DISC_SHAPE;
}

/** Radius of the hub at the blade's centre, in blade radii. */
export const HUB_RADIUS = 0.22;
/** Radius of the hole through the hub, in blade radii. */
export const HUB_HOLE_RADIUS = 0.11;
const HOLE_SEGMENTS = 24;

export interface Vec2 {
  x: number;
  y: number;
}

/** The arm's tip, at radius 1 and slightly ahead, so the arm sweeps back against the spin. */
const ARM_TIP: Vec2 = polar(1, 0.12);
/** Points along each curved edge of an arm. */
const ARM_EDGE_SEGMENTS = 16;
/** The saw teeth sit on this stretch of the outer edge, as a share of the way from the hub to the tip. */
const TEETH_FROM = 0.35;
const TEETH_TO = 0.85;
/** How far each tooth's back dips towards the hub, in blade radii. */
const TOOTH_DEPTH = 0.08;
/** Share of a tooth's length from its point down to the bottom of its back. */
const TOOTH_BACK_SHARE = 0.35;

/** One arm from the hub to a pointed tip at radius 1, curving back against the spin, with `teeth` saw teeth on its outer edge. */
export function armOutline(width: number, teeth: number): Vec2[] {
  const outerStart = { x: 0.1, y: -0.12 * width };
  const outerControl = { x: 0.6, y: -0.2 * width };
  const outerEdge = sawEdge(teeth).map(({ t, dip }) => towardsHub(quadraticPoint(outerStart, outerControl, ARM_TIP, t), dip));
  const innerEdge = sampleCurve(ARM_TIP, { x: 0.55, y: 0 }, { x: 0.1, y: 0.12 * width }).slice(1);
  return [...outerEdge, ...innerEdge];
}

/**
 * Where to sample the outer edge (`t` from hub to tip) and how far each point dips towards the hub.
 * Each tooth is a point that drops sharply down its back and climbs back out along the gully to the next point,
 * so every point is a peak of the radius.
 */
function sawEdge(teeth: number): { t: number; dip: number }[] {
  const plain = Array.from({ length: ARM_EDGE_SEGMENTS + 1 }, (_, step) => ({ t: step / ARM_EDGE_SEGMENTS, dip: 0 }));
  if (teeth === 0) return plain;
  const toothLength = (TEETH_TO - TEETH_FROM) / teeth;
  const toothPoints = Array.from({ length: teeth }, (_, tooth) => {
    const front = TEETH_FROM + tooth * toothLength;
    return [
      { t: front, dip: 0 },
      { t: front + toothLength * TOOTH_BACK_SHARE, dip: TOOTH_DEPTH },
    ];
  }).flat();
  return [
    ...plain.filter(({ t }) => t < TEETH_FROM),
    ...toothPoints,
    { t: TEETH_TO, dip: 0 },
    ...plain.filter(({ t }) => t > TEETH_TO),
  ];
}

/** `point` moved `distance` straight towards the hub. */
function towardsHub(point: Vec2, distance: number): Vec2 {
  const scale = (Math.hypot(point.x, point.y) - distance) / Math.hypot(point.x, point.y);
  return { x: point.x * scale, y: point.y * scale };
}

/** Points along the quadratic Bézier curve from `start` to `end`, both included. */
function sampleCurve(start: Vec2, control: Vec2, end: Vec2): Vec2[] {
  return Array.from({ length: ARM_EDGE_SEGMENTS + 1 }, (_, step) => quadraticPoint(start, control, end, step / ARM_EDGE_SEGMENTS));
}

function quadraticPoint(start: Vec2, control: Vec2, end: Vec2, t: number): Vec2 {
  const u = 1 - t;
  return {
    x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
    y: u * u * start.y + 2 * u * t * control.y + t * t * end.y,
  };
}

/** A disc of radius 1 with `teeth` saw teeth and a hole for the hub. */
export function discOutline(teeth: number): { outer: Vec2[]; hole: Vec2[] } {
  const toothAngle = (Math.PI * 2) / teeth;
  const outer = Array.from({ length: teeth }, (_, tooth) => [
    polar(1, tooth * toothAngle),
    polar(1 - TOOTH_DEPTH, (tooth + TOOTH_BACK_SHARE) * toothAngle),
  ]).flat();
  const hole = Array.from({ length: HOLE_SEGMENTS }, (_, step) => polar(HUB_HOLE_RADIUS, (step / HOLE_SEGMENTS) * Math.PI * 2));
  return { outer, hole };
}

function polar(radius: number, angle: number): Vec2 {
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}
