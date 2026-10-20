import { config } from './config';
import type { Stats } from './debug/stats';
import { bladeRadius } from './logic/blade';
import { clampFocus, createCameraFocus, followBlade } from './logic/camera';
import { createGame, stepGame } from './logic/game';
import { combineDirections } from './logic/input';
import { createBladeView } from './render/blade';
import { createCameraRig, halfVisible } from './render/cameraRig';
import { createGrassView } from './render/grass';
import { createGameScene } from './render/scene';
import { createJoystick } from './ui/joystick';
import { createKeyboard } from './ui/keyboard';
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

let stats: Stats | null = null;
if (new URLSearchParams(location.search).has('debug')) {
  // Debug only: exposes the game state so automated browser checks can read blade position and cutCount.
  Object.assign(window, { __siega: game });
  void import('./debug/stats').then(({ createStats }) => {
    stats = createStats(container);
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
  const result = stepGame(game, direction, dt);
  grass.markCut(result.cutIndices, elapsedSeconds);

  followBlade(focus, blade.x, blade.z, blade.size, dt);
  const { halfVisibleX, halfVisibleZ } = halfVisible(focus.distance, cameraRig.camera.aspect);
  const edgeMargin = bladeRadius(blade.size) + config.camera.edgeMarginMeters;
  clampFocus(focus, field.width, field.depth, halfVisibleX, halfVisibleZ, edgeMargin);

  bladeView.update(blade, dt);
  cameraRig.update(focus);
  grass.setTime(elapsedSeconds);
  gameScene.renderer.render(gameScene.scene, cameraRig.camera);

  stats?.update(realSeconds, field.cutCount, field.bladeCount);
});
