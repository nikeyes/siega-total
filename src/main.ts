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
import { bonusesFor, buyUpgrade } from './logic/upgrades';
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
import { createHomeScreen } from './ui/home';
import { setLayerVisible } from './ui/layer';
import { createPauseScreen } from './ui/pause';
import { createResultOverlay } from './ui/result';
import { createSettingsScreen } from './ui/settings';
import { createShopScreen } from './ui/shop';
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
const hud = createHud(container, { onPause: () => showScreen('paused') });
const resultOverlay = createResultOverlay(container, {
  onNext: () => {
    loadLevel(save.level);
    showScreen('playing');
  },
  onRetry: () => {
    restart();
    showScreen('playing');
  },
  onShop: () => openShop('result'),
  onHome: () => {
    // A win moved the saved level on; a defeat plays the same level again.
    if (game.status === 'won') loadLevel(save.level);
    else restart();
    showScreen('home');
  },
});
const homeScreen = createHomeScreen(container, {
  onPlay: () => {
    // Builds the game again, so upgrades bought from the home screen apply to it.
    if (game.level.number === save.level) restart();
    else loadLevel(save.level);
    showScreen('playing');
  },
  onShop: () => openShop('home'),
  onSettings: () => showScreen('settings'),
});
const shopScreen = createShopScreen(container, {
  onBuyUpgrade: (kind) => {
    if (!buyUpgrade(save, kind)) return;
    writeSave(save);
    renderSave();
  },
  onBack: () => showScreen(shopReturnsTo),
});
const pauseScreen = createPauseScreen(container, {
  onResume: () => showScreen('playing'),
  onRetry: () => {
    restart();
    showScreen('playing');
  },
  onHome: () => {
    // Leaving drops the coins of this attempt: only the end of a level banks them.
    restart();
    showScreen('home');
  },
});
const settingsScreen = createSettingsScreen(container, {
  onClearProgress: clearProgress,
  onBack: () => showScreen('home'),
});

/** What the player sees; the game only steps while it is 'playing' or showing the result. */
type Screen = 'home' | 'playing' | 'paused' | 'result' | 'shop' | 'settings';
let screen: Screen = 'home';
/** The shop's «Volver» goes back to where it was opened from. */
let shopReturnsTo: 'home' | 'result' = 'home';
const SCREEN_LAYERS: Partial<Record<Screen, HTMLElement>> = {
  home: homeScreen.layer,
  paused: pauseScreen.layer,
  result: resultOverlay.layer,
  shop: shopScreen.layer,
  settings: settingsScreen.layer,
};

function showScreen(next: Screen): void {
  screen = next;
  // The CSS hides the HUD on the screens away from the game.
  container!.dataset.screen = next;
  for (const [name, layer] of Object.entries(SCREEN_LAYERS)) setLayerVisible(layer, name === next);
  renderSave();
}

function openShop(from: 'home' | 'result'): void {
  shopReturnsTo = from;
  showScreen('shop');
}

/** Redraws what shows the save: the balance and level on the home screen and the shop rows. */
function renderSave(): void {
  homeScreen.render(save);
  shopScreen.render(save);
}

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
  game = createGame(level, bonusesFor(save.upgrades));
  grass = createGrassView(gameScene.scene, game.field, level.seed);
  obstacleView = createObstacleView(gameScene.scene, level.obstacles, obstacleModels, level.seed);
  hud.showLevel(level);
  focusOnBlade();
}

/** Plays level `levelNumber` of the progression. */
function loadLevel(levelNumber: number): void {
  playLevel(levelFor(levelNumber, campaignSeeds));
}

/** Plays the level again from the start, with the upgrades bought since it was created. */
function restart(): void {
  playLevel(game.level);
}

/** Adds what the level earned to the balance and, after a win, moves the saved level on. */
function saveLevelEnd(): void {
  save.coins += bankCoins(game);
  if (game.status === 'won' && game.level.number >= 1) save.level = game.level.number + 1;
  writeSave(save);
}

/** Forgets the saved game and starts over from level 1, on the home screen. */
function clearProgress(): void {
  clearSave();
  save = defaultSave();
  loadLevel(1);
  showScreen('home');
}

function focusOnBlade(): void {
  const { blade } = game;
  Object.assign(focus, createCameraFocus(blade.x, blade.z, blade.size));
}

loadLevel(save.level);
showScreen('home');

// Hiding the tab mid-level pauses it, so the clock does not run out unseen.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'playing' && game.status === 'playing') showScreen('paused');
});

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
      restart: () => {
        restart();
        showScreen('playing');
      },
      markCut: ({ blades, obstacles }) => {
        grass!.markCut(blades, elapsedSeconds);
        obstacleView!.markCut(obstacles);
      },
      playLevel: (level) => {
        playLevel(level);
        showScreen('playing');
      },
      giveCoins: (amount) => {
        save.coins += amount;
        writeSave(save);
        renderSave();
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
  // Away from the game the scene keeps drawing, but no time passes for the logic.
  const stepping = screen === 'playing' || screen === 'result';
  const direction = screen === 'playing' ? combineDirections(joystick.getDirection(), keyboard.getDirection()) : null;
  const statusBefore = game.status;
  const result = stepGame(game, direction, stepping ? dt : 0);
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
    showScreen('result');
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
    timeTotal: game.timeTotal,
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
