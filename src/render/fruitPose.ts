/** How a fruit is shown so it stands out of the grass like a pickup: bigger, floating on the grass tops, bobbing and turning. */
export const FRUIT_POSE = {
  /** Times its cutting radius. */
  scale: 1.5,
  /** Height of the fruit's base above the ground, about the grass tops. */
  restHeight: 0.5,
  bobMeters: 0.08,
  bobSeconds: 1.8,
  turnSeconds: 6,
  /** Each hit a fruit takes shrinks it this share of its size. */
  shrinkPerHit: 0.15,
  /** Radians the fruit tilts as a hit shakes it, settling over wobbleSeconds. */
  wobbleRadians: 0.35,
  wobbleSeconds: 0.3,
  /** Shakes back and forth this many times while it settles. */
  wobbleShakes: 3,
};

/** The fruit's height and turn at `time`; `phase`, from 0 to 1, keeps fruits out of step with each other. */
export function fruitPose(time: number, phase: number): { height: number; turn: number } {
  const { restHeight, bobMeters, bobSeconds, turnSeconds } = FRUIT_POSE;
  return {
    height: restHeight + bobMeters * Math.sin(2 * Math.PI * (time / bobSeconds + phase)),
    turn: (2 * Math.PI * time) / turnSeconds + 2 * Math.PI * phase,
  };
}

/** How big a fruit shows after `hitsTaken` hits, as a share of its whole size. */
export function fruitDamageScale(hitsTaken: number): number {
  return 1 - FRUIT_POSE.shrinkPerHit * hitsTaken;
}

/** The tilt, in radians, of a fruit `secondsSinceHit` after a hit: a quick shake that settles to 0. */
export function hitWobble(secondsSinceHit: number): number {
  const { wobbleRadians, wobbleSeconds, wobbleShakes } = FRUIT_POSE;
  if (!(secondsSinceHit < wobbleSeconds)) return 0;
  const progress = secondsSinceHit / wobbleSeconds;
  return wobbleRadians * (1 - progress) * Math.sin(2 * Math.PI * wobbleShakes * progress + Math.PI / 2);
}
