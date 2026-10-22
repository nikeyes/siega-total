/** How a fruit is shown so it stands out of the grass like a pickup: bigger, floating on the grass tops, bobbing and turning. */
export const FRUIT_POSE = {
  /** Times its cutting radius. */
  scale: 1.5,
  /** Height of the fruit's base above the ground, about the grass tops. */
  restHeight: 0.5,
  bobMeters: 0.08,
  bobSeconds: 1.8,
  turnSeconds: 6,
};

/** The fruit's height and turn at `time`; `phase`, from 0 to 1, keeps fruits out of step with each other. */
export function fruitPose(time: number, phase: number): { height: number; turn: number } {
  const { restHeight, bobMeters, bobSeconds, turnSeconds } = FRUIT_POSE;
  return {
    height: restHeight + bobMeters * Math.sin(2 * Math.PI * (time / bobSeconds + phase)),
    turn: (2 * Math.PI * time) / turnSeconds + 2 * Math.PI * phase,
  };
}
