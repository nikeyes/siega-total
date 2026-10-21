import { config } from '../config';

/** Summed frame times drift a hair over the true total; a measurement this close to a threshold counts as on it. */
const FPS_TOLERANCE = 1e-9;

export type QualityLevel = keyof typeof config.quality.levels;

export type QualitySetting = 'auto' | QualityLevel;

/** From best to cheapest. */
export const QUALITY_LEVELS: readonly QualityLevel[] = ['high', 'medium', 'low'];
/** The order a tap on the setting goes through. */
export const QUALITY_SETTINGS: readonly QualitySetting[] = ['auto', ...QUALITY_LEVELS];

export function nextQualitySetting(setting: QualitySetting): QualitySetting {
  return QUALITY_SETTINGS[(QUALITY_SETTINGS.indexOf(setting) + 1) % QUALITY_SETTINGS.length]!;
}

export interface QualityMonitor {
  /** One played frame of the current attempt, `seconds` long. */
  sampleFrame(seconds: number): void;
  /** Frames per second measured in the current attempt, once measureSeconds are in; otherwise null. */
  measuredFps(): number | null;
  /** Closes the current attempt's verdict and gives the level to build the next one with. */
  nextAttempt(): QualityLevel;
}

/**
 * Measures the played frames of each attempt and moves the level one step for the next:
 * down after a slow attempt, up after riseAfterAttempts fast ones in a row, never back to a level it dropped from.
 */
export function createQualityMonitor(start: QualityLevel = config.quality.startLevel): QualityMonitor {
  let level = start;
  let frames = 0;
  let seconds = 0;
  let warmupLeft: number = config.quality.warmupSeconds;
  let fastAttemptsInARow = 0;
  /** Levels this session dropped from, which it never rises back to. */
  const droppedFrom = new Set<QualityLevel>();

  function measuredFps(): number | null {
    return seconds >= config.quality.measureSeconds ? frames / seconds : null;
  }

  function sampleFrame(frameSeconds: number): void {
    if (frameSeconds > config.quality.maxSampleFrameSeconds || seconds >= config.quality.measureSeconds) return;
    if (warmupLeft > 0) {
      warmupLeft -= frameSeconds;
      return;
    }
    frames++;
    seconds += frameSeconds;
  }

  function nextAttempt(): QualityLevel {
    const fps = measuredFps();
    if (fps !== null) judge(fps);
    frames = 0;
    seconds = 0;
    warmupLeft = config.quality.warmupSeconds;
    return level;
  }

  function judge(fps: number): void {
    if (fps < config.quality.dropBelowFps - FPS_TOLERANCE) {
      droppedFrom.add(level);
      level = cheaperThan(level);
      fastAttemptsInARow = 0;
    } else if (fps >= config.quality.riseAtFps - FPS_TOLERANCE) {
      fastAttemptsInARow++;
      if (fastAttemptsInARow < config.quality.riseAfterAttempts) return;
      const better = betterThan(level);
      if (!droppedFrom.has(better)) level = better;
      fastAttemptsInARow = 0;
    } else {
      fastAttemptsInARow = 0;
    }
  }

  return { sampleFrame, measuredFps, nextAttempt };
}

function cheaperThan(level: QualityLevel): QualityLevel {
  return QUALITY_LEVELS[Math.min(QUALITY_LEVELS.indexOf(level) + 1, QUALITY_LEVELS.length - 1)]!;
}

function betterThan(level: QualityLevel): QualityLevel {
  return QUALITY_LEVELS[Math.max(QUALITY_LEVELS.indexOf(level) - 1, 0)]!;
}

/** The level an attempt is built with: the fixed one, or the monitor's under 'auto'. */
export function qualityForAttempt(setting: QualitySetting, monitor: QualityMonitor): QualityLevel {
  return setting === 'auto' ? monitor.nextAttempt() : setting;
}
