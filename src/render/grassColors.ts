import type { GrassType } from '../logic/field';

/** Colors at the root and at the tip of each grass type's spikes, shared by the field and the HUD icons. */
export const GRASS_COLORS: Record<GrassType, { base: number; tip: number }> = {
  green: { base: 0x1f7a0c, tip: 0x8fe03a },
  ice: { base: 0x9fc3dd, tip: 0xf4fbff },
  // Wheat, lavender and bramble do not appear in M2; their colors are provisional.
  wheat: { base: 0xb8860b, tip: 0xf5d76e },
  lavender: { base: 0x6a4c93, tip: 0xc3a6e8 },
  bramble: { base: 0x1e3d1a, tip: 0x4f7a3a },
};
