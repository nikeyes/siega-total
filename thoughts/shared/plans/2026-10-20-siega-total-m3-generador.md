# Siega Total M3: obstáculos, choques y generador de niveles — Plan de implementación

## Resumen

M3 convierte el nivel fijo de M2 en una progresión de niveles generados por semilla. Para ello añade lo que la curva de introducción y la validación de la especificación necesitan:

- obstáculos (roca, cactus, sandía y fresa) con choques y el aviso «Necesitas más tamaño»;
- hierba dura que bloquea el paso hasta tener tamaño suficiente;
- varios objetivos por nivel, con un contador de briznas o piezas restantes;
- un generador con 7 patrones, una curva de dificultad y la validación de semillas;
- el botón «Siguiente» para pasar de nivel;
- modelos glTF CC0 de Kenney;
- en el panel de depuración: saltar de nivel y cargar semillas.

Sigue `plan.md:320`: M2 validó la regla y M3 la automatiza.

## Análisis del estado actual

- M0, M1 y M2 están publicados. M2 entró en `main` con la PR #1 (`95ca621`).
- `plan.md:318` (la lista de hitos) está vacía. El alcance de M3 sale de `plan.md:110-138`, `plan.md:62-66`, `plan.md:102-108` y de las decisiones de abajo.
- `src/logic/levels.ts:4-14`: `LevelDefinition` es una cuadrícula de tipos con **un solo** `target`. `stripesLevel()` (línea 17) es el único nivel.
- `src/logic/field.ts:60-91`: `createField` reparte `bladeCount` briznas entre las celdas con hierba (`i % celdasConHierba`). La semilla sale de `config.field.seed` (`levelFieldOptions`, línea 53).
- `src/logic/field.ts:150-184`: `cutInCircle` salta las briznas con tamaño mínimo mayor que el de la cuchilla. No hay colisiones.
- `src/logic/game.ts:61-84`: `stepGame` mueve la cuchilla (`moveBlade` solo la limita a los bordes, `blade.ts:62-65`), corta y comprueba victoria y derrota. `targetProgress` y `remainingTargets` solo conocen un objetivo de hierba.
- `src/logic/random.ts:2`: `createRandom(seed)` (mulberry32). La prueba de arquitectura prohíbe `Math.random` en `logic/` (`tests/architecture.test.ts:45`).
- `src/main.ts:23-33`: el juego, la hierba, el HUD y la capa de resultado se crean **una sola vez**. `restart()` solo reinicia el mismo nivel. `createHud(container, target)` dibuja un icono y una barra (`src/ui/hud.ts:54-89`).
- `src/render/grass.ts:122-156`: `GrassView` no tiene `dispose()`. `setHighlight(type)` admite un solo tipo.
- `src/render/scene.ts:31-37`: el suelo de arena mide `30 + 2 × 20` m, y el campo siempre mide 30 × 30.
- No hay sistema de partículas: los restos son el encogimiento lateral de la mata (`grass.ts:37`).
- `src/debug/panel.ts:25-69`: el panel recibe `game` una vez. Hace falta poder cambiar de partida.
- Pruebas saltadas por errores (`- BUG`): `tests/logic/field.test.ts:134` (campo todo arena) y `tests/logic/game.test.ts:191` (nivel sin hierba objetivo).
- El paquete de producción actual: `dist/assets/index-*.js` pesa 579 KB sin comprimir. No hay comprobación de tamaño.

## Estado final deseado

1. Al abrir la página empieza el **nivel 1**, generado (solo hierba verde, objetivo verde). El HUD muestra «Nivel 1», el tiempo y una tarjeta con un icono y las briznas restantes de cada objetivo.
2. Al ganar, la capa de Victoria ofrece «Siguiente» y carga el nivel N+1 sin recargar la página. Al perder, «Reintentar» repite el mismo nivel. Al recargar la página se vuelve al nivel 1 (no hay guardado).
3. Cada elemento aparece en su nivel: verde 1, hielo 4, trigo 7, lavanda 10, roca 13, fruta 16, zarza 19 y cactus 22. En ese nivel, lo nuevo es el único objetivo.
4. La cuchilla no puede entrar en una celda de hierba con tamaño mínimo mayor que el suyo, ni en una roca, ni en un cactus o una fruta que todavía no puede cortar. Se desliza por el borde y aparece «Necesitas más tamaño».
5. Con tamaño suficiente, la fruta y el cactus se cortan, desaparecen con una explosión de trozos de su color y suman a la barra de tamaño. La onda de victoria corta la fruta y el cactus, pero no las rocas.
6. Los obstáculos usan los modelos CC0 de Kenney (`rock_largeA`, `cactus_tall`, `watermelon`, `strawberry`), que aparecen en `CREDITS.md`.
7. Con `?debug`, el panel permite ir al nivel N, cargar una semilla, generar «Otra semilla», «Copiar semilla» y editar `config.generator`, `config.obstacles` y `config.collision`.
8. `make check test build size` pasa. La carga inicial pesa menos de 2 MB comprimidos.

### Decisiones (resueltas con grill-me)

| Tema | Decisión |
| --- | --- |
| Alcance | Hierbas + obstáculos (roca, cactus, sandía, fresa), choques, generador, progresión con «Siguiente», glTF y panel. Sin monedas, sonido ni guardado. |
| Modelos | glTF CC0 de Kenney ya en M3 (Nature Kit y Food Kit 2.0). Hasta la fase 7, formas en código. |
| Obstáculos en la lógica | Círculos libres `{ type, x, z }`. El radio de cada tipo sale de `config`. Bajo la roca y el cactus no hay hierba. La fruta se pone sobre la hierba. |
| Hierba dura | Bloquea por celdas: una celda de 1 m con tamaño mínimo mayor que el de la cuchilla es una pared. |
| Fruta y cactus | Bloquean hasta su tamaño (fruta ≥ 2, cactus ≥ 4). Después se cortan con una explosión y suman a la barra (fruta 5, cactus 20 cortes). |
| Objetivos | Entre 1 y 3 por nivel (hierba, fruta o cactus; nunca roca). Se gana cuando todos llegan a 0. |
| Contador | Briznas restantes para la hierba y piezas restantes para la fruta y el cactus. |
| Campo | Siempre 30 × 30 m y 12 000 briznas, repartidas entre las celdas con hierba (como en M2). |
| Patrones | Los 7: franjas, tablero, círculos, espiral, camino serpenteante, campo de fútbol e islas. |
| Combinación | Un patrón por nivel devuelve un mapa de regiones. El generador asigna un tipo de hierba a cada región. |
| Curva | Un elemento nuevo cada 3 niveles (1, 4, 7, 10, 13, 16, 19, 22). Los valores numéricos se interpolan del nivel 1 al 25 y después se mantienen. |
| Elegir objetivos | En el nivel en que aparece un elemento, ese elemento es el único objetivo. En los niveles 1–3, el verde. En los demás, de 1 al máximo de la curva, elegidos al azar entre lo presente. |
| Tiempo | Recorrido estimado × margen de la curva (de 2,0 a 1,3), redondeado a 5 s. Se rechaza la semilla si supera 180 s. |
| Validación | Punto fijo por celdas desde un claro de 3 × 3 m en el centro: flood fill con el tamaño actual, tamaño alcanzable, repetir. Toda la hierba objetivo tiene que poder alcanzarse y cortarse. |
| Progresión | «Siguiente» en Victoria. El nivel solo vive en memoria. «Nivel N» en el HUD. |
| Campaña | `campaign.ts` (vacío al principio) y herramientas en el panel. El usuario cura los 50 niveles fuera del plan. |
| Criterio de salida | En el móvil se juegan los niveles 1→25 con «Siguiente». Pasan las pruebas del generador. La carga pesa menos de 2 MB. Mantiene 55–60 fps. |
| Entregas | Un plan y tres PR: A (fases 1–3), B (fases 4–6) y C (fases 7–8). Rama `feat/m3-generator` desde `main`. |

### Decisiones de detalle (tomadas al escribir el plan)

- **Cuerpo de la cuchilla:** el radio del choque es `bladeRadius(size)`, el mismo del corte.
- **«Necesitas más tamaño»:** se muestra encima de la cuchilla mientras empuja una pared, como mucho una vez cada `config.collision.blockedMessageSeconds` (1 s). No hay sonido ni vibración (llegan con el audio).
- **Resaltado gratuito:** con menos de `highlightBelow` unidades de objetivo en total (briznas + piezas), brillan las capas de hierba objetivo. La fruta y el cactus objetivo no brillan en M3.
- **Semilla:** la semilla del nivel también coloca las briznas (`level.seed`), en lugar de `config.field.seed`.
- **Arena bajo los obstáculos duros:** las celdas cuyo centro queda dentro del círculo de una roca o un cactus pasan a `null`.
- **Sin semilla válida:** si ninguno de los `maxAttempts` intentos da un nivel válido, `levelFor` usa un nivel de reserva: franjas del primer tipo desbloqueado, con ese tipo como objetivo y el margen de tiempo del nivel 1.
- **Errores de M2:** se corrigen y se activan sus pruebas: un campo todo arena tiene 0 briznas, y un nivel sin unidades de un objetivo cuenta ese objetivo como hecho.

### Hallazgos clave

- `plan.md:62-66`: la hierba y los obstáculos tienen un tamaño mínimo. Con menos tamaño, la cuchilla rebota y sale «Necesitas más tamaño».
- `plan.md:102-108`: la roca nunca se corta, el cactus se corta con tamaño ≥ 4 y la fruta con ≥ 2.
- `plan.md:110-125`: los patrones, el PRNG, la curva, la cuadrícula de salida y la validación.
- `plan.md:127-138`: la campaña, el modo infinito y la curva de introducción.
- `plan.md:76`: en los bordes y los obstáculos, la cuchilla se desliza.
- Paquetes de Kenney, descargados y listados el 20/10/2026:
  - Nature Kit: `Models/GLTF format/rock_largeA.glb` (7,5 KB) y `Models/GLTF format/cactus_tall.glb` (9,7 KB), solo con colores de material.
  - Food Kit 2.0: `Models/GLB format/watermelon.glb` (94 KB) y `Models/GLB format/strawberry.glb` (17 KB), con la textura compartida `Models/GLB format/Textures/colormap.png` (11 KB).
  - URL de los paquetes: `https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip` y `https://kenney.nl/media/pages/assets/food-kit/83086fa91c-1719418518/kenney_food-kit.zip`.

## Qué NO hacemos

- Monedas, «+N» flotante, bonus de tiempo, mejoras, boosters y tienda.
- Guardado en `localStorage`. Pantallas de Inicio, Pausa y Ajustes. Tutorial con la mano animada.
- Sonido, vibración, confeti y lluvia de monedas.
- Calidad automática: se sigue en calidad media (12 000 briznas).
- Campos de tamaño variable o no rectangulares.
- Superponer dos patrones en un mismo nivel.
- Curar las 50 semillas de la campaña (lo hace el usuario con el panel cuando M3 esté publicado).
- Flores u otros elementos decorativos de las capturas.
- Brillo de la fruta y el cactus objetivo.

## Enfoque de implementación

Las fases siguen el orden de M2: primero la lógica pura con TDD, después el render y la interfaz. Cada fase deja `make check test build` en verde.

- **PR A (fases 1–3):** obstáculos, choques y varios objetivos sobre un nivel de muestra hecho a mano (`sampleLevel()`). Se publica y se juega con formas provisionales.
- **PR B (fases 4–6):** patrones, generador, validación y progresión. El juego pasa a `levelFor(N)`.
- **PR C (fases 7–8):** modelos glTF, comprobación de tamaño y panel del generador.

---

## Fase 1: Obstáculos y varios objetivos (lógica)

### Resumen

Ampliar el formato del nivel con obstáculos y varios objetivos, contar lo que queda de cada objetivo, cortar la fruta y el cactus, y corregir los errores de M2.

### Cambios necesarios

#### 1. Configuración

**Archivo**: `src/config.ts`: añadir

```ts
obstacles: {
  rock: { radius: 1.0 },
  cactus: { radius: 1.4, minSize: 4, growthCuts: 20 },
  watermelon: { radius: 0.45, minSize: 2, growthCuts: 5 },
  strawberry: { radius: 0.25, minSize: 2, growthCuts: 5 },
},
```

Un obstáculo sin `minSize` (la roca) no se corta nunca.

#### 2. Formato del nivel

**Archivo**: `src/logic/levels.ts`

```ts
export type ObstacleType = keyof typeof config.obstacles;
/** Anything a level can ask the player to clear. */
export type TargetKind = GrassType | Exclude<ObstacleType, 'rock'>;

export interface Obstacle {
  type: ObstacleType;
  x: number;
  z: number;
}

export interface LevelDefinition {
  /** 1-based position in the progression; 0 for hand-made levels. */
  number: number;
  seed: number;
  width: number;
  depth: number;
  cellSize: number;
  cells: readonly (GrassType | null)[];
  obstacles: readonly Obstacle[];
  targets: readonly TargetKind[];
  timeSeconds: number;
}

export function isObstacleType(kind: TargetKind): kind is Exclude<ObstacleType, 'rock'>;
/** Turns into sand every cell whose center lies inside a rock or a cactus. */
export function clearCellsUnderSolidObstacles(cells: (GrassType | null)[], cellSize: number, columns: number, obstacles: readonly Obstacle[]): void;
export function stripesLevel(): LevelDefinition;   // sin obstáculos, targets: ['ice']
/** Hand-made level to play obstacles before the generator exists. */
export function sampleLevel(): LevelDefinition;
```

- `stripesLevel()` sigue igual, con `number: 0`, `seed: config.field.seed`, `obstacles: []` y `targets: ['ice']`.
- `sampleLevel()`:
  - franjas de 3 m de verde, hielo y trigo, en ese orden y repetidas;
  - 2 rocas y 1 cactus en posiciones fijas lejos del centro;
  - 6 sandías y 20 fresas sobre el verde y el hielo;
  - `targets: ['ice', 'strawberry']` y `timeSeconds: config.level.timeSeconds`.

**Pruebas** (`tests/logic/levels.test.ts`):
- `clearCellsUnderSolidObstacles` deja en arena las celdas cuyo centro está dentro de una roca o un cactus, y no toca las de alrededor ni las que hay bajo la fruta.
- `sampleLevel` tiene obstáculos de los cuatro tipos y no tiene hierba bajo sus rocas ni bajo su cactus.
- Se mantienen las pruebas de `stripesLevel` (con `targets: ['ice']`).

#### 3. Campo: semilla del nivel y campo vacío

**Archivo**: `src/logic/field.ts`
- `levelFieldOptions(level)` usa `level.seed`.
- `createField` con 0 celdas con hierba crea un campo de 0 briznas. Se activa la prueba `places no blades on a field that is all sand`.

#### 4. Estado de los obstáculos

**Archivo**: `src/logic/obstacles.ts` (nuevo)

```ts
export interface ObstacleField {
  readonly obstacles: readonly Obstacle[];
  /** 0 = standing, 1 = cut. */
  readonly cut: Uint8Array;
}

export function createObstacleField(obstacles: readonly Obstacle[]): ObstacleField;
export function resetObstacleField(field: ObstacleField): void;
export function obstacleRadius(type: ObstacleType): number;
/** Smallest blade size that cuts `type`; Infinity for rocks. */
export function obstacleCutSize(type: ObstacleType): number;
/** Cuts the standing obstacles that touch the circle and that `bladeSize` can cut. Returns their indices. */
export function cutObstaclesInCircle(field: ObstacleField, x: number, z: number, radius: number, bladeSize: number): number[];
export function standingCount(field: ObstacleField, type: ObstacleType): number;
```

Un obstáculo «toca» el círculo si la distancia entre los centros es ≤ `radius + obstacleRadius(type)`.

**Pruebas** (`tests/logic/obstacles.test.ts`):
- Una fruta que toca el círculo se corta con tamaño 2, pero no con tamaño 1.
- Un cactus se corta con 4, pero no con 3. Una roca no se corta ni con `Infinity`.
- Un obstáculo cortado no se vuelve a devolver.
- `standingCount` baja al cortar, y `resetObstacleField` lo vuelve a poner en pie.

#### 5. Juego con varios objetivos

**Archivo**: `src/logic/game.ts`

```ts
export interface Game {
  readonly level: LevelDefinition;
  readonly field: Field;
  readonly obstacles: ObstacleField;
  readonly blade: Blade;
  status: GameStatus;
  timeLeft: number;
  winWave: WinWave | null;
}

export interface StepResult {
  cutIndices: number[];
  /** Obstacles cut during this step. */
  cutObstacles: number[];
  sizesGained: number;
  /** True while the blade pushes against something it cannot cut yet (set in phase 2). */
  blocked: boolean;
}

/** Units (blades or pieces) of each target still standing, in the order of `level.targets`. */
export function remainingByTarget(game: Game): number[];
export function remainingTargets(game: Game): number;          // suma
/** Grass types (indices into GRASS_TYPE_ORDER) among the targets, for the highlight. */
export function targetGrassTypes(game: Game): number[];
```

- `targetType` y `targetProgress` desaparecen. La prueba `- BUG` del nivel sin hierba objetivo pasa a «un objetivo sin unidades cuenta como hecho»: `remainingByTarget` da 0 y el siguiente paso con dirección gana.
- En `playing`: después de cortar briznas, `cutObstaclesInCircle(obstacles, blade.x, blade.z, bladeRadius, blade.size)`. Las piezas cortadas suman `growthCuts` de su tipo a `addCuts`, junto con las briznas.
- La onda corta también los obstáculos con `bladeSize = Infinity`, salvo las rocas (`obstacleCutSize` es `Infinity` y la comparación es `≤`, así que nunca se cortan).
- `resetGame` también llama a `resetObstacleField`.
- `cutAllTargets` corta también las piezas objetivo y devuelve `{ blades, obstacles }`.
- `createGame(level = sampleLevel())`.

**Pruebas** (`tests/logic/game.test.ts`, con niveles pequeños creados en la prueba):
- Con dos objetivos (hielo y fresa), cortar todo el hielo no gana. Cortar también la última fresa pasa a `winWave`.
- `remainingByTarget` sigue el orden de `level.targets` y baja al cortar cada objetivo.
- Cortar una fruta suma `growthCuts` a la barra de tamaño.
- La onda corta la fruta y el cactus, pero no la roca, y termina en `won`.
- `resetGame` vuelve a poner los obstáculos en pie.
- El resaltado usa la suma de unidades restantes.
- Las pruebas actuales se adaptan a `targets` y a `remainingByTarget`.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Las pruebas de niveles, campo, obstáculos, juego y arquitectura pasan, sin pruebas `- BUG` saltadas en campo ni en juego: `make test`
- [x] La compilación termina: `make build`

---

## Fase 2: Choques (lógica)

### Resumen

La cuchilla se desliza por las celdas de hierba dura y por los obstáculos que aún no puede cortar, y el paso informa de que está bloqueada.

### Cambios necesarios

#### 1. Configuración

**Archivo**: `src/config.ts`: `collision: { iterations: 3, blockedMessageSeconds: 1 }`.

#### 2. Resolución de choques

**Archivo**: `src/logic/collision.ts` (nuevo)

```ts
export interface CollisionWorld {
  readonly level: LevelDefinition;   // celdas
  readonly obstacles: ObstacleField;
}

/** Cells and standing obstacles that `size` cannot cut. */
export function isHardCell(level: LevelDefinition, cell: number, size: number): boolean;

/**
 * Pushes the circle (x, z, radius) out of every hard cell and every standing obstacle
 * that `size` cannot cut. Returns the new center and whether anything pushed it.
 */
export function resolveCollisions(world: CollisionWorld, x: number, z: number, radius: number, size: number): { x: number; z: number; blocked: boolean };
```

- **Celdas duras:** las celdas que tocan el círculo y tienen hierba con `minSize > size`. Se usa el punto de la celda más cercano al centro. Si la distancia es menor que `radius`, se empuja por la normal la diferencia. Si el centro cae dentro de la celda, se empuja hacia el lado más cercano.
- **Obstáculos:** obstáculos en pie con `obstacleCutSize > size`. Se empuja por la recta entre los centros hasta `radius + obstacleRadius`.
- Se repite `config.collision.iterations` veces para resolver las esquinas. Al final, se limita a los bordes del campo.

**Archivo**: `src/logic/game.ts`: en `playing`, después de `moveBlade` y antes de cortar, `resolveCollisions` corrige `blade.x`/`blade.z`, y `blocked` va en `StepResult`. En `winWave`, `won` y `lost` no hay choques.

**Pruebas** (`tests/logic/collision.test.ts`):
- Una cuchilla de tamaño 1 que avanza hacia el este contra una franja de trigo se detiene a `radius` del borde de la franja, con `blocked = true`.
- Con tamaño 2 entra en el trigo y `blocked = false`.
- Al avanzar en diagonal contra una pared vertical, sigue avanzando en el eje paralelo a la pared (se desliza).
- Una roca empuja la cuchilla hasta `radius + obstacleRadius`, en cualquier dirección.
- Una fruta bloquea con tamaño 1. Con tamaño 2 no bloquea y se corta en el mismo paso (prueba en `game.test.ts`).
- Una fruta ya cortada no bloquea.
- En una esquina entre dos celdas duras, la cuchilla no las atraviesa.
- Un paso de juego de 2 s contra una roca deja la cuchilla fuera de la roca en todos los frames.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Las pruebas de choques y juego pasan: `make test`
- [x] La compilación termina: `make build`

---

## Fase 3: Render de obstáculos, explosión y HUD con varios objetivos

### Resumen

Dibujar los obstáculos con formas provisionales, hacerlos desaparecer con una explosión al cortarlos, mostrar varios objetivos con su contador y avisar de «Necesitas más tamaño». Al final de esta fase se juega `sampleLevel()` (PR A).

### Cambios necesarios

#### 1. Modelos de obstáculo intercambiables

**Archivo**: `src/render/obstacleModels.ts` (nuevo)

```ts
export interface ObstacleModelPart {
  geometry: BufferGeometry;
  material: Material;
}
/** Parts of one obstacle, already scaled so its footprint matches `obstacleRadius(type)`. */
export type ObstacleModels = Record<ObstacleType, readonly ObstacleModelPart[]>;

/** Flat-colored stand-ins drawn in code (phase 7 swaps them for the Kenney models). */
export function placeholderObstacleModels(): ObstacleModels;
```

Formas provisionales: la roca es un icosaedro aplanado gris, el cactus un cilindro con dos brazos verdes, la sandía una esfera verde oscuro y la fresa un cono rojo.

#### 2. Vista de obstáculos

**Archivo**: `src/render/obstacles.ts` (nuevo)

```ts
export interface ObstacleView {
  markCut(indices: number[]): void;   // escala 0 la instancia
  reset(): void;
  dispose(): void;
}
export function createObstacleView(scene: Scene, obstacles: readonly Obstacle[], models: ObstacleModels, seed: number): ObstacleView;
```

Un `InstancedMesh` por cada pieza de cada tipo presente. El giro en Y de cada instancia sale de `createRandom(seed)`, para que no se vean iguales.

#### 3. Explosión

**Archivos**: `src/render/burstMotion.ts` (puro, sin Three.js) y `src/render/burst.ts`.

- `burstPiecePosition(origin, velocity, age)`: tiro parabólico con gravedad, que se para al tocar el suelo.
- `createBurstView(scene)` mantiene un conjunto fijo de 200 cubos pequeños en un `InstancedMesh` con color por instancia. Su método `spawn(x, z, color, count)` lanza `count` cubos (12 para la fruta y 24 para el cactus) con velocidades al azar. `update(dt)` los mueve y los encoge durante 0,8 s.
- Colores de las explosiones en `src/render/obstacleColors.ts`: sandía `0xe83f4b`, fresa `0xd81e3a` y cactus `0x4caf50`. El HUD también los usa para los iconos.

**Pruebas** (`tests/render/burstMotion.test.ts`): en el instante 0 la pieza está en el origen, sube y después baja, y nunca baja de y = 0.

#### 4. Hierba: varios tipos resaltados y `dispose`

**Archivo**: `src/render/grass.ts`: `setHighlight(types: readonly number[])` (vacío = apagado) y `dispose()`, que quita las mallas de la escena y libera la geometría y los materiales.

#### 5. HUD

**Archivo**: `src/ui/hud.ts`

```ts
export interface HudState {
  timeLeft: number;
  timeTotal: number;
  /** Units left of each target, in the order of the level's targets. */
  remainingByTarget: readonly number[];
  size: number;
  growthFraction: number;
  sizeLabelX: number;
  sizeLabelY: number;
  /** Shows «Necesitas más tamaño» above the blade. */
  showBlocked: boolean;
}

export interface Hud {
  update(state: HudState): void;
  /** Rebuilds the target card for a new level. */
  showLevel(level: LevelDefinition): void;
}
export function createHud(container: HTMLElement): Hud;
```

- La tarjeta tiene una fila por objetivo, con el icono y el número restante (`hudDisplay` lo formatea con `Intl.NumberFormat('es-ES')`). La barra de M2 desaparece.
- Iconos: la mata de hierba de M2. Para la fruta y el cactus, un SVG en código con los colores de `obstacleColors.ts`.
- El aviso «Necesitas más tamaño» sale encima de la cuchilla (con la misma posición que la píldora, desplazada hacia arriba). Aparece y se desvanece con CSS.

**Archivo**: `src/ui/blockedNotice.ts` (puro): `createBlockedNotice()` → `{ step(blocked: boolean, dt: number): boolean }`. Devuelve `true` en el paso en que hay que mostrar el aviso: al empezar un bloqueo y, si sigue, cada `blockedMessageSeconds`.

**Pruebas**:
- `tests/ui/hud.test.ts`: `hudDisplay` da un contador por objetivo y formatea `1284 → "1284"` y `12840 → "12.840"`.
- `tests/ui/blockedNotice.test.ts`: aparece al primer bloqueo, no se repite antes de 1 s, se repite después de 1 s bloqueado y vuelve a aparecer al bloquearse de nuevo tras soltar.

#### 6. Textos

**Archivo**: `src/texts.ts`: `hud.needBiggerSize: 'Necesitas más tamaño'`.

#### 7. Bucle principal

**Archivo**: `src/main.ts`:
- Crea la vista de obstáculos con `placeholderObstacleModels()` y la vista de explosiones.
- En cada frame:
  - `obstacleView.markCut(result.cutObstacles)` y `burst.spawn` por cada obstáculo cortado;
  - `grass.setHighlight(shouldHighlightTargets(game) ? targetGrassTypes(game) : [])`;
  - el HUD recibe `remainingByTarget` y `showBlocked`.
- `restart()` también llama a `obstacleView.reset()`.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La compilación termina: `make build`

#### Verificación manual:
- [ ] En el móvil, con tamaño 1, la cuchilla se desliza por la franja de trigo y aparece «Necesitas más tamaño». Con tamaño 2 entra y la corta.
- [ ] Las fresas y las sandías estallan con trozos de su color y se nota la explosión (juicio visual).
- [ ] La tarjeta con dos objetivos se lee bien en 390 × 844.
- [ ] Mantiene 55–60 fps al cortar entre obstáculos.

---

## Fase 4: Patrones (lógica)

### Resumen

Los 7 patrones como funciones puras que reparten el campo en regiones. No saben nada de hierbas.

### Cambios necesarios

**Archivo**: `src/logic/patterns.ts` (nuevo)

```ts
export const SAND_REGION = -1;

export interface RegionMap {
  readonly columns: number;
  readonly rows: number;
  /** Row by row; SAND_REGION or 0..regionCount-1. */
  readonly regions: Int8Array;
  readonly regionCount: number;
}

export interface PatternParams {
  columns: number;
  rows: number;
  /** How many grass regions the level wants (1 to 4). */
  regionCount: number;
}

export type PatternName = 'stripes' | 'checkerboard' | 'circles' | 'spiral' | 'windingPath' | 'soccerField' | 'islands';
export const PATTERNS: Record<PatternName, (random: () => number, params: PatternParams) => RegionMap>;
```

| Patrón | Regla | Parámetros al azar |
| --- | --- | --- |
| `stripes` | Franjas verticales u horizontales. La región es `floor(posición / ancho) % regionCount`. | Orientación, ancho de 2 a 5 |
| `checkerboard` | Casillas cuadradas. La región es `(fila + columna de casilla) % regionCount`. | Lado de 3 a 6 |
| `circles` | Anillos concéntricos alrededor de un centro. La región es `floor(distancia / ancho) % regionCount`. | Centro dentro del tercio central, ancho de 2 a 4 |
| `spiral` | Bandas de espiral de Arquímedes. La región es `floor(ángulo / 2π + distancia / paso) % regionCount`. | Paso de 4 a 7, sentido |
| `windingPath` | Fondo en la región 0. Un camino sinusoidal de 3 celdas de ancho que cruza el campo, en la región 1. Si hay más regiones, un segundo camino en la región 2. | Amplitud, frecuencia y fase |
| `soccerField` | Franjas horizontales que alternan las regiones 0 y 1. Una línea de arena de 1 celda en el borde, la línea media, el círculo central y las dos áreas. | Ancho de franja de 2 a 3 |
| `islands` | Fondo en la región 0. De 4 a 8 círculos de las regiones 1..k−1 que no se tocan. | Centros y radios de 2 a 5 |

Con `regionCount = 1`, todos los patrones dan una sola región (y la arena del campo de fútbol).

**Pruebas** (`tests/logic/patterns.test.ts`, con `it.each` sobre los 7):
- Dimensiones `columns × rows` y regiones en `[-1, regionCount)`.
- La misma semilla da el mismo mapa.
- Con `regionCount ≥ 2` aparecen todas las regiones.
- Con `regionCount = 1` solo aparecen 0 y la arena.
- Una prueba de forma por patrón:
  - `stripes`: cada columna (o fila) tiene una sola región;
  - `checkerboard`: las casillas vecinas son distintas;
  - `circles`: la región depende solo de la distancia;
  - `spiral`: hay bandas en todos los cuadrantes;
  - `windingPath`: el camino es conexo y va de un borde al opuesto;
  - `soccerField`: hay simetría izquierda-derecha y el borde es de arena;
  - `islands`: las islas no se tocan.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Las pruebas de patrones y arquitectura pasan: `make test`
- [x] La compilación termina: `make build`

---

## Fase 5: Generador, validación y campaña (lógica)

### Resumen

Convertir un número de nivel y una semilla en un `LevelDefinition`, validarlo, calcular su tiempo y elegir la semilla de cada nivel.

### Cambios necesarios

#### 1. Configuración

**Archivo**: `src/config.ts`: añadir

```ts
generator: {
  maxAttempts: 50,
  maxTimeSeconds: 180,
  roundTimeToSeconds: 5,
  startClearingMeters: 3,
  curveLastLevel: 25,
  unlockLevel: { green: 1, ice: 4, wheat: 7, lavender: 10, rock: 13, fruit: 16, bramble: 19, cactus: 22 },
  grassTypeCount: { first: 1, last: 4 },
  targetCount: { first: 1, last: 3 },
  rockCount: { first: 2, last: 6 },
  fruitCount: { first: 8, last: 30 },
  cactusCount: { first: 1, last: 3 },
  timeMargin: { first: 2.0, last: 1.3 },
  /** Seconds to walk to and cut each target piece, on top of the swept area. */
  secondsPerTargetPiece: 0.6,
  /** Free space kept between obstacles, so the blade can pass between them. */
  obstacleGapMeters: 2,
},
```

#### 2. Dificultad

**Archivo**: `src/logic/difficulty.ts` (nuevo)

```ts
export type Unlockable = keyof typeof config.generator.unlockLevel;

export interface Difficulty {
  levelNumber: number;
  grassTypes: GrassType[];          // desbloqueados, en orden de aparición
  obstacleTypes: ObstacleType[];    // 'fruit' → watermelon y strawberry
  /** The element introduced at exactly this level, if any. */
  newElement: Unlockable | null;
  grassTypeCount: number;           // min(curva, desbloqueados)
  targetCount: number;
  rockCount: number; fruitCount: number; cactusCount: number;  // 0 si no están desbloqueados
  timeMargin: number;
}

/** Linear from `first` at level 1 to `last` at curveLastLevel, then flat; rounded for counts. */
export function curveValue(range: { first: number; last: number }, levelNumber: number): number;
export function difficultyFor(levelNumber: number): Difficulty;
```

**Pruebas** (`tests/logic/difficulty.test.ts`):
- Niveles 1–3: solo verde, sin obstáculos.
- Nivel 4: `newElement = 'ice'`. Nivel 7: `'wheat'`, y así con cada elemento.
- `curveValue` da `first` en el nivel 1, `last` en el 25 y `last` en el 60.
- Los recuentos son enteros y no bajan al subir de nivel.

#### 3. Generador

**Archivo**: `src/logic/generator.ts` (nuevo)

```ts
/** A level for `levelNumber` from `seed`; not validated. */
export function generateLevel(levelNumber: number, seed: number): LevelDefinition & { pattern: PatternName };
```

Pasos, todos con `createRandom(seed)`:
1. Se elige un patrón de `PATTERNS` y se crea el mapa de regiones con `regionCount = grassTypeCount`.
2. **Tipos por región:** se barajan los tipos desbloqueados. Si `newElement` es un tipo de hierba, se asigna a una región. Las demás regiones toman tipos distintos de los desbloqueados.
3. **Claro de inicio:** las celdas del cuadrado de `startClearingMeters` en el centro pasan a arena.
4. **Obstáculos:** rocas, cactus y frutas en posiciones al azar que cumplen tres condiciones:
   - quedan fuera del claro;
   - la fruta va sobre celdas con hierba;
   - la separación con los demás obstáculos es ≥ la suma de los radios + `obstacleGapMeters`.
   Cada fruta es sandía o fresa al azar. Si una posición no cumple las condiciones, se prueban hasta 20 veces y después se renuncia a ese obstáculo. Al final, `clearCellsUnderSolidObstacles`.
5. **Objetivos:**
   - si `newElement` no es la roca, es el único objetivo (`'fruit'` → el tipo de fruta más numeroso);
   - en los niveles 1–3, `['green']`;
   - si no, `targetCount` tipos distintos elegidos al azar entre la hierba y las piezas cortables presentes.
6. **Tiempo:** `estimateSeconds(level) × timeMargin`, redondeado hacia arriba a `roundTimeToSeconds`.
7. Se devuelve `number`, `seed`, `pattern` y las celdas de 30 × 30 de 1 m.

En el nivel 13 (roca) no hay objetivo nuevo: se eligen como en un nivel normal.

#### 4. Validación y estimación

**Archivo**: `src/logic/validation.ts` (nuevo)

```ts
export interface LevelAnalysis {
  /** Blade size reached after cutting everything reachable. */
  finalSize: number;
  /** Every target unit can be reached and cut with finalSize. */
  targetsReachable: boolean;
  /** Grass cells the player must sweep: the target cells plus the cheapest cells needed to grow. */
  cellsToSweep: number;
}

export function analyzeLevel(level: LevelDefinition): LevelAnalysis;
export function estimateSeconds(level: LevelDefinition): number;
export type Rejection = 'noTargets' | 'unreachableTargets' | 'tooLong' | 'startBlocked';
export function validateLevel(level: LevelDefinition): { valid: true } | { valid: false; reason: Rejection };
```

- **Briznas por celda:** `config.field.bladeCount / celdasConHierba`, igual que `createField`.
- **Punto fijo:** `size = config.blade.startSize` (el tamaño base, sin mejoras). Se repite:
  1. Flood fill (4 vecinos) desde la celda central por las celdas transitables con `size`. Una celda es transitable si no es una celda dura (`isHardCell`) y su centro no está dentro de un obstáculo que `size` no puede cortar.
  2. Cortes alcanzables = briznas de las celdas alcanzadas + `growthCuts` de los obstáculos cortables con `size` que tienen su celda central alcanzada o vecina de una alcanzada.
  3. Se calcula el tamaño al que llevan esos cortes con `cutsToNextSize`.
  4. Si el tamaño no sube, se para.
- **`targetsReachable`:** todas las celdas con hierba objetivo están alcanzadas, y todas las piezas objetivo son cortables con `finalSize` y tienen su celda alcanzada o vecina de una alcanzada.
- **`cellsToSweep`** = celdas objetivo + celdas de crecimiento necesarias. Para llegar al tamaño mínimo más alto de los objetivos hacen falta `Σ cutsToNextSize` cortes, divididos entre las briznas por celda.
- **`estimateSeconds`** = `cellsToSweep × cellSize² ÷ (2 × bladeRadius(startSize) × maxSpeed)` + `piezasObjetivo × secondsPerTargetPiece`. Es pesimista a propósito, porque no cuenta el crecimiento del radio.
- **`validateLevel`:**
  - `noTargets` si algún objetivo tiene 0 unidades;
  - `startBlocked` si la celda central no es transitable;
  - `unreachableTargets` si `targetsReachable` es falso;
  - `tooLong` si `timeSeconds > maxTimeSeconds`.

**Pruebas** (`tests/logic/validation.test.ts`, con niveles hechos a mano):
- Una isla de hielo objetivo rodeada de rocas se rechaza (`unreachableTargets`).
- Un objetivo de lavanda sin hierba suficiente para llegar a tamaño 3 se rechaza. Con bastante verde alcanzable, se acepta.
- Un trigo que separa el inicio de un hielo objetivo se acepta si el verde accesible da tamaño 2, y se rechaza si no lo da.
- Una fresa objetivo dentro de una franja de trigo se acepta solo si se llega a tamaño 2.
- Un objetivo sin unidades se rechaza (`noTargets`).
- Un nivel con `timeSeconds` mayor que `maxTimeSeconds` se rechaza (`tooLong`).
- `estimateSeconds` crece con el área objetivo y con las piezas.

#### 5. Semilla de cada nivel y campaña

**Archivo**: `src/campaign.ts` (nuevo): `export const campaignSeeds: Readonly<Record<number, number>> = {};` con un comentario que explica cómo añadir semillas desde el panel.

**Archivo**: `src/logic/progression.ts` (nuevo)

```ts
/** Deterministic seed for attempt `attempt` of level `levelNumber`. */
export function attemptSeed(levelNumber: number, attempt: number): number;
/** The first valid generated level of `levelNumber`, starting at `firstAttempt`. */
export function firstValidLevel(levelNumber: number, firstAttempt?: number): LevelDefinition & { attempt: number };
/** The campaign seed of the level if there is one, otherwise the first valid generated level. */
export function levelFor(levelNumber: number, campaign?: Readonly<Record<number, number>>): LevelDefinition;
```

- `attemptSeed` mezcla los dos números con un hash entero (`Math.imul`) en 32 bits.
- Después de `maxAttempts` intentos sin un nivel válido, `firstValidLevel` devuelve el nivel de reserva (ver «Decisiones de detalle»).
- `levelFor` no importa `campaign.ts` desde `logic/` (la regla de arquitectura lo permite, pero así las pruebas pasan su propia campaña). `main.ts` pasa `campaignSeeds`.

**Pruebas**:
- `tests/logic/generator.test.ts`:
  - La misma semilla da el mismo nivel (celdas, obstáculos, objetivos y tiempo).
  - Semillas distintas dan niveles distintos.
  - En los niveles 1, 4, 7, 10, 16, 19 y 22, el objetivo es el elemento nuevo y aparece en el campo.
  - En el nivel 13 hay rocas.
  - El claro central es de arena y no tiene obstáculos.
  - Ningún par de obstáculos está más cerca que la suma de sus radios + `obstacleGapMeters`.
  - No hay hierba bajo las rocas ni bajo los cactus.
  - Solo aparecen tipos desbloqueados.
- `tests/logic/progression.test.ts`:
  - `attemptSeed` es determinista y no se repite en los niveles 1–60 con los intentos 0–49.
  - Para cada nivel del 1 al 60, `levelFor(n)` es válido (`validateLevel`), su tiempo cabe en `maxTimeSeconds` y `createGame(levelFor(n))` empieza con `remainingTargets > 0`.
  - Con una campaña `{ 3: 1234 }`, `levelFor(3)` usa esa semilla.
  - Toda semilla de `campaignSeeds` da un nivel válido.
  - El nivel de reserva es válido.
- `tests/logic/generator.property.test.ts`: para 500 semillas en cada uno de los niveles 1, 7, 13, 22 y 40, todo nivel que `validateLevel` acepta cumple sus invariantes:
  - cada objetivo tiene unidades;
  - el inicio es transitable;
  - el tiempo es ≤ `maxTimeSeconds`;
  - `analyzeLevel(...).finalSize` es ≥ el tamaño mínimo de cada objetivo.
  Es la prueba de «nunca da un nivel imposible» del criterio de salida.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Las pruebas de dificultad, generador, validación, progresión y arquitectura pasan: `make test`
- [x] La suite de pruebas sigue por debajo de 30 s: `make test`
- [x] La compilación termina: `make build`

---

## Fase 6: Progresión de niveles en el juego

### Resumen

Cargar niveles generados, pasar al siguiente desde la capa de Victoria y mostrar el número de nivel.

### Cambios necesarios

#### 1. Textos

**Archivo**: `src/texts.ts`: `hud.level: 'Nivel'`, `result.wonButton: 'Siguiente'`.

#### 2. Capa de resultado

**Archivo**: `src/ui/result.ts`: `createResultOverlay(container, { onNext, onRetry })`. En Victoria, el botón llama a `onNext`. En Derrota, a `onRetry`.

#### 3. HUD

**Archivo**: `src/ui/hud.ts`: `showLevel(level)` también escribe «Nivel N» en una etiqueta junto a la tarjeta (`hudDisplay` o una función pura `levelLabel(n)` con prueba).

#### 4. Bucle principal

**Archivo**: `src/main.ts`
- `let game`, `let grass`, `let obstacleView` y `let levelNumber = 1`.
- `loadLevel(n)`:
  1. `grass.dispose()` y `obstacleView.dispose()`;
  2. `game = createGame(levelFor(n, campaignSeeds))`;
  3. se crean de nuevo las vistas con `game.level.seed`;
  4. `hud.showLevel(game.level)`, el foco de la cámara en la cuchilla y `resultOverlay.hide()`.
- Al arrancar se llama a `loadLevel(1)`. «Siguiente» llama a `loadLevel(levelNumber + 1)` y «Reintentar» a `restart()`.
- Con `?debug`, `window.__siega` pasa a ser un getter de la partida actual: `Object.defineProperty(window, '__siega', { get: () => game })`.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La compilación termina: `make build`

#### Verificación manual:
- [ ] En el móvil se juega del nivel 1 al 7 con «Siguiente». En el 4 aparece el hielo como objetivo y en el 7 el trigo enseña «Necesitas más tamaño».
- [ ] Al cambiar de nivel no quedan briznas ni obstáculos del nivel anterior, y la memoria no crece (pestaña Rendimiento, juicio aproximado).

---

## Fase 7: Modelos glTF CC0 y comprobación de tamaño

### Resumen

Sustituir las formas provisionales por los modelos de Kenney y comprobar que la carga inicial pesa menos de 2 MB.

### Cambios necesarios

#### 1. Recursos

**Archivos** en `public/models/` (Vite los sirve tal cual bajo `/siega-total/`):

| Archivo | Origen |
| --- | --- |
| `rock.glb` | Nature Kit `Models/GLTF format/rock_largeA.glb` |
| `cactus.glb` | Nature Kit `Models/GLTF format/cactus_tall.glb` |
| `watermelon.glb` | Food Kit `Models/GLB format/watermelon.glb` |
| `strawberry.glb` | Food Kit `Models/GLB format/strawberry.glb` |
| `Textures/colormap.png` | Food Kit `Models/GLB format/Textures/colormap.png` (la referencian los dos GLB del Food Kit) |

Se descargan de las URL de «Hallazgos clave», se copian con el nombre de la tabla y se añaden al repositorio.

**Archivo**: `CREDITS.md`: Kenney Nature Kit y Food Kit 2.0, CC0 1.0, con su URL y los archivos usados.

#### 2. Carga

**Archivo**: `src/render/obstacleModels.ts`: `loadObstacleModels(baseUrl: string): Promise<ObstacleModels>` con `GLTFLoader` (`three/addons/loaders/GLTFLoader.js`).
- Recorre la escena de cada modelo y crea una parte por malla, con su matriz de mundo aplicada a la geometría.
- Escala el modelo para que el radio de su huella (la mitad del mayor lado X/Z de la caja) sea `obstacleRadius(type)`, y lo apoya en y = 0.
- `normalizedScale(box, radius)` es una función pura con prueba en `tests/render/obstacleModels.test.ts`.

**Archivo**: `src/main.ts`: `loadObstacleModels(import.meta.env.BASE_URL + 'models/')`. Mientras carga, se usan `placeholderObstacleModels()`. Al terminar, se crea de nuevo la vista de obstáculos del nivel actual con los modelos cargados (los cortes ya hechos se mantienen con `markCut` de las piezas cortadas). Si la carga falla, se siguen usando las formas provisionales y se avisa con `console.warn`.

#### 3. Comprobación de tamaño

**Archivo**: `scripts/check-size.mjs` (nuevo): suma el tamaño gzip de todos los archivos de `dist/` salvo los fragmentos `panel-*.js`, imprime el total y falla si pasa de 2 MB (`2 * 1024 * 1024`).

**Archivo**: `Makefile`: objetivo `size: build` → `node scripts/check-size.mjs`.

**Archivo**: `.github/workflows/deploy.yml`: paso `make size` después de `make build`.

### Criterios de éxito

#### Verificación automática:
- [ ] Los tipos pasan: `make check`
- [ ] Todas las pruebas pasan: `make test`
- [ ] Los modelos llegan a la compilación: `make build && ls dist/models/rock.glb dist/models/cactus.glb dist/models/watermelon.glb dist/models/strawberry.glb dist/models/Textures/colormap.png`
- [ ] La carga inicial pesa menos de 2 MB comprimidos: `make size`
- [ ] `CREDITS.md` cita los dos paquetes: `grep -q 'Nature Kit' CREDITS.md && grep -q 'Food Kit' CREDITS.md`

#### Verificación manual:
- [ ] Los modelos se ven del tamaño de su círculo de choque. La cuchilla no atraviesa visualmente la roca (juicio visual).
- [ ] La sandía y la fresa conservan sus colores (la textura `colormap.png` carga en GitHub Pages).
- [ ] Mantiene 55–60 fps en el móvil en un nivel con 30 frutas.

---

## Fase 8: Panel del generador (`?debug`)

### Resumen

Herramientas para curar la campaña: saltar de nivel, cargar semillas y copiar la semilla buena.

### Cambios necesarios

#### 1. Panel

**Archivo**: `src/debug/panel.ts`

```ts
export interface DebugActions {
  restart(): void;
  markCut(cut: { blades: number[]; obstacles: number[] }): void;
  /** Plays `level` as level `level.number`. */
  playLevel(level: LevelDefinition): void;
}
export function createDebugPanel(getGame: () => Game, actions: DebugActions): DebugPanel;
```

- **Carpetas nuevas:** `generator` (los números de la curva; `unlockLevel` en una subcarpeta), `obstacles` (radio, tamaño y crecimiento por tipo) y `collision`. Los valores del generador llevan la nota «(al generar)». Los radios llevan «(al reiniciar)».
- **Carpeta «Nivel»:**
  - campos `nivel` y `semilla`;
  - **Ir al nivel:** `playLevel(levelFor(nivel, campaignSeeds))`;
  - **Cargar semilla:** `playLevel(generateLevel(nivel, semilla))`;
  - **Otra semilla:** `playLevel(firstValidLevel(nivel, intentoActual + 1))`;
  - **Copiar semilla:** copia `  ${nivel}: ${semilla},` para pegarlo en `campaign.ts`.
- **Monitor:** nivel, semilla, patrón, motivo de rechazo si la semilla cargada no es válida, y objetivos restantes (la suma).
- `main.ts` implementa `playLevel` con el mismo código que `loadLevel` (`showLevel(level)` comparte el cuerpo).

#### 2. Textos

**Archivo**: `src/texts.ts`: `debug.level`, `seed`, `goToLevel`, `loadSeed`, `anotherSeed`, `copySeed`, `pattern`, `rejection` y `onGenerate`.

### Criterios de éxito

#### Verificación automática:
- [ ] Los tipos pasan: `make check`
- [ ] Todas las pruebas pasan: `make test`
- [ ] El panel sigue en un fragmento aparte: `make build && grep -l 'lil-gui' dist/assets/*.js` encuentra un archivo y `! grep -q 'lil-gui' dist/assets/index-*.js`
- [ ] La carga inicial pesa menos de 2 MB comprimidos: `make size`

#### Verificación manual:
- [ ] Con `?debug`, «Ir al nivel 22» carga un nivel con cactus objetivo.
- [ ] «Otra semilla» cambia el campo y «Copiar semilla» deja en el portapapeles una línea que se puede pegar en `campaign.ts`.
- [ ] Criterio de salida de M3: en el móvil se juegan los niveles 1→25 seguidos con «Siguiente», y cada elemento aparece en su nivel.

---

## Estrategia de pruebas

### Pruebas unitarias (Vitest)

- **Niveles:** arena bajo los obstáculos duros y nivel de muestra.
- **Obstáculos:** corte por tamaño, la roca nunca se corta, sin doble corte y reinicio.
- **Choques:** paredes de hierba dura, deslizamiento, rocas, fruta según el tamaño y esquinas.
- **Juego:** varios objetivos, crecimiento con fruta, onda sin rocas, reinicio con obstáculos y los errores de M2 corregidos.
- **Patrones:** forma, determinismo y regiones presentes en los 7.
- **Dificultad:** desbloqueos y curva.
- **Generador:** determinismo, objetivo nuevo, claro de inicio, separación de obstáculos y solo tipos desbloqueados.
- **Validación:** casos posibles e imposibles hechos a mano.
- **Progresión:** `levelFor(1..60)` es válido, la campaña y la reserva.
- **Propiedad:** 500 semillas en 5 niveles; todo nivel aceptado cumple las invariantes.
- **Render puro:** `burstMotion` y `normalizedScale`.
- **UI pura:** `hudDisplay` con varios objetivos, `blockedNotice` y `levelLabel`.

Las pruebas leen `config.ts` y no repiten números de equilibrio. Los niveles de prueba se crean pequeños y a mano. Las pruebas de propiedad usan semillas fijas, así que son deterministas.

### Prueba de arquitectura

Sin cambios en la regla. Cubre `obstacles.ts`, `collision.ts`, `patterns.ts`, `difficulty.ts`, `generator.ts`, `validation.ts` y `progression.ts`.

### Pruebas manuales

Solo para lo visual y el dispositivo real: deslizamiento y aviso, explosiones, legibilidad de la tarjeta, modelos, fps y la partida 1→25.

## Rendimiento

- **Choques:** cada frame revisa como mucho las ~9–16 celdas que toca la cuchilla y todos los obstáculos (≤ 40). Es despreciable.
- **Obstáculos:** una llamada de dibujo por pieza de cada tipo (sandía, 8 mallas; las demás, de 1 a 3). En total, unas 15 llamadas como máximo, todas instanciadas. Hay 12 000 briznas en 2–4 capas, como en M2.
- **Explosiones:** un `InstancedMesh` fijo de 200 cubos. Se actualiza solo mientras hay piezas vivas.
- **Generación:** `levelFor` tarda < 50 ms por nivel en el móvil (flood fill de 900 celdas × pocas iteraciones × ≤ 50 intentos). Se mide en la verificación manual. Si se nota, se guarda en caché el último nivel generado.
- **Cambio de nivel:** `dispose()` libera la geometría y los materiales para que la memoria no crezca entre niveles. Los modelos glTF se cargan una sola vez y se comparten.
- **Carga inicial:** unos 140 KB de modelos + la textura. El JS no cambia apenas (`GLTFLoader` añade ~40 KB). Con `make size` se vigila el límite de 2 MB.

## Notas de migración

No aplica: no hay datos guardados. `LevelDefinition` cambia `target` por `targets` y añade `number`, `seed` y `obstacles`. `stripesLevel` y las pruebas se adaptan en la fase 1. `StepResult` añade `cutObstacles` y `blocked`.

## Referencias

- Especificación: `plan.md`
- Plan anterior: `thoughts/shared/plans/2026-10-20-siega-total-m2-nivel-fijo.md`
- Tamaño, rebote y deslizamiento: `plan.md:59-76`
- Hierbas y obstáculos: `plan.md:92-108`
- Generador, validación, campaña y curva: `plan.md:110-138`
- Recursos CC0: `plan.md:244-252`
- Panel de depuración: `plan.md:293-300`
- Capturas de referencia de Grass Master aportadas por el usuario: franjas y tablero de hielo, campo de fútbol, huerto con fresas, camino con sandías, cactus con «Need bigger size» y tarjeta con varios objetivos.
- Kenney Nature Kit: https://kenney.nl/assets/nature-kit — Kenney Food Kit: https://kenney.nl/assets/food-kit
