import { config } from '../config';
import { targetGrassTypes, type Game } from './game';
import type { BoosterKind, SaveData } from './save';

function inPlay(game: Game): boolean {
  return game.status === 'ready' || game.status === 'playing';
}

export function canUseBooster(game: Game, kind: BoosterKind): boolean {
  switch (kind) {
    case 'upgrade':
      return inPlay(game);
    case 'compass':
      return inPlay(game) && game.compassLeft <= 0;
    case 'clock':
      // From a defeat, the clock lets the player go on with the field as it was.
      return inPlay(game) || game.status === 'lost';
  }
}

/** Applies the booster to the game; does nothing and returns false when it cannot be used now. */
export function applyBooster(game: Game, kind: BoosterKind): boolean {
  if (!canUseBooster(game, kind)) return false;
  switch (kind) {
    case 'upgrade':
      game.blade.size += config.boosters.upgrade.sizes;
      break;
    case 'compass':
      game.compassLeft = config.boosters.compass.seconds;
      break;
    case 'clock':
      addTime(game, config.boosters.clock.seconds);
      break;
  }
  return true;
}

function addTime(game: Game, seconds: number): void {
  game.timeLeft += seconds;
  // The ring shows timeLeft / timeTotal, so it never goes past full.
  game.timeTotal = Math.max(game.timeTotal, game.timeLeft);
  if (game.status === 'lost') game.status = 'playing';
}

/** Spends one use from the save and applies it; false (no change) without uses or when it cannot be used. */
export function useBooster(save: SaveData, game: Game, kind: BoosterKind): boolean {
  if (save.boosters[kind] <= 0 || !applyBooster(game, kind)) return false;
  save.boosters[kind]--;
  return true;
}

/** Buys one use; false (no change) without coins. */
export function buyBooster(save: SaveData, kind: BoosterKind): boolean {
  const { price } = config.boosters[kind];
  if (save.coins < price) return false;
  save.coins -= price;
  save.boosters[kind]++;
  return true;
}

/** Defeat's «+30 s»: uses a clock, or buys one first when there is none and the coins reach. */
export function continueWithClock(save: SaveData, game: Game): boolean {
  if (!canUseBooster(game, 'clock')) return false;
  if (save.boosters.clock === 0 && !buyBooster(save, 'clock')) return false;
  return useBooster(save, game, 'clock');
}

/**
 * Position of the closest standing target unit (blade or piece) to (x, z), or null when none is left.
 * Walks every blade: about 3 400 every retargetSeconds while the compass points, which costs little.
 */
export function nearestTarget(game: Game, x: number, z: number): { x: number; z: number } | null {
  const { field, obstacles, level } = game;
  const grassTargets = targetGrassTypes(game);
  let nearest: { x: number; z: number } | null = null;
  let nearestDistance = Infinity;
  const consider = (candidateX: number, candidateZ: number) => {
    const distance = Math.hypot(candidateX - x, candidateZ - z);
    if (distance >= nearestDistance) return;
    nearestDistance = distance;
    nearest = { x: candidateX, z: candidateZ };
  };
  for (let blade = 0; blade < field.bladeCount; blade++) {
    if (field.cut[blade] === 0 && grassTargets.includes(field.types[blade]!)) consider(field.positionsX[blade]!, field.positionsZ[blade]!);
  }
  obstacles.obstacles.forEach((obstacle, index) => {
    if (obstacles.cut[index] === 0 && level.targets.some((target) => target === obstacle.type)) consider(obstacle.x, obstacle.z);
  });
  return nearest;
}
