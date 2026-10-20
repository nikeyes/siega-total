import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type Scene,
} from 'three';
import { GRASS_TYPE_ORDER, type Field } from '../logic/field';
import { createRandom } from '../logic/random';
import { GRASS_COLORS } from './grassColors';
import { changedInstanceRanges, layoutGrass, type GrassLayout } from './grassLayout';

/** Each field blade is drawn as a tuft of pointed spikes, so the field looks dense with few instances. */
const SPIKES_PER_TUFT = 7;
const SPIKE_BASE_WIDTH = 0.24;
const SPIKE_HEIGHT = 0.9;
/** How far each spike's base sits from the tuft centre. */
const SPIKE_SPREAD = 0.16;
/** How far each spike's tip leans out from its base. */
const SPIKE_LEAN = 0.22;
/** Each tuft's height is scaled by a random factor in [1 - variation, 1 + variation]. */
const TUFT_HEIGHT_VARIATION = 0.2;
/** Each tuft's brightness is scaled by a random factor in [1 - variation, 1 + variation]. */
const TUFT_SHADE_VARIATION = 0.12;
/** The two faces of a spike get different brightness, like a folded leaf lit from one side. */
const SPIKE_DARK_FACE_SHADE = 0.78;
const WIND_SWAY_METERS = 0.05;
/** Height a cut blade keeps, as a fraction of its standing height. */
const CUT_HEIGHT_FRACTION = 0.08;
/** A cut tuft also shrinks sideways, so the cut path shows the sand with only small clippings. */
const CUT_SPREAD_FRACTION = 0.35;
const CUT_DROP_SECONDS = 0.1;
const STANDING = -1;
/** Highlighted standing blades grow this much taller, so the last targets stand out. */
const HIGHLIGHT_HEIGHT_SCALE = 1.3;
/** Angular speed of the highlight's brightness pulse, in radians per second. */
const HIGHLIGHT_PULSE_SPEED = 6;
/** How far the highlight pulse brightens the color toward white at its peak. */
const HIGHLIGHT_BRIGHTENING = 0.5;

const vertexShader = /* glsl */ `
  attribute float relativeHeight;
  attribute float spikeShade;
  attribute float instanceCutTime;
  attribute float instanceShade;
  uniform float time;
  uniform float highlight;
  varying float vRelativeHeight;
  varying float vShade;
  varying float vHighlight;

  void main() {
    float heightScale = 1.0;
    float spreadScale = 1.0;
    vHighlight = 0.0;
    if (instanceCutTime < 0.0 && highlight > 0.5) {
      heightScale = ${HIGHLIGHT_HEIGHT_SCALE.toFixed(3)};
      vHighlight = 1.0;
    }
    if (instanceCutTime >= 0.0) {
      float dropProgress = clamp((time - instanceCutTime) / ${CUT_DROP_SECONDS.toFixed(3)}, 0.0, 1.0);
      heightScale = mix(1.0, ${CUT_HEIGHT_FRACTION.toFixed(3)}, dropProgress);
      spreadScale = mix(1.0, ${CUT_SPREAD_FRACTION.toFixed(3)}, dropProgress);
    }
    vec3 local = position;
    local.y *= heightScale;
    local.xz *= spreadScale;
    vec4 world = modelMatrix * instanceMatrix * vec4(local, 1.0);
    vec2 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
    float sway = sin(time * 2.0 + root.x * 0.5 + root.y * 0.3) * relativeHeight * relativeHeight;
    world.xz += sway * heightScale * ${WIND_SWAY_METERS.toFixed(3)};
    vRelativeHeight = relativeHeight;
    vShade = spikeShade * instanceShade;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 baseColor;
  uniform vec3 tipColor;
  uniform float time;
  varying float vRelativeHeight;
  varying float vShade;
  varying float vHighlight;

  void main() {
    vec3 color = mix(baseColor, tipColor, vRelativeHeight) * vShade;
    float pulse = 0.5 + 0.5 * sin(time * ${HIGHLIGHT_PULSE_SPEED.toFixed(3)});
    color += (vec3(1.0) - color) * ${HIGHLIGHT_BRIGHTENING.toFixed(3)} * pulse * vHighlight;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

export interface GrassView {
  setTime(time: number): void;
  /** Starts the drop animation of the given blades at `time`. */
  markCut(indices: number[], time: number): void;
  /** Puts every blade back to standing. */
  reset(): void;
  /** Makes the standing blades of `type` (an index into GRASS_TYPE_ORDER) glow; null turns it off. */
  setHighlight(type: number | null): void;
}

interface LayerView {
  readonly type: number;
  readonly cutTimes: Float32Array;
  readonly cutTimeAttribute: InstancedBufferAttribute;
  readonly shadeAttribute: InstancedBufferAttribute;
  readonly material: ShaderMaterial;
  readonly mesh: InstancedMesh;
}

/** One instanced draw call per grass type in the field, each with the colors of its type. */
export function createGrassView(scene: Scene, field: Field, seed: number): GrassView {
  const layout = layoutGrass(field);
  const geometry = createTuftGeometry();
  const layers = layout.layers.map(({ type, blades }) => createLayerView(geometry, type, blades.length));
  placeBlades(layers, layout, field, seed);
  for (const layer of layers) scene.add(layer.mesh);

  function setTime(time: number): void {
    for (const { material } of layers) material.uniforms.time!.value = time;
  }

  function markCut(indices: number[], time: number): void {
    for (const blade of indices) layers[layout.layerOf[blade]!]!.cutTimes[layout.instanceOf[blade]!] = time;
    changedInstanceRanges(layout, indices).forEach((range, layer) => {
      if (!range) return;
      const { cutTimeAttribute } = layers[layer]!;
      cutTimeAttribute.addUpdateRange(range.first, range.last - range.first + 1);
      cutTimeAttribute.needsUpdate = true;
    });
  }

  function reset(): void {
    for (const { cutTimes, cutTimeAttribute } of layers) {
      cutTimes.fill(STANDING);
      cutTimeAttribute.clearUpdateRanges();
      cutTimeAttribute.needsUpdate = true;
    }
  }

  function setHighlight(type: number | null): void {
    for (const layer of layers) layer.material.uniforms.highlight!.value = layer.type === type ? 1 : 0;
  }

  return { setTime, markCut, reset, setHighlight };
}

function createLayerView(tuftGeometry: BufferGeometry, type: number, instanceCount: number): LayerView {
  const cutTimes = new Float32Array(instanceCount).fill(STANDING);
  const cutTimeAttribute = new InstancedBufferAttribute(cutTimes, 1);
  cutTimeAttribute.setUsage(DynamicDrawUsage);

  // The tuft shape is shared; each layer only adds its own per-instance attributes.
  const geometry = new BufferGeometry();
  for (const name of Object.keys(tuftGeometry.attributes)) geometry.setAttribute(name, tuftGeometry.getAttribute(name));
  geometry.setAttribute('instanceCutTime', cutTimeAttribute);
  const shadeAttribute = new InstancedBufferAttribute(new Float32Array(instanceCount), 1);
  geometry.setAttribute('instanceShade', shadeAttribute);

  const colors = GRASS_COLORS[GRASS_TYPE_ORDER[type]!];
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: DoubleSide,
    uniforms: {
      time: { value: 0 },
      highlight: { value: 0 },
      baseColor: { value: new Color(colors.base) },
      tipColor: { value: new Color(colors.tip) },
    },
  });

  const mesh = new InstancedMesh(geometry, material, instanceCount);
  return { type, cutTimes, cutTimeAttribute, shadeAttribute, material, mesh };
}

/** Spikes fanned around the tuft centre, each a triangle from a wide base at y = 0 to a tip leaning outwards. */
function createTuftGeometry(): BufferGeometry {
  const positions: number[] = [];
  const relativeHeights: number[] = [];
  const shades: number[] = [];
  const halfBase = SPIKE_BASE_WIDTH / 2;
  for (let spike = 0; spike < SPIKES_PER_TUFT; spike++) {
    const angle = (spike / SPIKES_PER_TUFT) * Math.PI * 2;
    const outX = Math.cos(angle);
    const outZ = Math.sin(angle);
    // The spike's base runs across the outward direction.
    const acrossX = -outZ;
    const acrossZ = outX;
    const baseX = outX * SPIKE_SPREAD;
    const baseZ = outZ * SPIKE_SPREAD;
    const tipX = outX * (SPIKE_SPREAD + SPIKE_LEAN);
    const tipZ = outZ * (SPIKE_SPREAD + SPIKE_LEAN);
    const leftX = baseX - acrossX * halfBase;
    const leftZ = baseZ - acrossZ * halfBase;
    const rightX = baseX + acrossX * halfBase;
    const rightZ = baseZ + acrossZ * halfBase;
    // Two half-leaves meeting at a centre fold, so each half can be shaded differently.
    positions.push(leftX, 0, leftZ, baseX, 0, baseZ, tipX, SPIKE_HEIGHT, tipZ);
    positions.push(baseX, 0, baseZ, rightX, 0, rightZ, tipX, SPIKE_HEIGHT, tipZ);
    relativeHeights.push(0, 0, 1, 0, 0, 1);
    shades.push(1, 1, 1, SPIKE_DARK_FACE_SHADE, SPIKE_DARK_FACE_SHADE, SPIKE_DARK_FACE_SHADE);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('relativeHeight', new BufferAttribute(new Float32Array(relativeHeights), 1));
  geometry.setAttribute('spikeShade', new BufferAttribute(new Float32Array(shades), 1));
  return geometry;
}

/** Places, turns and shades every blade in field order, so each blade looks the same whatever its layer. */
function placeBlades(layers: LayerView[], layout: GrassLayout, field: Field, seed: number): void {
  const random = createRandom(seed);
  const matrix = new Matrix4();
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  const up = new Vector3(0, 1, 0);
  for (let blade = 0; blade < field.bladeCount; blade++) {
    const { mesh, shadeAttribute } = layers[layout.layerOf[blade]!]!;
    const instance = layout.instanceOf[blade]!;
    position.set(field.positionsX[blade]!, 0, field.positionsZ[blade]!);
    rotation.setFromAxisAngle(up, random() * Math.PI * 2);
    scale.set(1, 1 + (random() * 2 - 1) * TUFT_HEIGHT_VARIATION, 1);
    mesh.setMatrixAt(instance, matrix.compose(position, rotation, scale));
    shadeAttribute.setX(instance, 1 + (random() * 2 - 1) * TUFT_SHADE_VARIATION);
  }
  for (const { mesh, shadeAttribute } of layers) {
    mesh.instanceMatrix.needsUpdate = true;
    shadeAttribute.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
}
