// The app icon's scene, built from the game's own pieces: a lawn of green grass with the blade spinning in the circle
// it has just cut, seen from a low camera aimed at its hub. scripts/render-icon.mjs renders it to public/icons.
import { PerspectiveCamera } from 'three';
import { config } from '../../src/config';
import { bladeRadius, createBlade } from '../../src/logic/blade';
import { createField, cutInCircle, levelFieldOptions } from '../../src/logic/field';
import type { LevelDefinition } from '../../src/logic/levels';
import { createBladeView } from '../../src/render/blade';
import { createBladeGlow } from '../../src/render/bladeGlow';
import { createGrassView } from '../../src/render/grass';
import { createGameScene } from '../../src/render/scene';
import { createSea } from '../../src/render/sea';

const SIDE = 16;
const BLADE_SIZE = 3;
/** Denser than any quality level, so the lawn looks lush at icon size. */
const BLADE_COUNT = 9000;
const CAMERA = { fovDegrees: 30, height: 4.2, back: 2.2 };
/** The cut circle is this many times the blade's radius, so a ring of mowed ground frames it. */
const CUT_CIRCLE_SCALE = 1.35;

const level: LevelDefinition = {
  number: 0,
  seed: 3,
  width: SIDE,
  depth: SIDE,
  cellSize: 1,
  cells: new Array(SIDE * SIDE).fill('green'),
  obstacles: [],
  targets: ['green'],
  timeSeconds: 60,
};

const container = document.getElementById('app')!;
const gameScene = createGameScene(container, SIDE, SIDE);
gameScene.renderer.setPixelRatio(1);
gameScene.setBiome('green');
createSea(gameScene.scene, SIDE, SIDE);
const field = createField(levelFieldOptions(level, BLADE_COUNT));
const grass = createGrassView(gameScene.scene, field, level.seed);
const center = SIDE / 2;
const blade = createBlade(center, center, BLADE_SIZE);
// The circle the blade has just cut, long enough ago for the cut blades to have dropped.
grass.markCut(cutInCircle(field, center, center, bladeRadius(BLADE_SIZE) * CUT_CIRCLE_SCALE, BLADE_SIZE), 0);
grass.setTime(10);
const bladeView = createBladeView(gameScene.scene);
// A slight turn, so no arm points straight at the camera.
bladeView.update(blade, 0.04);
const glow = createBladeGlow(gameScene.scene);
glow.setBiome('green');
glow.update(blade);

const camera = new PerspectiveCamera(CAMERA.fovDegrees, 1, 0.1, 200);
camera.position.set(center, CAMERA.height, center + CAMERA.back);
// Aimed at the hub, which spins 0.4 m above the ground.
camera.lookAt(center, 0.4, center);

/** Draws the icon at `size` pixels a side; the render script calls it before each screenshot. */
function renderIcon(size: number): void {
  container.style.width = `${size}px`;
  container.style.height = `${size}px`;
  gameScene.renderer.setSize(size, size);
  gameScene.renderer.render(gameScene.scene, camera);
}

declare global {
  interface Window {
    renderIcon: (size: number) => void;
    iconReady: boolean;
  }
}
window.renderIcon = renderIcon;
window.iconReady = true;
void config;
