interface QualityLevelSettings {
  bladeCount: number;
  maxPixelRatio: number;
  shadow: boolean;
  /** 'persistent' clippings land and stay on the ground; 'fade' ones shrink away. */
  clippings: 'persistent' | 'fade';
  bladesPerClipping: number;
  maxClippingsPerFrame: number;
}

/** One clipping flies for every bladesPerClipping blades cut, and no more than maxClippingsPerFrame in one frame. */
const qualityLevels = {
  high: { bladeCount: 20_000, maxPixelRatio: 2, shadow: true, clippings: 'persistent', bladesPerClipping: 3, maxClippingsPerFrame: 30 },
  medium: { bladeCount: 12_000, maxPixelRatio: 1.5, shadow: true, clippings: 'fade', bladesPerClipping: 3, maxClippingsPerFrame: 30 },
  low: { bladeCount: 6_000, maxPixelRatio: 1, shadow: false, clippings: 'fade', bladesPerClipping: 9, maxClippingsPerFrame: 10 },
} satisfies Record<string, QualityLevelSettings>;

export const config = {
  field: {
    width: 30,
    depth: 30,
    /** The blade count the game rules are tuned for; each blade cut counts referenceBladeCount / bladeCount of it. */
    referenceBladeCount: 12_000,
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
    cactus: { radius: 1.4, minSize: 4, growthCuts: 20, coins: 500 },
    watermelon: { radius: 0.45, minSize: 2, growthCuts: 5, coins: 300 },
    strawberry: { radius: 0.25, minSize: 2, growthCuts: 5, coins: 100 },
  },
  economy: {
    coinsPerSecondLeft: 100,
    /** The floating «+N» shows the coins of this interval added together. */
    floatIntervalSeconds: 0.2,
  },
  upgrades: {
    /** Prices are rounded to this many coins. */
    priceRoundTo: 100,
    startSize: { max: 4, perLevel: 1, basePrice: 8000, priceGrowth: 2 },
    speed: { max: 10, perLevel: 0.06, basePrice: 5000, priceGrowth: 1.5 },
    extraTime: { max: 10, perLevel: 5, basePrice: 5000, priceGrowth: 1.5 },
    growth: { max: 10, perLevel: 0.1, basePrice: 5000, priceGrowth: 1.5 },
  },
  boosters: {
    upgrade: { price: 3000, startUses: 2, sizes: 1 },
    compass: { price: 2000, startUses: 2, seconds: 15, retargetSeconds: 0.2 },
    clock: { price: 3000, startUses: 2, seconds: 30 },
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
    /** Patterns always split the field at least this much; regions with no grass type left are sand, so even one-grass levels show their shape. */
    minPatternRegions: 2,
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
  campaign: {
    /** Curated levels; past the last one, levels are generated. */
    levels: 50,
    /** The picker never repeats the pattern of this many levels before. */
    distinctPatternsBehind: 2,
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
  quality: {
    /** Played seconds skipped at the start of each attempt, while shaders compile and the camera settles. */
    warmupSeconds: 0.5,
    /** Longer frames are a hidden tab or a hiccup, not the game's pace, and are left out. */
    maxSampleFrameSeconds: 0.25,
    /** Played seconds measured in each attempt before its verdict. */
    measureSeconds: 3,
    /** Below this, the next attempt drops one level… */
    dropBelowFps: 50,
    /** …and at or above this for riseAfterAttempts attempts in a row, it rises one. */
    riseAtFps: 58,
    riseAfterAttempts: 2,
    /** The level every session starts with. */
    startLevel: 'medium' as keyof typeof qualityLevels,
    /** Clippings lying on the ground at most, in the levels that keep them. */
    groundClippings: 3000,
    levels: qualityLevels as Record<keyof typeof qualityLevels, QualityLevelSettings>,
  },
  audio: {
    /** The zip plays at most once every this many seconds while the blade cuts. */
    cutMinIntervalSeconds: 0.15,
    /** Each zip in a streak plays this much higher than the one before… */
    cutPitchStep: 0.01,
    /** …up to this playback rate. */
    cutMaxPitch: 2,
    /** A pause in cutting this long ends the streak and the pitch goes back to 1. */
    cutStreakResetSeconds: 0.3,
    volume: { cut: 0.2, sizeUp: 0.8, bounce: 0.8, obstacleCut: 0.7, win: 0.8, lose: 0.8, tap: 0.5, coins: 0.7 },
  },
  vibration: {
    milliseconds: 10,
  },
  effects: {
    clippingSeconds: 0.7,
    sizeUpRingSeconds: 0.4,
    /** The size-up ring grows from the blade's radius to this many times it. */
    sizeUpRingGrowth: 1.8,
    confettiPieces: 60,
    coinRainPieces: 20,
    celebrationSeconds: 2,
  },
};
