import { Color, Mesh, PlaneGeometry, ShaderMaterial, Vector2, type Scene } from 'three';
import { config } from '../config';
import { SEA_COLORS } from './biomes';

/** The sea sits this share of the slab's thickness below the ground, so the cliff shows above it. */
const SEA_DEPTH_SHARE = 0.7;
/** Widest the foam reaches from the shore, in meters. */
const FOAM_METERS = 0.5;
/** How far, in meters, the foam's width breathes in and out. */
const FOAM_PULSE_METERS = 0.12;
/** Angular speed of the foam's breathing, in radians per second. */
const FOAM_PULSE_SPEED = 0.8;
/** The water is clear by the shore and deep from this far out, in meters. */
const DEEP_WATER_METERS = 6;
/** One wave leaves the shore every this many meters, and they fade out by WAVES_FADE_METERS. */
const WAVE_SPACING_METERS = 2.2;
const WAVES_FADE_METERS = 6;
/** Meters per second the waves travel out from the shore. */
const WAVE_SPEED = 0.4;
/** How far, in meters, noise bends each wave so it does not look ruled. */
const WAVE_WOBBLE_METERS = 1.2;

const vertexShader = /* glsl */ `
  varying vec2 vWorld;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float time;
  uniform vec2 islandCenter;
  uniform vec2 islandHalfSize;
  uniform vec3 shallowColor;
  uniform vec3 deepColor;
  uniform vec3 waveColor;
  uniform vec3 foamColor;
  varying vec2 vWorld;

  float hash(vec2 cell) {
    return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
  }

  /** Smoothed value noise from 0 to 1. */
  float valueNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 blend = fract(point);
    blend = blend * blend * (3.0 - 2.0 * blend);
    return mix(
      mix(hash(cell), hash(cell + vec2(1.0, 0.0)), blend.x),
      mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), blend.x),
      blend.y
    );
  }

  /** Four octaves of value noise, from 0 to about 1. */
  float layeredNoise(vec2 point) {
    float sum = 0.0;
    float weight = 0.5;
    for (int octave = 0; octave < 4; octave++) {
      sum += weight * valueNoise(point);
      point *= 2.03;
      weight *= 0.5;
    }
    return sum;
  }

  void main() {
    vec2 outside = max(abs(vWorld - islandCenter) - islandHalfSize, 0.0);
    float shoreDistance = length(outside);
    vec3 color = mix(shallowColor, deepColor, smoothstep(0.5, ${DEEP_WATER_METERS.toFixed(3)}, shoreDistance));

    // Bands that follow the shore and travel out from it, bent by noise and fading further out.
    float wobble = layeredNoise(vWorld * 0.4 + time * 0.05) * ${WAVE_WOBBLE_METERS.toFixed(3)};
    float phase = fract((shoreDistance + wobble - time * ${WAVE_SPEED.toFixed(3)}) / ${WAVE_SPACING_METERS.toFixed(3)});
    float wave = smoothstep(0.0, 0.06, phase) * smoothstep(0.22, 0.08, phase);
    wave *= 1.0 - smoothstep(1.0, ${WAVES_FADE_METERS.toFixed(3)}, shoreDistance);
    color = mix(color, waveColor, wave * 0.7);

    float foamWidth = ${FOAM_METERS.toFixed(3)} + ${FOAM_PULSE_METERS.toFixed(3)} * sin(time * ${FOAM_PULSE_SPEED.toFixed(3)});
    float foam = 1.0 - smoothstep(foamWidth * 0.4, foamWidth, shoreDistance);
    color = mix(color, foamColor, foam);

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

export interface SeaView {
  /** Moves the waves and the foam to `time`, unless the sea is still. */
  update(time: number): void;
  /** A still sea keeps the waves and the foam where they are. */
  setAnimated(animated: boolean): void;
}

/** Sea around the island (the field from `(0, 0)` to `(width, depth)` and its shore), as far as the camera reaches. */
export function createSea(scene: Scene, width: number, depth: number): SeaView {
  const { seaMargin, slabThickness } = config.world;
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      time: { value: 0 },
      islandCenter: { value: new Vector2(width / 2, depth / 2) },
      islandHalfSize: { value: new Vector2(width / 2 + config.field.shoreMeters, depth / 2 + config.field.shoreMeters) },
      shallowColor: { value: new Color(SEA_COLORS.shallow) },
      deepColor: { value: new Color(SEA_COLORS.deep) },
      waveColor: { value: new Color(SEA_COLORS.waves) },
      foamColor: { value: new Color(SEA_COLORS.foam) },
    },
  });
  const sea = new Mesh(new PlaneGeometry(width + seaMargin * 2, depth + seaMargin * 2), material);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(width / 2, -slabThickness * SEA_DEPTH_SHARE, depth / 2);
  scene.add(sea);

  let animated = true;

  function update(time: number): void {
    if (animated) material.uniforms.time!.value = time;
  }

  function setAnimated(next: boolean): void {
    animated = next;
  }

  return { update, setAnimated };
}
