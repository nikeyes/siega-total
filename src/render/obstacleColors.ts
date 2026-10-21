import type { ObstacleType } from '../logic/levels';

/** Color of each cuttable obstacle's burst pieces, shared by the field and the HUD icons. */
export const OBSTACLE_COLORS: Record<Exclude<ObstacleType, 'rock'>, number> = {
  watermelon: 0xe83f4b,
  strawberry: 0xd81e3a,
  cactus: 0x4caf50,
};
