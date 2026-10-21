import { AmbientLight, Color, DirectionalLight, Mesh, MeshBasicMaterial, PlaneGeometry, Scene, WebGLRenderer } from 'three';

const SKY_COLOR = 0x2fb4ef;
const SAND_COLOR = 0xf5c86a;
/** Sand also surrounds the field, so the camera sees sand rather than sky past the edges. */
const SAND_MARGIN = 20;
const AMBIENT_LIGHT_INTENSITY = 1.2;
const SUN_INTENSITY = 1.5;

export interface GameScene {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  /** Fits the drawing buffer to the container size. */
  resize(): void;
  /** Draws at the screen's pixel ratio, up to `max`. */
  setMaxPixelRatio(max: number): void;
}

/** Renderer, lights and flat sand under the field from `(0, 0)` to `(width, depth)` and around it. */
export function createGameScene(container: HTMLElement, width: number, depth: number): GameScene {
  const renderer = new WebGLRenderer({ antialias: true });
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color(SKY_COLOR);
  scene.add(new AmbientLight(0xffffff, AMBIENT_LIGHT_INTENSITY));
  const sun = new DirectionalLight(0xffffff, SUN_INTENSITY);
  sun.position.set(-10, 20, 10);
  scene.add(sun);

  const ground = new Mesh(
    new PlaneGeometry(width + SAND_MARGIN * 2, depth + SAND_MARGIN * 2),
    new MeshBasicMaterial({ color: SAND_COLOR }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(width / 2, 0, depth / 2);
  scene.add(ground);

  function resize(): void {
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  function setMaxPixelRatio(max: number): void {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, max));
    resize();
  }

  return { renderer, scene, resize, setMaxPixelRatio };
}
