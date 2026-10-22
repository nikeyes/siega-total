import type { GrassType } from '../logic/field';

/**
 * Each biome, named after its dominant grass type: the island's ground and the glow under the blade.
 * The glow is added to the ground: on a ground near white it cannot show, and too bright a glow burns to white.
 */
export const BIOME_COLORS: Record<GrassType, { ground: number; glow: number }> = {
  green: { ground: 0xa6d84c, glow: 0xfff3a8 },
  ice: { ground: 0xc6dbe9, glow: 0xbfefff },
  wheat: { ground: 0xdcb86c, glow: 0xffd27a },
  lavender: { ground: 0xa3ad8c, glow: 0x9a5fb0 },
  bramble: { ground: 0x6e4c30, glow: 0xffb36b },
};

/** The island's earth sides, the same in every biome. */
export const CLIFF_COLOR = 0xc8783a;

export const SEA_COLORS = { base: 0x1fa8f0, streaks: 0x7fd6ff, foam: 0xeafcff };
