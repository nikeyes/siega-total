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
