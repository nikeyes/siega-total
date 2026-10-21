import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { createQualityMonitor, nextQualitySetting, qualityForAttempt, type QualityLevel, type QualityMonitor, type QualitySetting } from '../../src/logic/quality';

const { dropBelowFps, riseAtFps } = config.quality;
/** Slow enough to drop a level. */
const SLOW_FPS = dropBelowFps - 10;
/** Fast enough to count toward a rise. */
const FAST_FPS = riseAtFps + 2;
/** Neither slow nor fast. */
const BETWEEN_FPS = (dropBelowFps + riseAtFps) / 2;
/** Much slower than anything measured, to show what is left out. */
const STUTTER_FPS = 20;

/** Plays `seconds` of frames at `fps` into the current attempt. */
function playFrames(monitor: QualityMonitor, fps: number, seconds: number): void {
  for (let frame = 0; frame < Math.round(seconds * fps); frame++) monitor.sampleFrame(1 / fps);
}

/** Plays one attempt of `seconds` at `fps` and gives the level of the next one. */
function attemptAt(monitor: QualityMonitor, fps: number, seconds = 4): QualityLevel {
  playFrames(monitor, fps, seconds);
  return monitor.nextAttempt();
}

describe('quality monitor', () => {
  it('stays at medium while no frames are played', () => {
    const monitor = createQualityMonitor();
    expect([monitor.nextAttempt(), monitor.nextAttempt(), monitor.nextAttempt()]).toEqual(['medium', 'medium', 'medium']);
  });

  it('drops one level after an attempt below the drop threshold, and no further than low', () => {
    const monitor = createQualityMonitor();
    expect([attemptAt(monitor, SLOW_FPS), attemptAt(monitor, SLOW_FPS)]).toEqual(['low', 'low']);
  });

  it('rises one level only after two attempts in a row at the rise threshold', () => {
    const monitor = createQualityMonitor();
    expect([attemptAt(monitor, FAST_FPS), attemptAt(monitor, FAST_FPS)]).toEqual(['medium', 'high']);
  });

  it('never rises back to a level it dropped from', () => {
    const monitor = createQualityMonitor('high');
    expect([attemptAt(monitor, SLOW_FPS), attemptAt(monitor, FAST_FPS), attemptAt(monitor, FAST_FPS), attemptAt(monitor, FAST_FPS)]).toEqual([
      'medium',
      'medium',
      'medium',
      'medium',
    ]);
  });

  it('starts the rise streak over after an attempt between the two thresholds', () => {
    const monitor = createQualityMonitor();
    expect([attemptAt(monitor, FAST_FPS), attemptAt(monitor, BETWEEN_FPS), attemptAt(monitor, FAST_FPS)]).toEqual(['medium', 'medium', 'medium']);
  });

  it('leaves out frames longer than a hiccup, like a hidden tab', () => {
    const monitor = createQualityMonitor();
    playFrames(monitor, FAST_FPS, 2);
    monitor.sampleFrame(0.5);
    playFrames(monitor, FAST_FPS, 2);
    expect(monitor.measuredFps()).toBeCloseTo(FAST_FPS, 0);
  });

  it('gives no verdict on an attempt too short to measure, and keeps the rise streak', () => {
    const monitor = createQualityMonitor();
    expect([attemptAt(monitor, FAST_FPS), attemptAt(monitor, STUTTER_FPS, 2), attemptAt(monitor, FAST_FPS)]).toEqual(['medium', 'medium', 'high']);
  });

  it('measures no fps until measureSeconds are in, and the attempt\'s fps after', () => {
    const monitor = createQualityMonitor();
    playFrames(monitor, SLOW_FPS, config.quality.warmupSeconds + config.quality.measureSeconds / 2);
    expect(monitor.measuredFps()).toBeNull();
    playFrames(monitor, SLOW_FPS, config.quality.measureSeconds);
    expect(monitor.measuredFps()).toBeCloseTo(SLOW_FPS, 0);
  });
});

describe('quality for an attempt', () => {
  it('builds a fixed level as it is, without spending the monitor\'s attempt', () => {
    const monitor = createQualityMonitor();
    playFrames(monitor, SLOW_FPS, 4);
    expect(qualityForAttempt('low', monitor)).toBe('low');
    expect(monitor.measuredFps()).toBeCloseTo(SLOW_FPS, 0);
  });

  it('follows the monitor under auto', () => {
    const monitor = createQualityMonitor();
    playFrames(monitor, SLOW_FPS, 4);
    expect(qualityForAttempt('auto', monitor)).toBe('low');
  });
});

describe('quality setting', () => {
  it('goes auto, high, medium, low and back to auto', () => {
    const seen: QualitySetting[] = ['auto'];
    for (let tap = 0; tap < 4; tap++) seen.push(nextQualitySetting(seen[tap]!));
    expect(seen).toEqual(['auto', 'high', 'medium', 'low', 'auto']);
  });
});

describe('quality monitor edge cases', () => {
  it('does not drop at exactly the drop threshold', () => {
    const monitor = createQualityMonitor();
    expect(attemptAt(monitor, dropBelowFps)).toBe('medium');
  });

  it('drops just below the drop threshold', () => {
    const monitor = createQualityMonitor();
    expect(attemptAt(monitor, dropBelowFps - 1)).toBe('low');
  });

  it('counts exactly the rise threshold toward the rise', () => {
    const monitor = createQualityMonitor();
    attemptAt(monitor, riseAtFps);
    expect(attemptAt(monitor, riseAtFps)).toBe('high');
  });

  it('counts a frame exactly as long as the longest sampled frame', () => {
    const monitor = createQualityMonitor();
    playFrames(monitor, 1 / config.quality.maxSampleFrameSeconds, 1);
    playFrames(monitor, 1 / config.quality.maxSampleFrameSeconds, config.quality.measureSeconds);
    expect(monitor.measuredFps()).toBeCloseTo(1 / config.quality.maxSampleFrameSeconds, 1);
  });

  it('judges only the first measureSeconds of an attempt', () => {
    const monitor = createQualityMonitor();
    playFrames(monitor, FAST_FPS, config.quality.warmupSeconds + config.quality.measureSeconds);
    playFrames(monitor, STUTTER_FPS, 5);
    expect(monitor.nextAttempt()).toBe('medium');
  });

  it('stays at high after fast attempts', () => {
    const monitor = createQualityMonitor('high');
    expect([attemptAt(monitor, FAST_FPS), attemptAt(monitor, FAST_FPS), attemptAt(monitor, FAST_FPS)]).toEqual(['high', 'high', 'high']);
  });

  it('rises from low to medium and then to high when it never dropped', () => {
    const monitor = createQualityMonitor('low');
    const levels = Array.from({ length: 4 }, () => attemptAt(monitor, FAST_FPS));
    expect(levels).toEqual(['low', 'medium', 'medium', 'high']);
  });

  it('starts the rise streak over after a drop', () => {
    const monitor = createQualityMonitor('high');
    attemptAt(monitor, FAST_FPS);
    expect([attemptAt(monitor, SLOW_FPS), attemptAt(monitor, FAST_FPS)]).toEqual(['medium', 'medium']);
  });

  it('keeps measuring after the level is fixed and set back to auto', () => {
    const monitor = createQualityMonitor();
    qualityForAttempt('high', monitor);
    playFrames(monitor, SLOW_FPS, 4);
    expect(qualityForAttempt('auto', monitor)).toBe('low');
  });

  it('gives a fresh measurement to every attempt', () => {
    const monitor = createQualityMonitor();
    playFrames(monitor, SLOW_FPS, 4);
    monitor.nextAttempt();
    expect(monitor.measuredFps()).toBeNull();
  });

  it('leaves the warmup out of every attempt, not only the first', () => {
    const monitor = createQualityMonitor();
    attemptAt(monitor, FAST_FPS);
    playFrames(monitor, STUTTER_FPS, config.quality.warmupSeconds);
    playFrames(monitor, FAST_FPS, 4);
    expect(monitor.measuredFps()).toBeCloseTo(FAST_FPS, 0);
  });

  it('starts the rise streak over after a slow attempt, even at low where it cannot drop', () => {
    const monitor = createQualityMonitor('low');
    expect([attemptAt(monitor, FAST_FPS), attemptAt(monitor, SLOW_FPS), attemptAt(monitor, FAST_FPS)]).toEqual(['low', 'low', 'low']);
  });
});
