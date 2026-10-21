import { campaignSeeds } from './campaign';
import { config } from './config';
import type { DebugPanel } from './debug/panel';
import { bladeRadius, growthFraction } from './logic/blade';
import { clampFocus, createCameraFocus, followBlade } from './logic/camera';
import { bankCoins } from './logic/economy';
import {
  createGame,
  remainingByTarget,
  resetGame,
  shouldHighlightTargets,
  stepGame,
  targetGrassTypes,
  type Game,
} from './logic/game';
import type { LevelDefinition } from './logic/levels';
import { levelFor } from './logic/progression';
import { defaultSave } from './logic/save';
import { createBurstView } from './render/burst';
import { OBSTACLE_COLORS } from './render/obstacleColors';
import { loadObstacleModels, placeholderObstacleModels, type ObstacleModels } from './render/obstacleModels';
import { createObstacleView, type ObstacleView } from './render/obstacles';
import { combineDirections } from './logic/input';
import { createBladeView } from './render/blade';
import { createCameraRig, halfVisible } from './render/cameraRig';
import { createGrassView, type GrassView } from './render/grass';
import { createGameScene } from './render/scene';
import { createHud } from './ui/hud';
import { createJoystick } from './ui/joystick';
import { createKeyboard } from './ui/keyboard';
import { createBlockedNotice } from './ui/blockedNotice';
import { createCoinFloats } from './ui/coinFloats';
import { createResultOverlay } from './ui/result';
import { clearSave, readSave, writeSave } from './ui/storage';
import './ui/styles.css';

/** Longest step the game takes, so coming back to the tab does not make the blade jump. */
const MAX_FRAME_SECONDS = 0.05;
/** Burst pieces thrown when a piece of each kind is cut; a cactus is bigger, so it throws more. */
const BURST_PIECES = { watermelon: 12, strawberry: 12, cactus: 24 } as const;

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container');

const gameScene = createGameScene(container, config.field.width, config.field.depth);
const burst = createBurstView(gameScene.scene);
const blockedNotice = createBlockedNotice();
const coinFloats = createCoinFloats();
const bladeView = createBladeView(gameScene.scene);
const cameraRig = createCameraRig();
const joystick = createJoystick(container);
const keyboard = createKeyboard();
const hud = createHud(container);
const resultOverlay = createResultOverlay(container, { onNext: () => loadLevel(save.level), onRetry: restart });

let save = readSave();

let game: Game;
let grass: GrassView | null = null;
let obstacleView: ObstacleView | null = null;
/** Shared by every level; the Kenney models replace the stand-ins once they load. */
let obstacleModels: ObstacleModels = placeholderObstacleModels();
const focus = createCameraFocus(0, 0, config.blade.startSize);

/** Swaps in a new level: frees the old views and builds new ones for its grass and obstacles. */
function playLevel(level: LevelDefinition): void {
  grass?.dispose();
  obstacleView?.dispose();
  game = createGame(level);
  grass = createGrassView(gameScene.scene, game.field, level.seed);
  obstacleView = createObstacleView(gameScene.scene, level.obstacles, obstacleModels, level.seed);
  hud.showLevel(level);
  focusOnBlade();
  resultOverlay.hide();
}

/** Plays level `levelNumber` of the progression. */
function loadLevel(levelNumber: number): void {
  playLevel(levelFor(levelNumber, campaignSeeds));
}

/** Plays the level again from the start, keeping the scene. */
function restart(): void {
  resetGame(game);
  grass!.reset();
  obstacleView!.reset();
  focusOnBlade();
  resultOverlay.hide();
}

/** Adds what the level earned to the balance and, after a win, moves the saved level on. */
function saveLevelEnd(): void {
  save.coins += bankCoins(game);
  if (game.status === 'won' && game.level.number >= 1) save.level = game.level.number + 1;
  writeSave(save);
}

/** Debug only: forgets the saved game and starts over from level 1. */
function clearProgress(): void {
  clearSave();
  save = defaultSave();
  loadLevel(1);
}

function focusOnBlade(): void {
  const { blade } = game;
  Object.assign(focus, createCameraFocus(blade.x, blade.z, blade.size));
}

loadLevel(save.level);

loadObstacleModels(import.meta.env.BASE_URL + 'models/').then(
  (loaded) => {
    obstacleModels = loaded;
    // Redraws the current level's obstacles with the real models, keeping the ones already cut hidden.
    obstacleView!.dispose();
    obstacleView = createObstacleView(gameScene.scene, game.level.obstacles, obstacleModels, game.level.seed);
    obstacleView.markCut([...game.obstacles.cut.keys()].filter((index) => game.obstacles.cut[index] === 1));
  },
  (error: unknown) => console.warn('Obstacle models failed to load; keeping the stand-ins.', error),
);

let debugPanel: DebugPanel | null = null;
if (new URLSearchParams(location.search).has('debug')) {
  // Debug only: exposes the current game so automated browser checks can read blade position and cutCount.
  Object.defineProperty(window, '__siega', { get: () => game });
  void import('./debug/panel').then(({ createDebugPanel }) => {
    debugPanel = createDebugPanel(() => game, {
      restart,
      markCut: ({ blades, obstacles }) => {
        grass!.markCut(blades, elapsedSeconds);
        obstacleView!.markCut(obstacles);
      },
      playLevel,
      giveCoins: (amount) => {
        save.coins += amount;
        writeSave(save);
      },
      clearSave: clearProgress,
    });
  });
}

function fitToContainer(): void {
  gameScene.resize();
  cameraRig.setAspect(container!.clientWidth / container!.clientHeight);
}
window.addEventListener('resize', fitToContainer);
fitToContainer();

let elapsedSeconds = 0;
let previousTimestamp: number | null = null;

gameScene.renderer.setAnimationLoop((timestamp: number) => {
  const realSeconds = previousTimestamp === null ? 0 : (timestamp - previousTimestamp) / 1000;
  previousTimestamp = timestamp;
  const dt = Math.min(realSeconds, MAX_FRAME_SECONDS);
  elapsedSeconds += dt;

  const { field, blade } = game;
  const direction = combineDirections(joystick.getDirection(), keyboard.getDirection());
  const statusBefore = game.status;
  const result = stepGame(game, direction, dt);
  grass!.markCut(result.cutIndices, elapsedSeconds);
  obstacleView!.markCut(result.cutObstacles);
  for (const index of result.cutObstacles) {
    const { type, x, z } = game.level.obstacles[index]!;
    if (type !== 'rock') burst.spawn(x, z, OBSTACLE_COLORS[type], BURST_PIECES[type]);
  }
  burst.update(dt);
  grass!.setHighlight(shouldHighlightTargets(game) ? targetGrassTypes(game) : []);
  if (game.status !== statusBefore && (game.status === 'won' || game.status === 'lost')) {
    saveLevelEnd();
    resultOverlay.show(game.status, { levelCoins: game.levelCoins, bonusCoins: game.bonusCoins });
  }

  followBlade(focus, blade.x, blade.z, blade.size, dt);
  const { halfVisibleX, halfVisibleZ } = halfVisible(focus.distance, cameraRig.camera.aspect);
  const edgeMargin = bladeRadius(blade.size) + config.camera.edgeMarginMeters;
  clampFocus(focus, field.width, field.depth, halfVisibleX, halfVisibleZ, edgeMargin);

  bladeView.update(blade, dt);
  cameraRig.update(focus);
  grass!.setTime(elapsedSeconds);
  gameScene.renderer.render(gameScene.scene, cameraRig.camera);

  const bladeOnScreen = cameraRig.toScreen(blade.x, 0, blade.z, container.clientWidth, container.clientHeight);
  hud.update({
    timeLeft: game.timeLeft,
    timeTotal: game.level.timeSeconds,
    remainingByTarget: remainingByTarget(game),
    size: blade.size,
    growthFraction: growthFraction(blade),
    sizeLabelX: bladeOnScreen.x,
    sizeLabelY: bladeOnScreen.y,
    showBlocked: blockedNotice.step(result.blocked, dt),
    // Banked coins are already in the balance, so only the rest of the level is added on top.
    coins: save.coins + game.levelCoins + game.bonusCoins - game.bankedCoins,
    floatCoins: coinFloats.step(result.coins, dt),
  });

  debugPanel?.update(realSeconds);
});
