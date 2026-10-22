import { Color, Mesh, PlaneGeometry, ShaderMaterial, Vector2, type Scene } from 'three';
import { config } from '../config';
import { SEA_COLORS } from './biomes';

/** The sea sits this share of the slab's thickness below the ground, so the cliff shows above it. */
const SEA_DEPTH_SHARE = 0.7;
/** The streaks drift this fast, in meters per second. */
const STREAK_SPEED = 0.15;
/** Widest the foam reaches from the shore, in meters. */
const FOAM_METERS = 0.6;
/** Angular speed of the foam's breathing, in radians per second. */
const FOAM_PULSE_SPEED = 0.8;

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
  uniform vec2 fieldSize;
  uniform vec3 baseColor;
  uniform vec3 streakColor;
  uniform vec3 foamColor;
  varying vec2 vWorld;

  void main() {
    vec2 warped = vWorld + vec2(sin(vWorld.y * 0.35 + time * 0.3) * 1.2, sin(vWorld.x * 0.25) * 0.8);
    float streak = smoothstep(0.94, 1.0, abs(sin((warped.x + warped.y * 0.4 - time * ${STREAK_SPEED.toFixed(3)}) * 0.9)));
    vec3 color = mix(baseColor, streakColor, streak * 0.6);

    vec2 outside = max(abs(vWorld - fieldSize * 0.5) - fieldSize * 0.5, 0.0);
    float shoreDistance = length(outside);
    float foamWidth = ${FOAM_METERS.toFixed(3)} * (0.75 + 0.25 * sin(time * ${FOAM_PULSE_SPEED.toFixed(3)}));
    float foam = 1.0 - smoothstep(foamWidth * 0.5, foamWidth, shoreDistance);
    color = mix(color, foamColor, foam);

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

export interface SeaView {
  /** Moves the streaks and the foam to `time`, unless the sea is still. */
  update(time: number): void;
  /** A still sea keeps the streaks and foam where they are. */
  setAnimated(animated: boolean): void;
}

/** Sea around the island that spans the field from `(0, 0)` to `(width, depth)`, as far as the camera reaches. */
export function createSea(scene: Scene, width: number, depth: number): SeaView {
  const { seaMargin, slabThickness } = config.world;
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      time: { value: 0 },
      fieldSize: { value: new Vector2(width, depth) },
      baseColor: { value: new Color(SEA_COLORS.base) },
      streakColor: { value: new Color(SEA_COLORS.streaks) },
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
