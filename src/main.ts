import { config } from './config';
import type { DebugPanel } from './debug/panel';
import { bladeRadius, growthFraction } from './logic/blade';
import { clampFocus, createCameraFocus, followBlade } from './logic/camera';
import { createGame, remainingTargets, resetGame, shouldHighlightTargets, stepGame, targetGrassTypes } from './logic/game';
import { isObstacleType } from './logic/levels';
import { combineDirections } from './logic/input';
import { createBladeView } from './render/blade';
import { createCameraRig, halfVisible } from './render/cameraRig';
import { createGrassView } from './render/grass';
import { createGameScene } from './render/scene';
import { createHud } from './ui/hud';
import { createJoystick } from './ui/joystick';
import { createKeyboard } from './ui/keyboard';
import { createResultOverlay } from './ui/result';
import './ui/styles.css';

/** Longest step the game takes, so coming back to the tab does not make the blade jump. */
const MAX_FRAME_SECONDS = 0.05;

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container');

const game = createGame();
const { field, blade } = game;
const gameScene = createGameScene(container, field.width, field.depth);
const grass = createGrassView(gameScene.scene, field, config.field.seed);
const bladeView = createBladeView(gameScene.scene);
const cameraRig = createCameraRig();
const focus = createCameraFocus(blade.x, blade.z, blade.size);
const joystick = createJoystick(container);
const keyboard = createKeyboard();
const firstTarget = game.level.targets[0]!;
// Phase 3 replaces the single bar with one counter per target.
const hud = createHud(container, isObstacleType(firstTarget) ? 'green' : firstTarget);
const initialTargets = remainingTargets(game);
const resultOverlay = createResultOverlay(container, restart);

/** Plays the level again from the start, keeping the scene. */
function restart(): void {
  resetGame(game);
  grass.reset();
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
  grass.setHighlight(shouldHighlightTargets(game) ? (targetGrassTypes(game)[0] ?? null) : null);
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
    remainingFraction: initialTargets === 0 ? 0 : remainingTargets(game) / initialTargets,
    size: blade.size,
    growthFraction: growthFraction(blade),
    sizeLabelX: bladeOnScreen.x,
    sizeLabelY: bladeOnScreen.y,
  });

  debugPanel?.update(realSeconds);
});
