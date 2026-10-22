import {
  AmbientLight,
  BoxGeometry,
  Color,
  DataTexture,
  DirectionalLight,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  RepeatWrapping,
  RGBAFormat,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { config } from '../config';
import type { GrassType } from '../logic/field';
import { createRandom } from '../logic/random';
import { BIOME_COLORS, CLIFF_COLOR } from './biomes';
import { cliffPixels, groundPixels, valueNoise } from './groundTexture';

const SKY_COLOR = 0x2fb4ef;
const AMBIENT_LIGHT_INTENSITY = 1.2;
const SUN_INTENSITY = 1.5;
const GROUND_TEXTURE_SIZE = 128;
const GROUND_NOISE_CELLS = 8;
const GROUND_EDGE_DARKENING = 0.15;
const CLIFF_TEXTURE_SIZE = 64;
/** The cliff texture repeats every this many meters along the island's sides. */
const CLIFF_TILE_METERS = 2;
const TEXTURE_SEED = 7;
/** BoxGeometry's material order is +x, −x, +y, −y, +z, −z. */
const TOP_FACE = 2;

export interface GameScene {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  /** Fits the drawing buffer to the container size. */
  resize(): void;
  /** Draws at the screen's pixel ratio, up to `max`. */
  setMaxPixelRatio(max: number): void;
  /** Paints the island's ground in the colors of `biome`. */
  setBiome(biome: GrassType): void;
}

/** Renderer, lights and the island: a slab whose top face, at y = 0, spans the field from `(0, 0)` to `(width, depth)`. */
export function createGameScene(container: HTMLElement, width: number, depth: number): GameScene {
  const renderer = new WebGLRenderer({ antialias: true });
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color(SKY_COLOR);
  scene.add(new AmbientLight(0xffffff, AMBIENT_LIGHT_INTENSITY));
  const sun = new DirectionalLight(0xffffff, SUN_INTENSITY);
  sun.position.set(-10, 20, 10);
  scene.add(sun);

  const groundNoise = valueNoise(GROUND_TEXTURE_SIZE, GROUND_NOISE_CELLS, createRandom(TEXTURE_SEED));
  const cliffTexture = pixelTexture(cliffPixels(CLIFF_TEXTURE_SIZE, CLIFF_COLOR, createRandom(TEXTURE_SEED)), CLIFF_TEXTURE_SIZE);
  cliffTexture.wrapS = cliffTexture.wrapT = RepeatWrapping;
  cliffTexture.repeat.set(Math.max(width, depth) / CLIFF_TILE_METERS, config.world.slabThickness / CLIFF_TILE_METERS);
  const cliffMaterial = new MeshBasicMaterial({ map: cliffTexture });
  const groundMaterial = new MeshBasicMaterial();
  const faceMaterials = Array.from({ length: 6 }, (_, face) => (face === TOP_FACE ? groundMaterial : cliffMaterial));

  const slab = new Mesh(new BoxGeometry(width, config.world.slabThickness, depth), faceMaterials);
  slab.position.set(width / 2, -config.world.slabThickness / 2, depth / 2);
  scene.add(slab);

  function setBiome(biome: GrassType): void {
    groundMaterial.map?.dispose();
    groundMaterial.map = pixelTexture(
      groundPixels(GROUND_TEXTURE_SIZE, BIOME_COLORS[biome].ground, groundNoise, GROUND_EDGE_DARKENING),
      GROUND_TEXTURE_SIZE,
    );
    groundMaterial.needsUpdate = true;
  }

  function resize(): void {
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  function setMaxPixelRatio(max: number): void {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, max));
    resize();
  }

  setBiome('green');
  return { renderer, scene, resize, setMaxPixelRatio, setBiome };
}

/** A smooth sRGB texture from square RGBA pixels. */
function pixelTexture(pixels: Uint8Array, size: number): DataTexture {
  const texture = new DataTexture(pixels, size, size, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
