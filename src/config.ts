export const config = {
  field: {
    width: 30,
    depth: 30,
    bladeCount: 12_000,
    gridCellSize: 1,
    seed: 1,
  },
  grassTypes: {
    green: { minSize: 1, coins: 1 },
    ice: { minSize: 1, coins: 1 },
    wheat: { minSize: 2, coins: 2 },
    lavender: { minSize: 3, coins: 3 },
    bramble: { minSize: 4, coins: 4 },
  },
  obstacles: {
    rock: { radius: 1.0 },
    cactus: { radius: 1.4, minSize: 4, growthCuts: 20 },
    watermelon: { radius: 0.45, minSize: 2, growthCuts: 5 },
    strawberry: { radius: 0.25, minSize: 2, growthCuts: 5 },
  },
  blade: {
    startSize: 1,
    baseRadius: 0.5,
    radiusPerSize: 0.2,
    cutsPerSizeFactor: 200,
    maxSpeed: 5,
    turnSmoothingSeconds: 0.1,
    brakeSeconds: 0.15,
  },
  level: {
    timeSeconds: 90,
    stripeWidthMeters: 3,
    winWaveSpeed: 25,
    highlightBelow: 10,
  },
  generator: {
    maxAttempts: 50,
    maxTimeSeconds: 180,
    roundTimeToSeconds: 5,
    startClearingMeters: 3,
    curveLastLevel: 25,
    unlockLevel: { green: 1, ice: 4, wheat: 7, lavender: 10, rock: 13, fruit: 16, bramble: 19, cactus: 22 },
    grassTypeCount: { first: 1, last: 4 },
    targetCount: { first: 1, last: 3 },
    rockCount: { first: 2, last: 6 },
    fruitCount: { first: 8, last: 30 },
    cactusCount: { first: 1, last: 3 },
    timeMargin: { first: 2.0, last: 1.3 },
    /** Seconds to walk to and cut each target piece, on top of the swept area. */
    secondsPerTargetPiece: 1.5,
    /** Free space kept between obstacles, so the blade can pass between them. */
    obstacleGapMeters: 2,
  },
  collision: {
    /** Passes over the walls each step, so corners between two walls resolve. */
    iterations: 3,
    blockedMessageSeconds: 1,
  },
  input: {
    joystickDeadZonePx: 10,
  },
  camera: {
    fovDegrees: 45,
    tiltDegrees: 55,
    baseDistance: 8,
    followLagSeconds: 0.15,
    zoomPerSize: 0.12,
    zoomTransitionSeconds: 0.5,
    edgeMarginMeters: 1.5,
  },
  render: {
    maxPixelRatio: 1.5,
  },
};
