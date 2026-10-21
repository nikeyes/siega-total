import { config } from '../config';
import { GRASS_TYPE_ORDER } from './field';
import type { Game } from './game';
import { obstacleCoins } from './obstacles';

/** Coins of the blades and obstacles cut in one step. */
export function coinsForCuts(game: Game, cutIndices: readonly number[], cutObstacles: readonly number[]): number {
  const { types } = game.field;
  const { obstacles } = game.obstacles;
  const bladeCoins = cutIndices.reduce((coins, blade) => coins + config.grassTypes[GRASS_TYPE_ORDER[types[blade]!]!].coins, 0);
  return cutObstacles.reduce((coins, index) => coins + obstacleCoins(obstacles[index]!.type), bladeCoins);
}

/** Bonus for winning with `timeLeft` seconds to spare. */
export function timeBonus(timeLeft: number): number {
  return Math.floor(timeLeft) * config.economy.coinsPerSecondLeft;
}

/** Coins earned since the last call, to add to the balance at the end of the level. */
export function bankCoins(game: Game): number {
  const earned = game.levelCoins + game.bonusCoins - game.bankedCoins;
  game.bankedCoins += earned;
  return earned;
}
