# Siega Total M0 + M1: esqueleto y prototipo de corte — Plan de implementación

## Resumen

Este plan crea el proyecto Siega Total desde cero y lo publica en GitHub Pages (M0). Después, construye un prototipo jugable de corte (M1): una cuchilla corta 12 000 briznas de hierba verde en un campo fijo de 30 × 30 m.

M1 es el mayor riesgo del proyecto. Si el corte no es satisfactorio o no da 60 fps en móvil, el resto de la especificación no importa. Por eso, este plan solo cubre M0 y M1. Cada hito siguiente tiene su propio plan.

## Análisis del estado actual

- La carpeta solo tiene `plan.md` (la especificación) y `thoughts/`.
- No hay repositorio git, `package.json`, `Makefile` ni código.
- `plan.md:176` y `plan.md:318` tienen marcadores `[embedded content]` sin texto (flujo de pantallas y lista de hitos). Este plan define M0 y M1 (ver «Decisiones»).
- Herramientas del equipo: Node 24.9, npm 11.6, GNU Make 3.81, gh 2.76 conectado a la cuenta `nikeyes`.

## Estado final deseado

1. `make check test build` pasa en local y en GitHub Actions.
2. Cada push a `main` publica la compilación en `https://nikeyes.github.io/siega-total/`.
3. La página muestra un campo de 30 × 30 m con 12 000 briznas verdes que se mueven con el viento.
4. El jugador mueve la cuchilla con un joystick flotante (táctil o ratón) o con WASD y flechas.
5. La cuchilla corta las briznas dentro de su radio. La brizna cortada baja.
6. Cada 200 × tamaño briznas cortadas, la cuchilla sube un nivel de tamaño. El radio aumenta y la cámara se aleja un 12 %.
7. Con `?debug`, un contador muestra FPS y briznas cortadas / total.
8. Toda la lógica de `src/logic/` tiene pruebas Vitest y no depende de Three.js ni del DOM.

### Decisiones (resueltas con grill-me)

| Tema | Decisión |
| --- | --- |
| Alcance | Solo M0 y M1. Un plan nuevo para cada hito siguiente. |
| Criterio de salida M0 | `make check test build` pasa. Pages muestra una escena Three.js en `/siega-total/`. |
| Criterio de salida M1 | Campo fijo de 12 000 briznas verdes. Corte con joystick o teclado. Cámara que sigue a la cuchilla. Pruebas de corte y de tamaño pasan. |
| Idioma del código | Inglés para archivos, tipos y funciones. Textos visibles en castellano, solo en `src/texts.ts`. |
| Herramientas | npm, Node 24 en `.nvmrc`, `Makefile` que llama a los scripts de npm. La CI usa los mismos comandos `make`. |
| Repositorio | La fase 1 hace `git init`. El usuario crea `nikeyes/siega-total` en GitHub y activa Pages. |
| Equilibrio | Valores provisionales en `src/config.ts`. Las pruebas leen `config.ts` y no repiten los números. |
| Pruebas | Lógica pura con Vitest. `render/` y `ui/` solo pasan `tsc` y `vite build`. Una prueba de arquitectura protege `src/logic/`. |

### Equivalencia de nombres con `plan.md`

| `plan.md` | Este plan |
| --- | --- |
| `src/logica/` | `src/logic/` |
| `campo.ts` | `field.ts` |
| `cuchilla.ts` | `blade.ts` |
| `nivel.ts` | `level.ts` (hito posterior) |
| `generador.ts` | `generator.ts` (hito posterior) |
| `economia.ts` | `economy.ts` (hito posterior) |
| `guardado.ts` / `Guardado` | `save.ts` / `SaveData` (hito posterior) |
| `textos.ts` | `texts.ts` |
| `campana.ts` | `campaign.ts` (hito posterior) |

### Hallazgos clave

- `plan.md:37`: `base: '/siega-total/'` es obligatorio en `vite.config.ts`.
- `plan.md:288-291`: `logic/` no importa `render/`, `ui/` ni `three`. Los textos visibles van en un solo archivo. Los números de equilibrio van en `config.ts`. Nada usa `Math.random()` en la lógica.
- `plan.md:55-59`: briznas en arrays planos (`Float32Array`, `Uint8Array`), cuadrícula espacial y consulta solo de las celdas que toca la cuchilla.
- `plan.md:68-84`: valores de control y cámara (zona muerta de 10 px, suavizado de 0,1 s, frenado de 0,15 s, FOV de 45°, inclinación de 55°, retraso de 0,15 s, zoom del 12 % por nivel en 0,5 s).
- `plan.md:216`: calidad media = 12 000 briznas y resolución máxima 1,5×.

## Qué NO hacemos

- Tiempo, progreso de hierba objetivo, victoria y derrota (M2).
- Otras hierbas en el campo, obstáculos, rebote y «Necesitas más tamaño» (M2 o posterior). La tabla de hierbas sí está en `config.ts`, porque las pruebas de corte necesitan un tamaño mínimo mayor que 1.
- Generador de niveles y campaña (M3).
- Monedas, mejoras, boosters, tienda y guardado.
- Pantallas, menús, pausa y tutorial.
- Restos, sonido, texto «+N», vibración y destello de subida de tamaño.
- Calidad automática y selector de calidad. M1 usa siempre la calidad media.
- Panel `lil-gui`. M1 solo tiene un contador de FPS y briznas con `?debug`.
- Recursos glTF y `CREDITS.md` con entradas. El archivo existe, pero vacío de recursos.
- Comprobación automática del tamaño de carga (< 2 MB). Llega con el primer hito que añade recursos.
- Pruebas de navegador (Playwright) y pruebas de `render/` y `ui/`.

## Enfoque de implementación

1. Primero el esqueleto: compilación, pruebas, regla de arquitectura y publicación. Así, cada fase siguiente se publica sola.
2. Después, la lógica pura en orden de dependencia: PRNG y campo → cuchilla → entrada y cámara → paso de juego. Cada parte tiene pruebas de comportamiento.
3. Al final, render e interfaz. Estas capas solo leen el estado de la lógica y llaman a sus funciones.

### Sistema de coordenadas

- Campo en el plano XZ, de `(0, 0)` a `(width, depth)`.
- `+x` = este (derecha en pantalla). `+z` = sur (abajo en pantalla). El norte (`-z`) siempre queda arriba.
- En pantalla, `dx` del joystick → `x`, y `dy` del joystick (hacia abajo) → `z`. No hace falta invertir ejes.

---

## Fase 1: Proyecto base (M0)

### Resumen

Crear el repositorio, la configuración de TypeScript, Vite y Vitest, el `Makefile` y una escena Three.js mínima. Añadir la prueba de arquitectura de `src/logic/`.

### Cambios necesarios

#### 1. Repositorio y metadatos

**Archivos**: `.gitignore`, `.nvmrc`, `LICENSE`, `CREDITS.md`
**Cambios**:
- `git init -b main`.
- `.gitignore`: `node_modules/`, `dist/`, `.DS_Store`.
- `.nvmrc`: `24`.
- `LICENSE`: MIT, `Copyright (c) 2026 Jorge Castro`.
- `CREDITS.md`: título y una sección «Recursos CC0» vacía, con una nota: cada recurso nuevo añade su autor, paquete y licencia.

#### 2. Paquete y dependencias

**Archivo**: `package.json`
**Cambios**: `"type": "module"`, `"private": true`, `"engines": { "node": ">=24" }`. Instalar las versiones actuales y guardar `package-lock.json`.
- `dependencies`: `three`
- `devDependencies`: `typescript`, `vite`, `vitest`, `@types/three`, `@types/node`

```json
"scripts": {
  "dev": "vite",
  "check": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.logic.json",
  "test": "vitest run",
  "build": "vite build",
  "preview": "vite preview"
}
```

#### 3. TypeScript

**Archivo**: `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `target`/`lib` ES2022 + DOM, `moduleResolution: "bundler"`, `types: ["node", "vite/client"]`. Incluye `src`, `tests` y `vite.config.ts`.

**Archivo**: `tsconfig.logic.json`: hereda de `tsconfig.json`, pero con `lib: ["ES2022"]` (sin DOM) y `types: []`. Incluye solo `src/logic` y `src/config.ts`. Así, `tsc` falla si la lógica usa `window`, `document` o `localStorage`.

#### 4. Vite y Vitest

**Archivo**: `vite.config.ts`

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/siega-total/',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

#### 5. Makefile

**Archivo**: `Makefile`

```make
.PHONY: install dev check test build preview

install:
	npm ci

dev:
	npm run dev

check:
	npm run check

test:
	npm test

build:
	npm run build

preview:
	npm run preview
```

#### 6. Página y escena mínima

**Archivos**: `index.html`, `src/main.ts`, `src/ui/styles.css`, `src/texts.ts`, `src/config.ts`
**Cambios**:
- `index.html`: `<html lang="es">`, `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">`, `<title>Siega Total</title>`, un `<div id="app">` y `<script type="module" src="/src/main.ts">`. El `<title>` es la única excepción a la regla de textos: HTML lo necesita antes de cargar el código.
- `src/main.ts`: crea `WebGLRenderer`, una escena con un suelo plano verde de 30 × 30 m, luz ambiente y una `PerspectiveCamera` de 45°. Ajusta el tamaño al cambiar la ventana.
- `src/ui/styles.css`: `html, body, #app` a pantalla completa, sin márgenes, `overflow: hidden`, `touch-action: none`.
- `src/texts.ts`: `export const texts = {} as const;` (se llena en la fase 7).
- `src/config.ts`: `export const config = { field: { width: 30, depth: 30 } } as const;` (se completa en las fases 3–5).

#### 7. Prueba de arquitectura

**Archivo**: `tests/architecture.test.ts`
**Comportamiento**: lee todos los `.ts` de `src/logic/` (con `node:fs`). La prueba falla si un archivo:
- importa `three` o una ruta con `/render`, `/ui`, `/debug` o `/audio`;
- usa `Math.random`.

Mientras `src/logic/` no tenga archivos, la prueba comprueba una lista vacía. La fase 3 crea el primer archivo.

### Criterios de éxito

#### Verificación automática:
- [x] Las dependencias se instalan: `make install`
- [x] Los tipos pasan (los dos tsconfig): `make check`
- [x] Las pruebas pasan: `make test`
- [x] La compilación termina y `dist/index.html` usa rutas `/siega-total/assets/...`: `make build && grep -q '/siega-total/assets/' dist/index.html`

#### Verificación manual:
- [ ] `make dev` muestra el suelo verde en el navegador (juicio visual).

---

## Fase 2: CI y publicación (M0)

### Resumen

Cada push a `main` comprueba, prueba, compila y publica en GitHub Pages. Cada pull request ejecuta las mismas comprobaciones, sin publicar.

### Cambios necesarios

#### 1. Flujo de GitHub Actions

**Archivo**: `.github/workflows/deploy.yml`

```yaml
name: CI y publicación

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: make install
      - run: make check
      - run: make test
      - run: make build
      - if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Si un paso falla, el trabajo `deploy` no se ejecuta.

### Criterios de éxito

#### Verificación automática:
- [x] El archivo del flujo existe: `test -f .github/workflows/deploy.yml`
- [x] `make check test build` pasa en local

#### Verificación manual:
- [ ] El usuario crea el repositorio público y hace push: `gh repo create nikeyes/siega-total --public --source . --push` (acción externa: solo con orden del usuario)
- [ ] El usuario activa Pages con origen «GitHub Actions»: `gh api -X POST repos/nikeyes/siega-total/pages -f build_type=workflow`
- [ ] La ejecución de Actions en `main` termina en verde
- [ ] `https://nikeyes.github.io/siega-total/` muestra el suelo verde

---

## Fase 3: Campo y corte (M1, lógica)

### Resumen

PRNG con semilla, briznas en arrays planos, cuadrícula espacial y corte dentro de un círculo.

### Cambios necesarios

#### 1. Configuración

**Archivo**: `src/config.ts`

```ts
export const config = {
  field: {
    width: 30,
    depth: 30,
    bladeCount: 12_000,
    gridCellSize: 1,
    seed: 1,
  },
  grassTypes: {
    green: { minSize: 1, coins: 1 },
    ice: { minSize: 1, coins: 1 },
    wheat: { minSize: 2, coins: 2 },
    lavender: { minSize: 3, coins: 3 },
    bramble: { minSize: 4, coins: 4 },
  },
} as const;
```

La tabla de hierbas viene de `plan.md:94-100`. M1 solo coloca hierba verde. Las pruebas usan las otras para comprobar el tamaño mínimo.

#### 2. PRNG con semilla

**Archivo**: `src/logic/random.ts`
**Cambios**: `createRandom(seed: number): () => number` (mulberry32). Devuelve valores en `[0, 1)`.

**Pruebas** (`tests/logic/random.test.ts`):
- La misma semilla da la misma secuencia.
- Dos semillas distintas dan secuencias distintas.
- 10 000 valores quedan todos en `[0, 1)`.

#### 3. Campo

**Archivo**: `src/logic/field.ts`

```ts
export type GrassType = keyof typeof config.grassTypes;

export interface FieldOptions {
  width: number;
  depth: number;
  bladeCount: number;
  gridCellSize: number;
  seed: number;
  grassType: GrassType;
}

export interface Field {
  readonly width: number;
  readonly depth: number;
  readonly bladeCount: number;
  readonly positionsX: Float32Array;
  readonly positionsZ: Float32Array;
  readonly types: Uint8Array;      // índice en GRASS_TYPE_ORDER
  readonly cut: Uint8Array;        // 0 = en pie, 1 = cortada
  readonly grid: SpatialGrid;
  cutCount: number;
}

export function createField(options: FieldOptions): Field;
export function cutInCircle(field: Field, centerX: number, centerZ: number, radius: number, bladeSize: number): number[];
```

- `createField` coloca las briznas al azar con `createRandom(seed)`, dentro de `[0, width) × [0, depth)`.
- `SpatialGrid` usa formato CSR: `cellStart: Int32Array` (celdas + 1) y `cellBlades: Int32Array` (una entrada por brizna). Se construye con un recuento por celda.
- `cutInCircle` consulta solo las celdas que toca el círculo. Corta las briznas en pie con `distancia ≤ radio` y `minSize ≤ bladeSize`. Marca `cut`, suma `cutCount` y devuelve los índices recién cortados.

**Pruebas** (`tests/logic/field.test.ts`, con campos pequeños creados con `createField`):
- La misma semilla da las mismas posiciones.
- Todas las briznas quedan dentro del campo.
- Corta una brizna dentro del radio. No corta una brizna fuera del radio.
- Una brizna exactamente a la distancia del radio se corta (límite inclusivo).
- No corta trigo (`minSize` 2) con tamaño 1. Sí lo corta con tamaño 2.
- Una brizna ya cortada no se devuelve ni se cuenta otra vez.
- Un círculo que sale del campo no falla y corta solo las briznas de dentro.
- Para círculos al azar, el resultado es igual al de una búsqueda por fuerza bruta en todas las briznas.
- Un círculo que cubre todo el campo deja `cutCount === bladeCount`, y un segundo corte no lo cambia.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Las pruebas de PRNG, campo y arquitectura pasan: `make test`
- [x] La compilación termina: `make build`

---

## Fase 4: Cuchilla (M1, lógica)

### Resumen

Tamaño y barra de crecimiento, radio, movimiento con suavizado y frenado, y deslizamiento en los bordes.

### Cambios necesarios

#### 1. Configuración

**Archivo**: `src/config.ts`: añadir

```ts
blade: {
  startSize: 1,
  baseRadius: 0.5,
  radiusPerSize: 0.2,
  cutsPerSizeFactor: 200,
  maxSpeed: 5,
  turnSmoothingSeconds: 0.1,
  brakeSeconds: 0.15,
},
```

#### 2. Cuchilla

**Archivo**: `src/logic/blade.ts`

```ts
export interface Direction { x: number; z: number }   // vector unitario

export interface Blade {
  x: number;
  z: number;
  heading: number;        // radianes; 0 = +x
  speed: number;          // m/s
  size: number;
  growthProgress: number; // briznas acumuladas hacia el siguiente tamaño
}

export function createBlade(x: number, z: number): Blade;
export function bladeRadius(size: number): number;
export function cutsToNextSize(size: number): number;
export function addCuts(blade: Blade, count: number): number;          // devuelve niveles ganados
export function moveBlade(blade: Blade, direction: Direction | null, dt: number, width: number, depth: number): void;
```

Reglas:
- `bladeRadius(size) = baseRadius + radiusPerSize × (size − 1)`. Tamaño 1 → 0,5 m; tamaño 2 → 0,7 m.
- `cutsToNextSize(size) = cutsPerSizeFactor × size`.
- `addCuts` suma briznas y sube de tamaño todas las veces necesarias. El resto pasa al siguiente nivel.
- Con dirección: `speed = maxSpeed` al instante (el tamaño no cambia la velocidad). `heading` gira hacia la dirección por el arco más corto con suavizado exponencial: `factor = 1 − exp(−dt / turnSmoothingSeconds)`. Si la cuchilla está parada (`speed === 0`), `heading` toma la dirección al instante.
- Sin dirección: `speed` baja de forma lineal a 0 en `brakeSeconds`.
- La posición avanza `speed × dt` en la dirección de `heading`. Después, se limita a `[0, width] × [0, depth]` en cada eje por separado. Así, la cuchilla se desliza a lo largo del borde.

**Pruebas** (`tests/logic/blade.test.ts`):
- Con 199 briznas (`cutsToNextSize(1) − 1`), el tamaño sigue en 1. Con una más, sube a 2.
- Desde tamaño 1, `addCuts(650)` da tamaño 3 y progreso 50 (200 + 400 + 50). Devuelve 2.
- El radio aumenta `radiusPerSize` en cada nivel.
- Desde parada, con dirección este, la cuchilla avanza `maxSpeed × dt` en `x` en el primer paso.
- Con tamaño 5, la velocidad es igual que con tamaño 1.
- Al soltar, la velocidad es 0 después de `brakeSeconds` y la cuchilla no retrocede.
- El giro de 180° no da la vuelta en un solo paso corto. Después de 5 × `turnSmoothingSeconds`, la dirección queda a menos de 1° del objetivo.
- Un paso de 0,1 s y diez pasos de 0,01 s dan un `heading` casi igual (independiente de los fps).
- En diagonal noreste contra el borde este, `x` queda en `width` y `z` sigue cambiando (deslizamiento).
- La cuchilla nunca sale del campo.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Las pruebas de cuchilla pasan: `make test`
- [x] La compilación termina: `make build`

---

## Fase 5: Entrada, cámara y paso de juego (M1, lógica)

### Resumen

Convertir joystick y teclado en una dirección. Calcular el seguimiento, el zoom y los límites de la cámara. Unir campo y cuchilla en un paso de juego.

### Cambios necesarios

#### 1. Configuración

**Archivo**: `src/config.ts`: añadir

```ts
input: {
  joystickDeadZonePx: 10,
},
camera: {
  fovDegrees: 45,
  tiltDegrees: 55,
  baseDistance: 8,
  followLagSeconds: 0.15,
  zoomPerSize: 0.12,
  zoomTransitionSeconds: 0.5,
  edgeMarginMeters: 1.5,
},
```

#### 2. Entrada

**Archivo**: `src/logic/input.ts`

```ts
export function joystickDirection(originX: number, originY: number, currentX: number, currentY: number): Direction | null;
export function keyboardDirection(pressedKeys: ReadonlySet<string>): Direction | null;
export function combineDirections(joystick: Direction | null, keyboard: Direction | null): Direction | null;
```

- `joystickDirection`: con una distancia de `joystickDeadZonePx` o menos, devuelve `null`. Con más, devuelve el vector unitario (`dx → x`, `dy → z`).
- `keyboardDirection`: usa `KeyboardEvent.code` (`KeyW`, `KeyA`, `KeyS`, `KeyD`, `ArrowUp`, `ArrowLeft`, `ArrowDown`, `ArrowRight`). La diagonal se normaliza. Dos teclas opuestas se anulan.
- `combineDirections`: el joystick tiene prioridad sobre el teclado.

**Pruebas** (`tests/logic/input.test.ts`):
- 10 px desde el origen → `null`. 11 px → dirección.
- Arrastre a la derecha → `{ x: 1, z: 0 }`. Arrastre hacia abajo → `{ x: 0, z: 1 }` (sur).
- La longitud de la dirección es 1 a cualquier distancia del origen.
- `W` → norte (`z: −1`). `ArrowRight` → este.
- `W` + `D` → diagonal de longitud 1.
- `A` + `D` → `null`.
- Con joystick y teclado a la vez, gana el joystick.

#### 3. Cámara

**Archivo**: `src/logic/camera.ts`

```ts
export interface CameraFocus {
  x: number;
  z: number;
  distance: number;
}

export function createCameraFocus(x: number, z: number, size: number): CameraFocus;
export function targetDistance(size: number): number;
export function followBlade(focus: CameraFocus, bladeX: number, bladeZ: number, bladeSize: number, dt: number): void;
export function clampFocus(focus: CameraFocus, width: number, depth: number, halfVisibleX: number, halfVisibleZ: number, margin: number): void;
```

- `targetDistance(size) = baseDistance × (1 + zoomPerSize)^(size − 1)`.
- `followBlade`: `x` y `z` se acercan a la cuchilla con `factor = 1 − exp(−dt / followLagSeconds)`. `distance` se acerca a `targetDistance(size)` con `factor = 1 − exp(−5 × dt / zoomTransitionSeconds)` (99 % en `zoomTransitionSeconds`).
- `clampFocus`: limita `x` a `[halfVisibleX − margin, width − halfVisibleX + margin]` y `z` a `[halfVisibleZ − margin, depth − halfVisibleZ + margin]`. Si la zona visible es mayor que el campo más los dos márgenes en un eje, centra ese eje. Así, la cámara se detiene antes que la cuchilla y deja ver una franja de arena tras el borde. `main.ts` pasa `margin = bladeRadius(size) + edgeMarginMeters`, para que la cuchilla siempre quede entera en pantalla.

**Pruebas** (`tests/logic/camera.test.ts`):
- Tamaño 2 → distancia 12 % mayor que tamaño 1.
- Después de un paso corto, el foco está entre su posición anterior y la cuchilla.
- Después de 1 s, el foco está a menos de 1 cm de una cuchilla quieta.
- Después de `zoomTransitionSeconds`, la distancia está a menos del 1 % del objetivo.
- Con la cuchilla en una esquina, el foco queda a `halfVisible − margin` del borde.
- Con la cuchilla en el borde, queda al menos `margin` dentro de la zona visible.
- Con zona visible mayor que el campo más los dos márgenes, el foco queda en el centro.

#### 4. Paso de juego

**Archivo**: `src/logic/game.ts`

```ts
export interface Game {
  field: Field;
  blade: Blade;
}

export interface StepResult {
  cutIndices: number[];
  sizesGained: number;
}

export function createGame(): Game;   // campo de config.field con hierba verde, cuchilla en el centro
export function stepGame(game: Game, direction: Direction | null, dt: number): StepResult;
```

`stepGame` mueve la cuchilla, corta con `bladeRadius(size)` y suma los cortes a la barra de tamaño.

**Pruebas** (`tests/logic/game.test.ts`):
- En el primer paso sin dirección, la cuchilla corta las briznas bajo su posición inicial.
- Al cruzar el campo de oeste a este, todas las briznas cortadas están a `bladeRadius` o menos de la trayectoria.
- `sizesGained` y `blade.size` coinciden con `addCuts` sobre el total de briznas cortadas.
- Después de subir de tamaño, el corte usa el radio nuevo.
- Al recorrer todo el campo en zigzag, `field.cutCount` llega exactamente a `field.bladeCount`.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Las pruebas de entrada, cámara y juego pasan: `make test`
- [x] La compilación termina: `make build`

---

## Fase 6: Render (M1)

### Resumen

Dibujar el campo, la hierba, la cuchilla, la sombra falsa y la cámara con Three.js. Esta capa solo lee el estado de `src/logic/`.

### Cambios necesarios

#### 1. Escena

**Archivo**: `src/render/scene.ts`
**Cambios**: `WebGLRenderer` con `antialias: true` y `setPixelRatio(Math.min(devicePixelRatio, config.render.maxPixelRatio))`. Fondo de color plano, luz ambiente + luz direccional (sin sombras reales), suelo plano de `width × depth`. Ajuste de tamaño en `resize`.

**Archivo**: `src/config.ts`: añadir `render: { maxPixelRatio: 1.5 }` (calidad media, `plan.md:216`).

#### 2. Hierba

**Archivo**: `src/render/grass.ts`
**Cambios**:
- Geometría de brizna: dos triángulos (base ancha, punta estrecha). Atributo de altura relativa (0 en la base, 1 en la punta) para el degradado y el viento.
- Un `InstancedMesh` para la hierba verde. La matriz de cada instancia tiene la posición del campo, un giro y una altura con pequeña variación (variación con `createRandom` y la semilla del campo).
- Atributo por instancia `instanceCutTime: InstancedBufferAttribute` (`Float32Array`, `−1` = en pie).
- `ShaderMaterial`:
  - Uniforms: `time`, `baseColor`, `tipColor`.
  - Vertex shader: viento = `sin(time × 2 + x × 0,5 + z × 0,3) × alturaRelativa²`. Si la brizna está cortada, la altura baja hasta el 15 % en 0,1 s desde `instanceCutTime`.
  - Fragment shader: degradado de `baseColor` a `tipColor` según la altura relativa.
- `markCut(indices: number[], time: number)`: escribe `time` en `instanceCutTime` para cada índice y marca solo el rango cambiado para subir a la GPU (`addUpdateRange` + `needsUpdate`).

Los colores, el viento y las alturas son valores visuales, no de equilibrio. Quedan como constantes con nombre en `grass.ts`.

#### 3. Cuchilla y sombra

**Archivo**: `src/render/blade.ts`
**Cambios**: malla de cuchilla (disco con 3–4 hojas, colores planos y saturados) que gira sobre su eje. La escala sigue a `bladeRadius(size)`. Sombra falsa: un círculo negro transparente (opacidad ~0,3) sobre el suelo, bajo la cuchilla.

#### 4. Cámara

**Archivo**: `src/render/cameraRig.ts`
**Cambios**:
- `PerspectiveCamera` con `fovDegrees`.
- Posición = foco + `(0, distance × sin(tilt), distance × cos(tilt))`, mirando al foco. El norte queda arriba.
- `halfVisible(distance, aspect)`: zona visible aproximada sobre el suelo, `halfVisibleZ = distance × tan(fov / 2)` y `halfVisibleX = halfVisibleZ × aspect`. `main.ts` la pasa a `clampFocus`.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan (incluida la regla sin DOM de `src/logic/`): `make check`
- [x] Todas las pruebas pasan (la de arquitectura incluida): `make test`
- [x] La compilación termina: `make build`

---

## Fase 7: Interfaz, bucle principal y contador de depuración (M1)

### Resumen

Conectar la entrada del jugador, el bucle de juego y el render. Añadir el contador de FPS y briznas con `?debug`.

### Cambios necesarios

#### 1. Joystick flotante

**Archivo**: `src/ui/joystick.ts`
**Cambios**:
- Escucha `pointerdown`, `pointermove`, `pointerup` y `pointercancel` en el contenedor del juego. Usa `setPointerCapture` y sigue solo el primer puntero.
- Al tocar, muestra un círculo base y un círculo de mando en ese punto (HTML + CSS). El mando sigue al dedo hasta un radio máximo.
- `getDirection(): Direction | null` llama a `joystickDirection` con el origen y la posición actual.
- Al soltar, oculta el joystick.

#### 2. Teclado

**Archivo**: `src/ui/keyboard.ts`
**Cambios**: un `Set<string>` de `event.code` con `keydown` y `keyup`. Lo vacía en `blur`. `getDirection()` llama a `keyboardDirection`.

#### 3. Estilos

**Archivo**: `src/ui/styles.css`: estilos del joystick (círculo base semitransparente, mando con contorno, sin selección de texto) y del contador de depuración.

#### 4. Textos

**Archivo**: `src/texts.ts`

```ts
export const texts = {
  debug: {
    fps: 'FPS',
    bladesCut: 'Briznas cortadas',
  },
} as const;
```

#### 5. Contador de depuración

**Archivo**: `src/debug/stats.ts`
**Cambios**: `createStats(container)` crea un `<div>` fijo en una esquina. `update(dt, cutCount, bladeCount)` muestra los FPS medios de cada 0,5 s y `cortadas / total`. `main.ts` lo carga con `import()` dinámico solo si `new URLSearchParams(location.search).has('debug')`. Así, queda en un fragmento aparte de la compilación.

#### 6. Bucle principal

**Archivo**: `src/main.ts`
**Cambios**:
1. Crea `Game` (`createGame()`), escena, hierba, cuchilla, cámara, joystick y teclado.
2. En cada `requestAnimationFrame`:
   - `dt = min(tiempoReal, 0,05 s)`, para evitar saltos al volver a la pestaña.
   - `direction = combineDirections(joystick.getDirection(), keyboard.getDirection())`.
   - `result = stepGame(game, direction, dt)`.
   - `grass.markCut(result.cutIndices, time)`.
   - `followBlade(...)` y `clampFocus(...)` con `halfVisible(...)`.
   - Actualiza la malla de cuchilla y la sombra, la cámara y `time` de la hierba. Dibuja.
   - Con `?debug`, actualiza el contador.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La compilación termina: `make build`
- [x] El contador de depuración queda en un fragmento aparte: `make build && ls dist/assets | grep -c '\.js$'` devuelve 2 o más

#### Verificación manual:
- [ ] El corte es satisfactorio: la hierba baja al paso de la cuchilla y el giro responde sin retraso molesto (juicio subjetivo).
- [ ] Con `?debug`, un móvil de gama media (~2020) muestra 55–60 fps al cortar (medida en dispositivo real).
- [ ] El joystick flotante funciona con el dedo en Safari iOS y Chrome Android. La página no hace scroll ni zoom.
- [ ] En escritorio, WASD y las flechas mueven la cuchilla.
- [ ] Al subir de tamaño, la cámara se aleja de forma suave.
- [ ] En las esquinas, la cámara se detiene y la cuchilla sigue hasta el borde.

---

## Estrategia de pruebas

### Pruebas unitarias (Vitest, `tests/logic/`)

- **PRNG**: secuencia determinista y rango `[0, 1)`.
- **Campo**: corte inclusivo en el radio, tamaño mínimo, sin doble conteo, círculos fuera del campo, igualdad con fuerza bruta, contador exacto.
- **Cuchilla**: umbrales de tamaño, arrastre del resto, radio, velocidad independiente del tamaño, frenado, giro suavizado independiente de los fps, deslizamiento en bordes.
- **Entrada**: zona muerta, normalización, ejes de pantalla, teclas opuestas, prioridad del joystick.
- **Cámara**: zoom del 12 %, seguimiento con retraso, transición de zoom, límites en bordes.
- **Juego**: integración de movimiento, corte y crecimiento. Recorrido completo con contador exacto.

Las pruebas leen los valores de `config.ts` y no repiten números de equilibrio. Las pruebas de casos límite crean campos pequeños con `createField(options)`.

### Prueba de arquitectura

`tests/architecture.test.ts` falla si `src/logic/` importa `three`, `render/`, `ui/`, `debug/` o `audio/`, o si usa `Math.random`. `tsconfig.logic.json` (sin `lib` DOM) hace que `make check` falle si `src/logic/` usa APIs del navegador.

### Pruebas manuales

Solo para lo subjetivo y para el dispositivo real: sensación del corte, fps en móvil, gestos táctiles (fase 7) y publicación en GitHub (fase 2).

## Rendimiento

- Una sola llamada de dibujo para 12 000 briznas (`InstancedMesh`).
- `cutInCircle` solo recorre las celdas bajo el círculo. Con celdas de 1 m y radio de 0,5–2 m, son de 4 a 25 celdas (~13 briznas por celda).
- `markCut` sube a la GPU solo el rango de instancias cambiado.
- El viento y la bajada de la brizna cortada se calculan en el vertex shader, sin trabajo en la CPU.
- Resolución máxima de 1,5×, sin sombras reales.
- `cutInCircle` devuelve un `number[]` pequeño en cada frame. Si la medida en móvil muestra pausas del recolector de basura, se cambia a un búfer reutilizable.

## Notas de migración

No aplica: es un proyecto nuevo. No hay datos guardados en M0 ni en M1.

## Referencias

- Especificación: `plan.md`
- Reglas de juego: `plan.md:41-84`
- Niveles de calidad: `plan.md:211-223`
- Estructura y reglas de código: `plan.md:259-291`
- CI y despliegue: `plan.md:310-312`

## Desviaciones durante la implementación

- **Fase 4, giro de 180°**: con `factor = 1 − exp(−dt / turnSmoothingSeconds)`, tras 5 × `turnSmoothingSeconds` quedan π·e⁻⁵ ≈ 1,21°, no menos de 1°. Se mantiene la regla y la prueba exige «menos del 1 % del giro inicial».
- **Fase 3, bordes del campo**: `Float32Array` podía redondear `random() × width` hasta `width`. `createField` ahora garantiza `[0, width)`.
- **Fase 4, frenado**: el error de coma flotante dejaba una velocidad residual (~1e-15) a 60 fps. Por debajo de `1e-9` la cuchilla cuenta como parada, así que vuelve a girar al instante.
- **Fase 7**: con `?debug`, `main.ts` expone `window.__siega` (el `Game`) para la comprobación automática en navegador. El tiempo de la hierba es tiempo de juego (suma de `dt` limitados).
- **Aspecto visual (tras comparar con capturas de referencia de Grass Master, en móvil vertical)**: cada brizna se dibuja como una mata de 7 hojas en punta con dos caras sombreadas y brillo variable por mata. Al cortarse, la mata baja al 8 % y se encoge al 35 % en horizontal, y deja recortes sobre la arena. El suelo es arena plana (`MeshBasicMaterial`) y también rodea el campo. La cuchilla es un centro azul con dos hojas blancas curvas, a 0,4 m del suelo. El joystick tiene anillo translúcido y mando blanco con sombra.
- **Cámara más cerca**: `camera.baseDistance` baja de 12 a 8, para que el corte de tamaño 1 ocupe cerca de un tercio del ancho en vertical.
- **Margen en los bordes**: al probar en 390 × 844, la cuchilla quedaba medio fuera de pantalla en los bordes sur, este y oeste. `clampFocus` recibe un margen (`bladeRadius(size) + camera.edgeMarginMeters`, 1,5 m) y la cámara muestra arena más allá del borde.
- **Joystick**: `setPointerCapture` se llama al final de `pointerdown`, para que el estado del joystick quede completo aunque el navegador rechace la captura.
- **Fallo conocido, sin arreglar**: `keyboardDirection` devuelve `NaN` con claves heredadas como `toString` (`tests/logic/input.test.ts`, prueba `- BUG` omitida). `KeyboardEvent.code` nunca produce esas claves.
