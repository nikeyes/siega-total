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
  high: { bladeCount: 5_700, maxPixelRatio: 2, shadow: true, clippings: 'persistent', bladesPerClipping: 3, maxClippingsPerFrame: 30 },
  medium: { bladeCount: 3_400, maxPixelRatio: 1.5, shadow: true, clippings: 'fade', bladesPerClipping: 3, maxClippingsPerFrame: 30 },
  low: { bladeCount: 1_700, maxPixelRatio: 1, shadow: false, clippings: 'fade', bladesPerClipping: 9, maxClippingsPerFrame: 10 },
} satisfies Record<string, QualityLevelSettings>;

export const config = {
  field: {
    width: 16,
    depth: 16,
    /** The blade count the game rules are tuned for; each blade cut counts referenceBladeCount / bladeCount of it. */
    referenceBladeCount: 3_400,
    gridCellSize: 1,
    seed: 1,
    /** A strip of island with no grass around the field, where the blade can still move. */
    shoreMeters: 1.5,
  },
  world: {
    /** Height of the island's earth sides, from the ground down to the sea floor. */
    slabThickness: 1.2,
    /** The sea reaches this far past each side of the field. */
    seaMargin: 60,
    /** The grass leans towards `direction` (x, z), up to swayMeters, as a gust wave of waveNumber radians per meter travels across it. */
    wind: { direction: { x: 0.8, z: 0.6 }, swayMeters: 0.12, speed: 1.6, waveNumber: 0.35, phaseJitter: 0.6 },
    /** The glow under the blade spans scale times its radius. */
    glow: { scale: 1.5, opacity: 0.55 },
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
    cactus: { radius: 1.4, minSize: 4, hits: 6, growthCuts: 20, coins: 500 },
    /** `hits`: blows it takes before it breaks; 1 when missing. */
    watermelon: { radius: 0.45, minSize: 3, hits: 4, growthCuts: 5, coins: 300 },
    strawberry: { radius: 0.25, minSize: 2, hits: 2, growthCuts: 5, coins: 100 },
  },
  economy: {
    coinsPerSecondLeft: 50,
    /** The floating «+N» shows the coins of this interval added together. */
    floatIntervalSeconds: 0.2,
  },
  upgrades: {
    /** Prices are rounded to this many coins. */
    priceRoundTo: 100,
    startSize: { max: 4, perLevel: 1, basePrice: 8000, priceGrowth: 2 },
    speed: { max: 10, perLevel: 0.06, basePrice: 5000, priceGrowth: 1.5 },
    extraTime: { max: 10, perLevel: 3, basePrice: 5000, priceGrowth: 1.5 },
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
    /** Below this many seconds the clock turns amber and a soft warning plays once. */
    lowTimeSeconds: 10,
  },
  generator: {
    maxAttempts: 50,
    maxTimeSeconds: 180,
    roundTimeToSeconds: 5,
    /** Every generated level gets this on top of its estimate: turning, braking and hunting down the last blades. */
    extraSeconds: 30,
    startClearingMeters: 3,
    /** Patterns always split the field at least this much; regions with no grass type left are sand, so even one-grass levels show their shape. */
    minPatternRegions: 2,
    curveLastLevel: 25,
    /** Something new in each of the first levels, then every 3 levels. */
    unlockLevel: { green: 1, fruit: 2, ice: 3, wheat: 4, rock: 5, lavender: 7, bramble: 10, cactus: 13 },
    grassTypeCount: { first: 1, last: 4 },
    targetCount: { first: 1, last: 3 },
    rockCount: { first: 1, last: 3 },
    fruitCount: { first: 4, last: 16 },
    cactusCount: { first: 1, last: 2 },
    timeMargin: { first: 2.0, last: 1.6 },
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
    /** A blade resting on a fruit that takes several hits lands one at once, then one every this many seconds. */
    hitIntervalSeconds: 0.3,
    /** Knocking into a rock throws the blade back at `speed` m/s, slowing to a stop over `seconds`, with the steering off meanwhile. */
    rockBounce: { speed: 4, seconds: 0.25 },
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
    /** The cut sounds as one soft, continuous loop of snips while the blade cuts, instead of one sound per cut. */
    breeze: {
      /** Without a cut for this long the breeze dies down; shorter gaps between cutting frames do not make it flutter. */
      holdSeconds: 0.15,
      /** Time constants of its fade in and fade out. */
      fadeInSeconds: 0.12,
      fadeOutSeconds: 0.25,
      /** Loudness as RMS in dBFS: a soft bed some 12–15 dB under the taps and the coins. */
      levelDb: -45,
    },
    music: {
      volume: 0.36,
      /** Fade when the music starts or stops: pausing, leaving the tab or switching it off. */
      fadeSeconds: 1.2,
      /** Share of the music sent to the reverb. */
      reverb: 0.35,
      /** The menu and game styles blend into each other over this long. */
      crossfadeSeconds: 1.5,
      /** `swing`: off-beat eighths come this share of an eighth late. `melodyChance`: chance of a melody note on each eighth. */
      styles: {
        game: {
          bpm: 70,
          swing: 0.16,
          melodyChance: 0.14,
          /** How long the chord and its softer echo ring, in seconds. */
          ringSeconds: { chord: 8, chordEcho: 4 },
          levels: { chord: 0.035, chordEcho: 0.022, melody: 0.04, bass: 0.1, kick: 0.12, brushOnBeat: 0.03, brushOffBeat: 0.018 },
        },
        menu: {
          bpm: 60,
          swing: 0.12,
          melodyChance: 0.08,
          // Without the kick to carry the bar, the chords ring on into the next one.
          ringSeconds: { chord: 10, chordEcho: 5 },
          levels: { chord: 0.035, chordEcho: 0.022, melody: 0.04, bass: 0.07, kick: 0, brushOnBeat: 0.015, brushOffBeat: 0.009 },
        },
      },
    },
    volume: {
      sizeUp: 0.8,
      bounce: 0.8,
      lose: 0.8,
      tap: 0.5,
      watermelonBreak: 0.8,
      strawberryBreak: 0.8,
      cactusBreak: 0.8,
      fruitHit: 0.6,
      rockBump: 0.6,
      lowTime: 0.6,
      levelComplete: 0.7,
      star1: 0.6,
      star2: 0.6,
      star3: 0.6,
      confetti: 0.6,
    },
    /** Versions of each break, picked at random. */
    variants: 4,
    /** Each break plays up to this share higher or lower. */
    pitchJitter: 0.06,
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
    /** The result's stars start this long after it shows, one every starIntervalSeconds; the confetti follows the last. */
    starsDelaySeconds: 0.3,
    starIntervalSeconds: 0.35,
  },
};
