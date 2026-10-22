import {
  AdditiveBlending,
  DataTexture,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RGBAFormat,
  type Scene,
} from 'three';
import { config } from '../config';
import { bladeRadius, type Blade } from '../logic/blade';
import type { GrassType } from '../logic/field';
import { BIOME_COLORS } from './biomes';

const GLOW_TEXTURE_SIZE = 64;
/** Between the blade's shadow (0.01) and the clippings on the ground (0.02). */
const GLOW_HEIGHT = 0.015;

export interface BladeGlowView {
  /** Follows the blade and grows with it. */
  update(blade: Blade): void;
  /** Tints the glow for `biome`. */
  setBiome(biome: GrassType): void;
}

/** A soft additive halo on the ground under the blade, config.world.glow.scale times its radius. */
export function createBladeGlow(scene: Scene): BladeGlowView {
  const alpha = radialGlowAlpha(GLOW_TEXTURE_SIZE);
  // Additive blending adds color × texture, so the falloff goes into every channel.
  const pixels = new Uint8Array(alpha.length * 4);
  alpha.forEach((value, pixel) => pixels.fill(value, pixel * 4, pixel * 4 + 4));
  const texture = new DataTexture(pixels, GLOW_TEXTURE_SIZE, GLOW_TEXTURE_SIZE, RGBAFormat);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;

  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: config.world.glow.opacity,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const glow = new Mesh(new PlaneGeometry(2, 2), material);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = GLOW_HEIGHT;
  scene.add(glow);

  function update(blade: Blade): void {
    glow.position.x = blade.x;
    glow.position.z = blade.z;
    glow.scale.setScalar(bladeRadius(blade.size) * config.world.glow.scale);
  }

  function setBiome(biome: GrassType): void {
    material.color.set(BIOME_COLORS[biome].glow);
  }

  return { update, setBiome };
}

/** Glow strength from 0 to 255 on a `size` × `size` square, row by row: `(1 − r²)²` from the middle out to the inscribed circle, 0 beyond it. */
export function radialGlowAlpha(size: number): Uint8Array {
  const alpha = new Uint8Array(size * size);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const radiusSquared = ((x + 0.5 - half) ** 2 + (y + 0.5 - half) ** 2) / half ** 2;
      alpha[y * size + x] = Math.round(255 * Math.max(0, 1 - radiusSquared) ** 2);
    }
  }
  return alpha;
}
