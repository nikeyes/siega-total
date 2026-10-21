import { config } from '../config';
import { GRASS_TYPE_ORDER } from './field';
import type { Game } from './game';
import { obstacleCoins } from './obstacles';

/** Coins of the blades, each paying its weight, and of the obstacles cut in one step. */
export function coinsForCuts(game: Game, cutIndices: readonly number[], cutObstacles: readonly number[]): number {
  const { types } = game.field;
  const { obstacles } = game.obstacles;
  const bladeCoins =
    game.bladeWeight * cutIndices.reduce((coins, blade) => coins + config.grassTypes[GRASS_TYPE_ORDER[types[blade]!]!].coins, 0);
  return cutObstacles.reduce((coins, index) => coins + obstacleCoins(obstacles[index]!.type), bladeCoins);
}

/** Bonus for winning with `timeLeft` seconds to spare. */
export function timeBonus(timeLeft: number): number {
  return Math.floor(timeLeft) * config.economy.coinsPerSecondLeft;
}

/** Whole coins of this attempt not yet in the balance: the level's coins rounded down, minus those banked. */
export function unbankedCoins(game: Game): number {
  return Math.floor(game.levelCoins + game.bonusCoins) - game.bankedCoins;
}

/** Whole coins earned since the last call, to add to the balance at the end of the level. */
export function bankCoins(game: Game): number {
  const earned = unbankedCoins(game);
  game.bankedCoins += earned;
  return earned;
}
