import { config } from '../config';
import { fallbackLevel, generateLevel, type GeneratedLevel } from './generator';
import { validateLevel } from './validation';

/** Deterministic seed for attempt `attempt` of level `levelNumber`: both numbers mixed by an integer hash. */
export function attemptSeed(levelNumber: number, attempt: number): number {
  let hash = Math.imul(levelNumber, 0x9e3779b1) ^ Math.imul(attempt + 1, 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

/**
 * The first valid generated level of `levelNumber`, trying maxAttempts seeds from `firstAttempt` on;
 * the fallback level if none is valid, with the last attempt tried.
 */
export function firstValidLevel(levelNumber: number, firstAttempt = 0): GeneratedLevel & { attempt: number } {
  const lastAttempt = firstAttempt + config.generator.maxAttempts - 1;
  for (let attempt = firstAttempt; attempt <= lastAttempt; attempt++) {
    const level = generateLevel(levelNumber, attemptSeed(levelNumber, attempt));
    if (validateLevel(level).valid) return { ...level, attempt };
  }
  return { ...fallbackLevel(levelNumber), attempt: lastAttempt };
}

/** The campaign seed of the level if there is one, otherwise the first valid generated level. */
export function levelFor(levelNumber: number, campaign: Readonly<Record<number, number>> = {}): GeneratedLevel {
  const seed = campaign[levelNumber];
  if (seed !== undefined) return generateLevel(levelNumber, seed);
  const { attempt: _attempt, ...level } = firstValidLevel(levelNumber);
  return level;
}
