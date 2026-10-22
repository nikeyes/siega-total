// Plays the campaign with a bot and prints, level by level, what a player earns, how much time is left and how big the blade gets.
// Run with `make simulate`; scripts/simulate.mjs loads this file through Vite, so it uses the game logic as it is.
import { campaignSeeds } from '../src/campaign';
import { config } from '../src/config';
import { bladeRadius, type Direction } from '../src/logic/blade';
import { bankCoins } from '../src/logic/economy';
import { GRASS_TYPE_ORDER } from '../src/logic/field';
import { createGame, remainingTargets, stepGame, type Game } from '../src/logic/game';
import { canCutObstacle } from '../src/logic/obstacles';
import { levelFor } from '../src/logic/progression';
import { createRandom } from '../src/logic/random';
import { defaultSave, type SaveData, type UpgradeKind } from '../src/logic/save';
import { bonusesFor, buyUpgrade, upgradePrice } from '../src/logic/upgrades';

const FRAME_SECONDS = 1 / 60;
/** A person does not retarget every frame; the bot looks for its next goal this often. */
const RETARGET_SECONDS = 0.3;
/** After bumping into a wall, the bot steers sideways this long to get round it. */
const DETOUR_SECONDS = 0.5;
/** A goal the bot bumped into on its way is left alone this long, so it tries another one. */
const AVOID_SECONDS = 3;
/** Goals closer than this to one being avoided are avoided too. */
const AVOID_METERS = 1.5;
/** A player who keeps losing a level stops trying it after this many attempts. */
const MAX_ATTEMPTS = 5;
const UPGRADE_KINDS: readonly UpgradeKind[] = ['startSize', 'speed', 'extraTime', 'growth'];

export interface LevelReport {
  level: number;
  attempts: number;
  won: boolean;
  levelSeconds: number;
  secondsLeft: number;
  cutCoins: number;
  bonusCoins: number;
  balance: number;
  finalSize: number;
  upgradesBought: string[];
}

interface Avoided {
  x: number;
  z: number;
  secondsLeft: number;
}

/** The nearest goal the blade can cut now and is not avoiding: a target if any, else anything that grows it. */
function nextGoal(game: Game, avoided: readonly Avoided[]): { x: number; z: number } | null {
  const { field, blade, obstacles, level } = game;
  const size = blade.size;
  const targetTypes = new Set(level.targets);
  let best: { x: number; z: number; score: number } | null = null;
  const consider = (x: number, z: number, isTarget: boolean) => {
    if (avoided.some((spot) => Math.hypot(spot.x - x, spot.z - z) < AVOID_METERS)) return;
    // Targets come first; growing is only worth a detour when no target can be cut.
    const score = Math.hypot(x - blade.x, z - blade.z) + (isTarget ? 0 : 1000);
    if (!best || score < best.score) best = { x, z, score };
  };
  for (let index = 0; index < field.bladeCount; index++) {
    if (field.cut[index] === 1) continue;
    const type = GRASS_TYPE_ORDER[field.types[index]!]!;
    if (config.grassTypes[type].minSize > size) continue;
    consider(field.positionsX[index]!, field.positionsZ[index]!, targetTypes.has(type));
  }
  obstacles.obstacles.forEach(({ type, x, z }, index) => {
    if (obstacles.cut[index] === 1 || !canCutObstacle(type, size)) return;
    consider(x, z, targetTypes.has(type as never));
  });
  return best;
}

/** Plays one attempt of `game` the way a quick, sensible player would; returns when the level is won or lost. */
export function playAttempt(game: Game, random: () => number): void {
  let goal: { x: number; z: number } | null = null;
  let secondsToRetarget = 0;
  let detour: Direction | null = null;
  let detourLeft = 0;
  let avoided: Avoided[] = [];
  while (game.status !== 'won' && game.status !== 'lost') {
    if (game.status === 'winWave') {
      stepGame(game, null, FRAME_SECONDS);
      continue;
    }
    secondsToRetarget -= FRAME_SECONDS;
    avoided = avoided.filter((spot) => (spot.secondsLeft -= FRAME_SECONDS) > 0);
    if (secondsToRetarget <= 0) {
      goal = nextGoal(game, avoided) ?? nextGoal(game, []);
      secondsToRetarget = RETARGET_SECONDS;
    }
    let direction: Direction | null = null;
    if (detourLeft > 0) {
      direction = detour;
      detourLeft -= FRAME_SECONDS;
    } else if (goal) {
      const dx = goal.x - game.blade.x;
      const dz = goal.z - game.blade.z;
      const distance = Math.hypot(dx, dz);
      if (distance > bladeRadius(game.blade.size) * 0.3) direction = { x: dx / distance, z: dz / distance };
      else secondsToRetarget = 0;
    }
    const result = stepGame(game, direction, FRAME_SECONDS);
    if (result.blocked && direction) {
      if (goal) avoided.push({ ...goal, secondsLeft: AVOID_SECONDS });
      const side = random() < 0.5 ? 1 : -1;
      detour = { x: -direction.z * side, z: direction.x * side };
      detourLeft = DETOUR_SECONDS;
      secondsToRetarget = 0;
    }
  }
}

/** Buys the cheapest upgrade it can afford, again and again; nothing when `buys` is false. */
function shop(save: SaveData, buys: boolean): string[] {
  const bought: string[] = [];
  while (buys) {
    const affordable = UPGRADE_KINDS.map((kind) => ({ kind, price: upgradePrice(kind, save.upgrades[kind]) }))
      .filter((offer): offer is { kind: UpgradeKind; price: number } => offer.price !== null && offer.price <= save.coins)
      .sort((a, b) => a.price - b.price);
    if (affordable.length === 0) break;
    buyUpgrade(save, affordable[0]!.kind);
    bought.push(affordable[0]!.kind);
  }
  return bought;
}

/** Plays levels 1 to `lastLevel` in a row, banking coins like the game and shopping after each level. */
export function simulateCampaign(lastLevel: number, buysUpgrades: boolean): LevelReport[] {
  const save = defaultSave();
  const random = createRandom(1);
  const reports: LevelReport[] = [];
  for (let number = 1; number <= lastLevel; number++) {
    const level = levelFor(number, campaignSeeds);
    let attempts = 0;
    let game: Game;
    do {
      attempts++;
      game = createGame(level, bonusesFor(save.upgrades));
      playAttempt(game, random);
      save.coins += bankCoins(game);
    } while (game.status === 'lost' && attempts < MAX_ATTEMPTS);
    const won = game.status === 'won';
    reports.push({
      level: number,
      attempts,
      won,
      levelSeconds: game.timeTotal,
      secondsLeft: won ? Math.floor(game.timeLeft) : 0,
      cutCoins: Math.floor(game.levelCoins),
      bonusCoins: game.bonusCoins,
      balance: save.coins,
      finalSize: game.blade.size,
      upgradesBought: shop(save, buysUpgrades),
    });
    if (!won) break;
  }
  return reports;
}

/** Remaining targets of a fresh game, so the report can tell a level the bot could not finish. */
export function targetsOf(levelNumber: number): number {
  return remainingTargets(createGame(levelFor(levelNumber, campaignSeeds)));
}
