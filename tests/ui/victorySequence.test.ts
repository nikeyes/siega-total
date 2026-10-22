import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../src/config';
import { createVictorySequence, victorySteps, type VictoryStep } from '../../src/ui/victorySequence';

describe('victorySteps', () => {
  it('brings in three stars in order, starIntervalSeconds apart', () => {
    const stars = victorySteps().filter(({ step }) => step.kind === 'star');
    expect(stars.map(({ step }) => step)).toEqual([
      { kind: 'star', index: 1 },
      { kind: 'star', index: 2 },
      { kind: 'star', index: 3 },
    ]);
    expect(stars[0]!.at).toBeCloseTo(config.effects.starsDelaySeconds);
    expect(stars[1]!.at - stars[0]!.at).toBeCloseTo(config.effects.starIntervalSeconds);
    expect(stars[2]!.at - stars[1]!.at).toBeCloseTo(config.effects.starIntervalSeconds);
  });

  it('drops the confetti right after the last star', () => {
    const steps = victorySteps();
    const lastStar = steps.filter(({ step }) => step.kind === 'star').at(-1)!;
    expect(steps.at(-1)!.step).toEqual({ kind: 'confetti' });
    expect(steps.at(-1)!.at).toBeGreaterThan(lastStar.at);
  });
});

describe('createVictorySequence', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('plays each step at its time', () => {
    const played: VictoryStep[] = [];
    createVictorySequence({ onStep: (step) => played.push(step) }).play();
    const [first, second] = victorySteps();
    vi.advanceTimersByTime(first!.at * 1000);
    expect(played).toEqual([first!.step]);
    vi.advanceTimersByTime((second!.at - first!.at) * 1000);
    expect(played).toEqual([first!.step, second!.step]);
    vi.runAllTimers();
    expect(played).toEqual(victorySteps().map(({ step }) => step));
  });

  it('plays none of the steps still pending once cancelled', () => {
    const played: VictoryStep[] = [];
    const sequence = createVictorySequence({ onStep: (step) => played.push(step) });
    sequence.play();
    vi.advanceTimersByTime(victorySteps()[0]!.at * 1000);
    sequence.cancel();
    vi.runAllTimers();
    expect(played).toEqual([victorySteps()[0]!.step]);
  });

  it('starts over, without playing any step twice, when played again', () => {
    const played: VictoryStep[] = [];
    const sequence = createVictorySequence({ onStep: (step) => played.push(step) });
    sequence.play();
    vi.advanceTimersByTime(victorySteps()[0]!.at * 1000);
    sequence.play();
    vi.runAllTimers();
    expect(played).toEqual([victorySteps()[0]!.step, ...victorySteps().map(({ step }) => step)]);
  });
});
