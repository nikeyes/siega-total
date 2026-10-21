import GUI from 'lil-gui';
import { campaignSeeds } from '../campaign';
import { config } from '../config';
import { cutAllTargets, remainingTargets, type Game } from '../logic/game';
import { generateLevel } from '../logic/generator';
import type { LevelDefinition } from '../logic/levels';
import { firstValidLevel, levelFor } from '../logic/progression';
import { validateLevel } from '../logic/validation';
import { texts } from '../texts';

/** The FPS shown is the average over this window. */
const FPS_WINDOW_SECONDS = 0.5;
/** Coins the «Dar monedas» button adds, enough to buy a few upgrades. */
const DEBUG_GIFT_COINS = 10_000;

/** Settings read only when the level restarts; the panel labels them so. */
const READ_ON_RESTART = new Set([
  'blade.startSize',
  'level.timeSeconds',
  'obstacles.rock.radius',
  'obstacles.cactus.radius',
  'obstacles.watermelon.radius',
  'obstacles.strawberry.radius',
]);
/** Upgrade settings that apply when the game is built again. */
const UPGRADE_SETTINGS_READ_ON_RESTART = /^upgrades\.\w+\.(basePrice|priceGrowth|perLevel)$/;
/** Settings that need the field built again, so the panel leaves them out. */
const NOT_TUNABLE = new Set(['level.stripeWidthMeters']);

export interface DebugPanel {
  update(dt: number): void;
}

export interface DebugActions {
  restart(): void;
  /** Shows the given blades and obstacles as cut on the field. */
  markCut(cut: { blades: number[]; obstacles: number[] }): void;
  /** Plays `level` as level `level.number`. */
  playLevel(level: LevelDefinition): void;
  /** Adds `amount` to the saved balance. */
  giveCoins(amount: number): void;
  /** Forgets the saved game and starts again from level 1. */
  clearSave(): void;
}

/** A nested group of numeric settings, like `config.generator`. */
interface NumberTree {
  [key: string]: number | NumberTree;
}

/** lil-gui panel to tune `config` live, pick levels and seeds, jump to the end of a level and watch the game. */
export function createDebugPanel(getGame: () => Game, actions: DebugActions): DebugPanel {
  const gui = new GUI();

  addNumberFolder(gui, 'blade', config.blade);
  addNumberFolder(gui, 'camera', config.camera);
  addNumberFolder(gui, 'level', config.level, (path, value) => {
    if (path !== 'level.timeSeconds') return;
    const game = getGame();
    game.level.timeSeconds = value;
    // A game not started yet shows the new time at once; one in play keeps its clock until it restarts.
    if (game.status === 'ready') game.timeLeft = game.timeTotal = value + game.bonuses.extraSeconds;
  });
  addNumberFolder(gui, 'grassTypes', config.grassTypes);
  addNumberFolder(gui, 'obstacles', config.obstacles);
  addNumberFolder(gui, 'collision', config.collision);
  addNumberFolder(gui, 'economy', config.economy);
  addNumberFolder(gui, 'upgrades', config.upgrades);
  addNumberFolder(gui, 'boosters', config.boosters);
  addNumberFolder(gui, 'generator', config.generator, () => {}, texts.debug.onGenerate);

  addLevelFolder(gui, getGame, actions);

  gui.add({ [texts.debug.win]: () => actions.markCut(cutAllTargets(getGame())) }, texts.debug.win);
  gui.add({ [texts.debug.threeSeconds]: () => (getGame().timeLeft = 3) }, texts.debug.threeSeconds);
  gui.add({ [texts.debug.restart]: () => actions.restart() }, texts.debug.restart);
  gui.add({ [texts.debug.giveCoins]: () => actions.giveCoins(DEBUG_GIFT_COINS) }, texts.debug.giveCoins);
  gui.add({ [texts.debug.clearSave]: () => actions.clearSave() }, texts.debug.clearSave);
  gui.add(
    { [texts.debug.copyConfig]: () => void navigator.clipboard.writeText(JSON.stringify(config, null, 2)) },
    texts.debug.copyConfig,
  );

  const monitor = { fps: 0, bladesCut: '', targetsLeft: 0, status: '', level: 0, seed: 0, pattern: '', rejection: '' };
  const monitorFolder = gui.addFolder('monitor');
  monitorFolder.add(monitor, 'fps').name(texts.debug.fps).disable().listen();
  monitorFolder.add(monitor, 'level').name(texts.debug.level).disable().listen();
  monitorFolder.add(monitor, 'seed').name(texts.debug.seed).disable().listen();
  monitorFolder.add(monitor, 'pattern').name(texts.debug.pattern).disable().listen();
  monitorFolder.add(monitor, 'rejection').name(texts.debug.rejection).disable().listen();
  monitorFolder.add(monitor, 'bladesCut').name(texts.debug.bladesCut).disable().listen();
  monitorFolder.add(monitor, 'targetsLeft').name(texts.debug.targetsLeft).disable().listen();
  monitorFolder.add(monitor, 'status').name(texts.debug.status).disable().listen();

  let windowSeconds = 0;
  let windowFrames = 0;
  let checkedLevel: LevelDefinition | null = null;

  function update(dt: number): void {
    windowSeconds += dt;
    windowFrames++;
    if (windowSeconds >= FPS_WINDOW_SECONDS) {
      monitor.fps = Math.round(windowFrames / windowSeconds);
      windowSeconds = 0;
      windowFrames = 0;
    }
    const game = getGame();
    if (game.level !== checkedLevel) {
      checkedLevel = game.level;
      const validation = validateLevel(game.level);
      monitor.level = game.level.number;
      monitor.seed = game.level.seed;
      monitor.pattern = 'pattern' in game.level ? String(game.level.pattern) : '-';
      monitor.rejection = validation.valid ? '-' : validation.reason;
    }
    monitor.bladesCut = `${game.field.cutCount} / ${game.field.bladeCount}`;
    monitor.targetsLeft = remainingTargets(game);
    monitor.status = game.status;
  }

  return { update };
}

/** Level number and seed fields, with buttons to play a level, a seed or the next valid seed, and to copy it for the campaign. */
function addLevelFolder(gui: GUI, getGame: () => Game, actions: DebugActions): void {
  const chosen = { level: getGame().level.number, seed: getGame().level.seed };
  /** The generator attempt the level being played came from; -1 when it came from a typed or campaign seed. */
  let attempt = -1;
  const folder = gui.addFolder(texts.debug.level);
  const levelField = folder.add(chosen, 'level', 1, 999, 1).name(texts.debug.level);
  const seedField = folder.add(chosen, 'seed').name(texts.debug.seed);

  function play(level: LevelDefinition, fromAttempt: number): void {
    attempt = fromAttempt;
    chosen.seed = level.seed;
    seedField.updateDisplay();
    actions.playLevel(level);
  }

  const goToLevel = () => {
    const number = chosen.level;
    if (campaignSeeds[number] !== undefined) play(levelFor(number, campaignSeeds), -1);
    else {
      const level = firstValidLevel(number);
      play(level, level.attempt);
    }
  };
  const loadSeed = () => play(generateLevel(chosen.level, chosen.seed), -1);
  const anotherSeed = () => {
    const level = firstValidLevel(chosen.level, attempt + 1);
    play(level, level.attempt);
  };
  const copySeed = () => void navigator.clipboard.writeText(`  ${chosen.level}: ${getGame().level.seed},`);

  folder.add({ [texts.debug.goToLevel]: goToLevel }, texts.debug.goToLevel);
  folder.add({ [texts.debug.loadSeed]: loadSeed }, texts.debug.loadSeed);
  folder.add({ [texts.debug.anotherSeed]: anotherSeed }, texts.debug.anotherSeed);
  folder.add({ [texts.debug.copySeed]: copySeed }, texts.debug.copySeed);
  levelField.updateDisplay();
}

/** One numeric control per value of `settings`, in a folder called `name`, with a subfolder per nested group. */
function addNumberFolder(
  parent: GUI,
  name: string,
  settings: NumberTree,
  onChange: (path: string, value: number) => void = () => {},
  note = '',
  path = name,
): void {
  const folder = parent.addFolder(name);
  for (const [key, value] of Object.entries(settings)) {
    const keyPath = `${path}.${key}`;
    if (NOT_TUNABLE.has(keyPath)) continue;
    if (typeof value === 'object') {
      addNumberFolder(folder, key, value, onChange, note, keyPath);
      continue;
    }
    const keyNote = READ_ON_RESTART.has(keyPath) || UPGRADE_SETTINGS_READ_ON_RESTART.test(keyPath) ? texts.debug.onRestart : note;
    const label = keyNote ? `${key} ${keyNote}` : key;
    folder.add(settings, key).name(label).onChange((changed: number) => onChange(keyPath, changed));
  }
  folder.close();
}
