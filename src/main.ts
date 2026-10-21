import { config } from './config';
import type { DebugPanel } from './debug/panel';
import { bladeRadius, growthFraction } from './logic/blade';
import { clampFocus, createCameraFocus, followBlade } from './logic/camera';
import {
  createGame,
  remainingByTarget,
  resetGame,
  shouldHighlightTargets,
  stepGame,
  targetGrassTypes,
} from './logic/game';
import { createBurstView } from './render/burst';
import { OBSTACLE_COLORS } from './render/obstacleColors';
import { placeholderObstacleModels } from './render/obstacleModels';
import { createObstacleView } from './render/obstacles';
import { combineDirections } from './logic/input';
import { createBladeView } from './render/blade';
import { createCameraRig, halfVisible } from './render/cameraRig';
import { createGrassView } from './render/grass';
import { createGameScene } from './render/scene';
import { createHud } from './ui/hud';
import { createJoystick } from './ui/joystick';
import { createKeyboard } from './ui/keyboard';
import { createBlockedNotice } from './ui/blockedNotice';
import { createResultOverlay } from './ui/result';
import './ui/styles.css';

/** Longest step the game takes, so coming back to the tab does not make the blade jump. */
const MAX_FRAME_SECONDS = 0.05;
/** Burst pieces thrown when a piece of each kind is cut; a cactus is bigger, so it throws more. */
const BURST_PIECES = { watermelon: 12, strawberry: 12, cactus: 24 } as const;

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container');

const game = createGame();
const { field, blade } = game;
const gameScene = createGameScene(container, field.width, field.depth);
const grass = createGrassView(gameScene.scene, field, game.level.seed);
const obstacleView = createObstacleView(gameScene.scene, game.level.obstacles, placeholderObstacleModels(), game.level.seed);
const burst = createBurstView(gameScene.scene);
const blockedNotice = createBlockedNotice();
const bladeView = createBladeView(gameScene.scene);
const cameraRig = createCameraRig();
const focus = createCameraFocus(blade.x, blade.z, blade.size);
const joystick = createJoystick(container);
const keyboard = createKeyboard();
const hud = createHud(container);
hud.showLevel(game.level);
const resultOverlay = createResultOverlay(container, restart);

/** Plays the level again from the start, keeping the scene. */
function restart(): void {
  resetGame(game);
  grass.reset();
  obstacleView.reset();
  Object.assign(focus, createCameraFocus(blade.x, blade.z, blade.size));
  resultOverlay.hide();
}

let debugPanel: DebugPanel | null = null;
if (new URLSearchParams(location.search).has('debug')) {
  // Debug only: exposes the game state so automated browser checks can read blade position and cutCount.
  Object.assign(window, { __siega: game });
  void import('./debug/panel').then(({ createDebugPanel }) => {
    debugPanel = createDebugPanel(game, {
      restart,
      markCut: (indices) => grass.markCut(indices, elapsedSeconds),
      markObstaclesCut: (indices) => obstacleView.markCut(indices),
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

  const direction = combineDirections(joystick.getDirection(), keyboard.getDirection());
  const statusBefore = game.status;
  const result = stepGame(game, direction, dt);
  grass.markCut(result.cutIndices, elapsedSeconds);
  obstacleView.markCut(result.cutObstacles);
  for (const index of result.cutObstacles) {
    const { type, x, z } = game.level.obstacles[index]!;
    if (type !== 'rock') burst.spawn(x, z, OBSTACLE_COLORS[type], BURST_PIECES[type]);
  }
  burst.update(dt);
  grass.setHighlight(shouldHighlightTargets(game) ? targetGrassTypes(game) : []);
  if (game.status !== statusBefore && (game.status === 'won' || game.status === 'lost')) {
    resultOverlay.show(game.status);
  }

  followBlade(focus, blade.x, blade.z, blade.size, dt);
  const { halfVisibleX, halfVisibleZ } = halfVisible(focus.distance, cameraRig.camera.aspect);
  const edgeMargin = bladeRadius(blade.size) + config.camera.edgeMarginMeters;
  clampFocus(focus, field.width, field.depth, halfVisibleX, halfVisibleZ, edgeMargin);

  bladeView.update(blade, dt);
  cameraRig.update(focus);
  grass.setTime(elapsedSeconds);
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
  });

  debugPanel?.update(realSeconds);
});
