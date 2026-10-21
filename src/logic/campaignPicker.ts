import { config } from '../config';
import { generateLevel, type GeneratedLevel } from './generator';
import type { PatternName } from './patterns';
import { attemptSeed } from './progression';
import { validateLevel } from './validation';

/**
 * A seed for each level from 1 to `lastLevel`: the first valid attempt whose pattern differs from the
 * `distinctPatternsBehind` levels before it and whose seed is not used yet, or else the first valid attempt.
 */
export function pickCampaign(lastLevel = config.campaign.levels): Record<number, number> {
  const campaign: Record<number, number> = {};
  const patterns: PatternName[] = [];
  const usedSeeds = new Set<number>();
  for (let number = 1; number <= lastLevel; number++) {
    const recentPatterns = patterns.slice(-config.campaign.distinctPatternsBehind);
    const level = pickLevel(number, (candidate) => !recentPatterns.includes(candidate.pattern) && !usedSeeds.has(candidate.seed));
    // With no valid attempt the level stays out, and levelFor falls back to the fallback level.
    if (!level) continue;
    campaign[number] = level.seed;
    patterns.push(level.pattern);
    usedSeeds.add(level.seed);
  }
  return campaign;
}

/** The first valid attempt of `levelNumber` that `fits`, or else its first valid attempt; undefined when none is valid. */
function pickLevel(levelNumber: number, fits: (level: GeneratedLevel) => boolean): GeneratedLevel | undefined {
  let firstValid: GeneratedLevel | undefined;
  for (let attempt = 0; attempt < config.generator.maxAttempts; attempt++) {
    const level = generateLevel(levelNumber, attemptSeed(levelNumber, attempt));
    if (!validateLevel(level).valid) continue;
    if (fits(level)) return level;
    firstValid ??= level;
  }
  return firstValid;
}
