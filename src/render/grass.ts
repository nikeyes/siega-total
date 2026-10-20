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
import type { Field } from '../logic/field';
import { createRandom } from '../logic/random';

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
const BASE_COLOR = 0x1f7a0c;
const TIP_COLOR = 0x8fe03a;
const WIND_SWAY_METERS = 0.05;
/** Height a cut blade keeps, as a fraction of its standing height. */
const CUT_HEIGHT_FRACTION = 0.08;
/** A cut tuft also shrinks sideways, so the cut path shows the sand with only small clippings. */
const CUT_SPREAD_FRACTION = 0.35;
const CUT_DROP_SECONDS = 0.1;
const STANDING = -1;

const vertexShader = /* glsl */ `
  attribute float relativeHeight;
  attribute float spikeShade;
  attribute float instanceCutTime;
  attribute float instanceShade;
  uniform float time;
  varying float vRelativeHeight;
  varying float vShade;

  void main() {
    float heightScale = 1.0;
    float spreadScale = 1.0;
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
  varying float vRelativeHeight;
  varying float vShade;

  void main() {
    gl_FragColor = vec4(mix(baseColor, tipColor, vRelativeHeight) * vShade, 1.0);
    #include <colorspace_fragment>
  }
`;

export interface GrassView {
  setTime(time: number): void;
  /** Starts the drop animation of the given blades at `time`. */
  markCut(indices: number[], time: number): void;
}

/** One instanced draw call for every blade in the field. */
export function createGrassView(scene: Scene, field: Field, seed: number): GrassView {
  const cutTimes = new Float32Array(field.bladeCount).fill(STANDING);
  const cutTimeAttribute = new InstancedBufferAttribute(cutTimes, 1);
  cutTimeAttribute.setUsage(DynamicDrawUsage);

  const geometry = createTuftGeometry();
  geometry.setAttribute('instanceCutTime', cutTimeAttribute);
  geometry.setAttribute('instanceShade', new InstancedBufferAttribute(new Float32Array(field.bladeCount), 1));

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: DoubleSide,
    uniforms: {
      time: { value: 0 },
      baseColor: { value: new Color(BASE_COLOR) },
      tipColor: { value: new Color(TIP_COLOR) },
    },
  });

  const mesh = new InstancedMesh(geometry, material, field.bladeCount);
  placeBlades(mesh, field, seed);
  scene.add(mesh);

  function setTime(time: number): void {
    material.uniforms.time!.value = time;
  }

  function markCut(indices: number[], time: number): void {
    if (indices.length === 0) return;
    let first = Infinity;
    let last = -Infinity;
    for (const index of indices) {
      cutTimes[index] = time;
      first = Math.min(first, index);
      last = Math.max(last, index);
    }
    cutTimeAttribute.addUpdateRange(first, last - first + 1);
    cutTimeAttribute.needsUpdate = true;
  }

  return { setTime, markCut };
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

function placeBlades(mesh: InstancedMesh, field: Field, seed: number): void {
  const random = createRandom(seed);
  const matrix = new Matrix4();
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  const up = new Vector3(0, 1, 0);
  const shades = mesh.geometry.getAttribute('instanceShade') as InstancedBufferAttribute;
  for (let blade = 0; blade < field.bladeCount; blade++) {
    position.set(field.positionsX[blade]!, 0, field.positionsZ[blade]!);
    rotation.setFromAxisAngle(up, random() * Math.PI * 2);
    scale.set(1, 1 + (random() * 2 - 1) * TUFT_HEIGHT_VARIATION, 1);
    mesh.setMatrixAt(blade, matrix.compose(position, rotation, scale));
    shades.setX(blade, 1 + (random() * 2 - 1) * TUFT_SHADE_VARIATION);
  }
  mesh.instanceMatrix.needsUpdate = true;
  shades.needsUpdate = true;
  mesh.computeBoundingSphere();
}
