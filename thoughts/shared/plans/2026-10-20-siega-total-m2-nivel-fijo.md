# Siega Total M2: nivel fijo con la regla completa — Plan de implementación

## Resumen

Este plan convierte el prototipo de corte de M1 en un nivel jugable con la regla completa del juego. El campo tiene hierba verde y hielo en franjas, y la hierba objetivo es el hielo. El jugador gana al cortar todo el hielo antes de que acabe el tiempo. Una onda corta entonces el resto del campo. Si el tiempo llega a cero, pierde. En los dos casos puede volver a jugar.

M2 valida la regla antes de automatizarla (`plan.md:320`). El generador de niveles (M3) producirá el mismo formato de nivel que este plan define a mano.

## Análisis del estado actual

- M0 y M1 están terminados y publicados en `https://nikeyes.github.io/siega-total/`.
- `src/logic/field.ts:46-66`: `createField` reparte `bladeCount` briznas al azar por todo el campo, todas del mismo tipo (`types.fill(...)`, línea 61).
- `src/logic/field.ts:8`: `MIN_SIZE_BY_TYPE` se calcula una vez al cargar el módulo. `cutInCircle` (línea 139) ya salta las briznas con tamaño mínimo mayor que el de la cuchilla.
- `src/logic/game.ts:5-28`: `Game = { field, blade }`. No hay tiempo, objetivo, estado ni victoria. `stepGame` siempre mueve y corta.
- `src/render/grass.ts:91-133`: un solo `InstancedMesh` con colores verdes fijos. `markCut` escribe el tiempo de corte por índice del campo.
- `src/main.ts:50-71`: bucle sin fin, sin HUD ni pantallas. `?debug` carga `src/debug/stats.ts` con `import()` dinámico y expone `window.__siega`.
- `src/config.ts`: `as const`, de solo lectura. Ya tiene la tabla de hierbas (`grassTypes`).
- `src/texts.ts`: solo textos de depuración.
- `plan.md:318` (lista de hitos) está vacía. El alcance de M2 sale de `plan.md:320`, del apartado «Qué NO hacemos» del plan de M1 y de las decisiones de abajo.

## Estado final deseado

1. Al abrir la página, el campo de 30 × 30 m muestra franjas de 3 m de hierba verde y hielo, con ~12 000 briznas en total.
2. El HUD muestra arriba a la izquierda un anillo de tiempo con `m:ss` y una tarjeta con el icono del hielo y una barra que se vacía según el hielo restante. Bajo la cuchilla, una píldora «Tamaño N» se llena hacia el siguiente tamaño.
3. El tiempo (90 s) empieza con el primer movimiento del jugador.
4. Con menos de 10 briznas de hielo restantes, esas briznas brillan y crecen un poco.
5. Al cortar la última brizna de hielo, una onda sale de la cuchilla y corta todo el campo. Después aparece la capa «¡Nivel completado!» con el botón «Otra vez».
6. Si el tiempo llega a 0, aparece la capa «¡Se acabó el tiempo!» con el botón «Reintentar».
7. Los dos botones reinician el nivel sin crear de nuevo la escena.
8. Con `?debug`, un panel `lil-gui` permite editar `config`, ganar al instante, dejar 3 s, reiniciar, copiar la configuración y ver FPS, briznas, objetivo restante y estado. La compilación de producción no lo carga sin `?debug`.
9. `make check test build` pasa. La lógica nueva tiene pruebas Vitest.

### Decisiones (resueltas con grill-me)

| Tema | Decisión |
| --- | --- |
| Alcance | Un nivel fijo con verde + hielo en franjas. El objetivo es el hielo. Tiempo, progreso, victoria con onda, derrota, reintento, resaltado gratuito y panel `lil-gui`. |
| Criterio de salida | Se puede ganar y perder el nivel en el móvil. Pasan las pruebas de progreso, tiempo y victoria/derrota. |
| Formato del nivel | Cuadrícula de tipos (`LevelDefinition`) creada con una función de patrón (`stripesLevel()`), el mismo formato que usará el generador de M3. |
| Objetivo | Un solo tipo de hierba objetivo, según `plan.md:47`. |
| Tarjeta objetivo | Icono SVG en línea dibujado en código + barra que se vacía, sin número. |
| Temporizador | Círculo con `m:ss` y un anillo que se vacía. |
| Render | Un `InstancedMesh` por tipo presente en el nivel (`plan.md:228`). |
| Onda de victoria | Va en la lógica. Corta todo, sin mirar el tamaño mínimo, y no suma a la barra de tamaño. La capa de Victoria sale al terminar la onda. |
| Derrota y reintento | Capas mínimas con un botón. Reintentar reinicia el estado y la hierba sin crear de nuevo la escena. |
| Inicio del tiempo | Con el primer movimiento (`ready` → `playing`). |
| Pausa | No entra en M2. El límite de `dt` ya evita saltos al volver a la pestaña. |
| Resaltado gratuito | Entra: con menos de `highlightBelow` (10) briznas objetivo restantes. |
| Panel `lil-gui` | Entra: edita `config` por secciones, acciones Ganar / Tiempo 3 s / Reiniciar / Copiar config, monitor. Sustituye a `stats.ts`. Sin saltar de nivel, semillas ni monedas. |
| Verificaciones manuales de M1 | El usuario las repasa antes de empezar M2. No forman parte de este plan. |

### Hallazgos clave

- `plan.md:47-50`: icono + barra de progreso. Progreso = briznas objetivo cortadas ÷ total. La onda corta el resto. La hierba no objetivo no cuenta para ganar.
- `plan.md:115-117`: la salida del generador es una cuadrícula de tipos. Las briznas se colocan sobre ella. El contador de objetivo siempre es exacto.
- `plan.md:172`: resaltado gratuito con menos de 10 briznas objetivo restantes.
- `plan.md:228`: un `InstancedMesh` por tipo.
- `plan.md:293-300`: panel de depuración. La compilación de producción no lo incluye.
- `src/logic/field.ts:139`: `cutInCircle` con `bladeSize = Infinity` corta cualquier tipo. La onda lo aprovecha.
- `src/main.ts:53`: `dt` se limita a 0,05 s y `requestAnimationFrame` se detiene con la pestaña oculta, así que el tiempo no corre en segundo plano.

## Qué NO hacemos

- Obstáculos (roca, cactus, fruta), colisiones, rebote y «Necesitas más tamaño».
- Trigo, lavanda y zarza en el campo. La tabla de `config.grassTypes` sigue completa.
- Varios objetivos por nivel.
- Monedas, «+N» flotante, bonus de tiempo, mejoras y boosters.
- Pantallas de Inicio, Tienda, Ajustes y Pausa. Botón de pausa y pausa por `visibilitychange`.
- Tutorial con la mano animada.
- Guardado en `localStorage`.
- Confeti, lluvia de monedas, sonido y vibración.
- Generador, semillas y campaña (M3). En el panel: saltar a nivel N, cargar semilla y dar monedas.
- Densidad y tamaño del campo editables en el panel (exigen crear de nuevo la escena).
- Calidad automática. M2 sigue en calidad media (12 000 briznas, 1,5×).

## Enfoque de implementación

1. Primero la lógica pura, con TDD: nivel y campo con varios tipos (fase 1) y después las reglas de la partida (fase 2).
2. Después el render con varios tipos (fase 3), que solo lee el campo.
3. Después el HUD, las capas de resultado y el bucle principal (fase 4). Al final de esta fase el nivel es jugable.
4. Al final, el panel de depuración (fase 5).

Cada fase deja `make check test build` en verde y se puede publicar sola.

---

## Fase 1: Nivel y campo con varios tipos (lógica)

### Resumen

Definir el formato del nivel, crear el nivel de franjas y hacer que el campo coloque briznas de varios tipos sobre la cuadrícula. El campo lleva la cuenta de briznas totales y cortadas por tipo.

### Cambios necesarios

#### 1. Configuración

**Archivo**: `src/config.ts`: añadir

```ts
level: {
  timeSeconds: 90,
  stripeWidthMeters: 3,
  winWaveSpeed: 25,
  highlightBelow: 10,
},
```

`field.bladeCount` (12 000) pasa a ser el número de briznas que se reparten sobre las celdas con hierba. Es el máximo de la calidad media (`plan.md:216`).

#### 2. Definición de nivel

**Archivo**: `src/logic/levels.ts` (nuevo)

```ts
export interface LevelDefinition {
  width: number;
  depth: number;
  /** Side of each square cell, in meters. */
  cellSize: number;
  /** Row by row (`cell = row * columns + column`); null = sand, no grass. */
  cells: readonly (GrassType | null)[];
  target: GrassType;
  /** Not readonly: the debug panel tunes it, and resetGame reads it. */
  timeSeconds: number;
}

/** Vertical stripes of green and ice across the configured field; ice is the target. */
export function stripesLevel(): LevelDefinition;
```

- `stripesLevel()` usa `config.field.width`/`depth`, celdas de 1 m y `config.level.stripeWidthMeters`. La franja de `x ∈ [0, 3)` es verde, la siguiente hielo, y así sucesivamente. `target: 'ice'`, `timeSeconds: config.level.timeSeconds`.

**Pruebas** (`tests/logic/levels.test.ts`):
- La cuadrícula tiene `columns × rows` celdas.
- La primera franja es verde y la segunda es hielo. Todas las celdas de una columna tienen el mismo tipo.
- Cada franja mide `stripeWidthMeters` de ancho.
- El objetivo es el hielo y el tiempo es `config.level.timeSeconds`.

#### 3. Campo sobre la cuadrícula

**Archivo**: `src/logic/field.ts`

```ts
export interface FieldOptions {
  width: number;
  depth: number;
  cellSize: number;
  cells: readonly (GrassType | null)[];
  bladeCount: number;
  gridCellSize: number;
  seed: number;
}

export interface Field {
  // … campos actuales …
  /** Blades of each type, indexed like GRASS_TYPE_ORDER. */
  readonly countByType: Int32Array;
  /** Cut blades of each type, indexed like GRASS_TYPE_ORDER. */
  readonly cutByType: Int32Array;
}

export function levelFieldOptions(level: LevelDefinition): FieldOptions;  // level + config.field
```

- `createField` reparte las `bladeCount` briznas entre las celdas con hierba por turnos: la brizna `i` va a la celda con hierba `i % celdasConHierba`, en una posición al azar dentro de la celda (con `createRandom(seed)` y `randomFloat32Below`). La brizna toma el tipo de su celda. Así, la densidad es uniforme (13 o 14 briznas por celda de 1 m² con 12 000 briznas en 900 celdas).
- Las celdas `null` no reciben briznas.
- `countByType` se calcula al crear el campo. `cutInCircle` suma `cutByType[type]` además de `cutCount`.
- Se quita la opción `grassType`.

**Pruebas** (`tests/logic/field.test.ts`, adaptar las actuales con un ayudante `uniformCells(type)`):
- Cada brizna está dentro de su celda y tiene el tipo de esa celda.
- Ninguna brizna cae en una celda `null`.
- La suma de `countByType` es `bladeCount`. En un campo de franjas, `countByType` coincide con un recuento de `types`.
- Todas las celdas con hierba reciben `floor` o `ceil` de `bladeCount / celdasConHierba` briznas.
- Al cortar, `cutByType` sube solo en el tipo cortado. Un círculo que cubre todo el campo deja `cutByType` igual a `countByType`.
- `cutInCircle` con `bladeSize = Infinity` corta todos los tipos.
- Las pruebas actuales (fuerza bruta, límite inclusivo, tamaño mínimo, sin doble conteo, círculos fuera del campo) siguen pasando.

#### 4. Juego sobre un nivel

**Archivo**: `src/logic/game.ts`: `createGame(level: LevelDefinition = stripesLevel())` crea el campo con `levelFieldOptions(level)`. El resto de `game.ts` cambia en la fase 2.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Las pruebas de niveles, campo y arquitectura pasan: `make test`
- [x] La compilación termina: `make build`

---

## Fase 2: Reglas de la partida (lógica)

### Resumen

Estados de la partida, tiempo, progreso del objetivo, onda de victoria, derrota, reinicio y resaltado gratuito.

### Cambios necesarios

#### 1. Juego

**Archivo**: `src/logic/game.ts`

```ts
export type GameStatus = 'ready' | 'playing' | 'winWave' | 'won' | 'lost';

export interface WinWave {
  x: number;
  z: number;
  radius: number;
}

export interface Game {
  readonly level: LevelDefinition;
  readonly field: Field;
  readonly blade: Blade;
  /** Index into GRASS_TYPE_ORDER. */
  readonly targetType: number;
  status: GameStatus;
  timeLeft: number;
  winWave: WinWave | null;
}

export function createGame(level?: LevelDefinition): Game;
export function resetGame(game: Game): void;
export function stepGame(game: Game, direction: Direction | null, dt: number): StepResult;
export function remainingTargets(game: Game): number;
export function targetProgress(game: Game): number;       // 0..1, cortadas ÷ total
export function shouldHighlightTargets(game: Game): boolean;
export function cutAllTargets(game: Game): number[];      // solo para depuración
```

Reglas de `stepGame`:
- **`ready`**: sin dirección, no pasa nada (ni movimiento, ni corte, ni tiempo). Con dirección, el estado pasa a `playing` y el paso sigue como `playing`.
- **`playing`**:
  1. `timeLeft -= dt`.
  2. Mueve la cuchilla, corta con `bladeRadius(size)` y `blade.size`, y suma los cortes a la barra de tamaño (igual que en M1).
  3. Si `remainingTargets === 0`: el estado pasa a `winWave` y `winWave = { x: blade.x, z: blade.z, radius: 0 }`. La victoria se comprueba antes que la derrota: cortar la última brizna en el último frame gana.
  4. Si no, y `timeLeft ≤ 0`: `timeLeft = 0` y el estado pasa a `lost`.
- **`winWave`**:
  1. La cuchilla frena (`moveBlade` sin dirección).
  2. `radius += winWaveSpeed × dt` y corta con `cutInCircle(field, wave.x, wave.z, radius, Infinity)`. Estos cortes van en `cutIndices`, pero no suman a la barra de tamaño (`sizesGained = 0`).
  3. Cuando el radio alcanza la distancia a la esquina más lejana del campo, el estado pasa a `won`.
- **`won`** y **`lost`**: la cuchilla frena y no corta. El tiempo no cambia.

Otras funciones:
- `remainingTargets = countByType[targetType] − cutByType[targetType]`.
- `targetProgress = cutByType[targetType] ÷ countByType[targetType]`.
- `shouldHighlightTargets`: estado `playing` y `0 < remainingTargets < config.level.highlightBelow`.
- `resetGame`: pone `cut` a 0, `cutCount` y `cutByType` a 0, la cuchilla nueva en el centro (`createBlade`), `timeLeft = level.timeSeconds`, `status = 'ready'` y `winWave = null`. Las posiciones de las briznas no cambian.
- `cutAllTargets`: corta todas las briznas objetivo en pie y devuelve sus índices. Si el estado es `ready`, pasa a `playing`. El siguiente `stepGame` detecta la victoria.

#### 2. Fracción de crecimiento

**Archivo**: `src/logic/blade.ts`: `growthFraction(blade): number = growthProgress ÷ cutsToNextSize(size)`, para la píldora «Tamaño N».

**Pruebas** (`tests/logic/blade.test.ts`): 0 con una cuchilla nueva, 0,5 a mitad de camino y 0 justo después de subir de tamaño.

**Pruebas** (`tests/logic/game.test.ts`, con niveles pequeños creados en la prueba):
- **Estado inicial:** una partida nueva está en `ready` con `timeLeft = timeSeconds`.
- **`ready`:** sin dirección, después de un segundo de pasos, el tiempo, la cuchilla y `cutCount` no cambian.
- **Inicio:** el primer paso con dirección pasa a `playing`, mueve la cuchilla y resta `dt` al tiempo.
- **Progreso:** `targetProgress` es cortadas ÷ total del objetivo. Cortar hierba verde no lo cambia.
- **Victoria:** al cortar la última brizna objetivo, el estado pasa a `winWave` con la onda en la posición de la cuchilla.
- **Onda:**
  - Corta hierba de cualquier tipo y tamaño mínimo.
  - No cambia `blade.size` ni `growthProgress`.
  - Termina en `won` con `cutCount === bladeCount`.
  - Tarda `distanciaMáxima ÷ winWaveSpeed` (± un paso).
- **Derrota:** con hielo sin cortar, al agotar el tiempo el estado pasa a `lost` y `timeLeft` es exactamente 0.
- **Victoria y derrota en el mismo paso:** cortar la última brizna objetivo en el paso que agota el tiempo gana.
- **`won` y `lost`:** el tiempo no cambia y no se corta nada más.
- **Resaltado:** con `highlightBelow` restantes no resalta, y con `highlightBelow − 1` sí. Con 0 restantes, o fuera de `playing`, no resalta.
- **Reinicio:** después de jugar y perder, `resetGame` deja un estado igual al de `createGame` con el mismo nivel (posiciones, `cut`, contadores, cuchilla, tiempo y estado).
- **Depuración:** `cutAllTargets` desde `ready` deja `remainingTargets === 0`, y el siguiente paso pasa a `winWave`.
- **Pruebas de M1 que siguen:** adaptar las actuales (trayectoria, crecimiento, radio nuevo, recorrido completo) para que empiecen con un paso con dirección. La prueba «en el primer paso sin dirección, corta bajo la posición inicial» cambia: ahora, en `ready`, no corta.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Las pruebas de cuchilla, juego y arquitectura pasan: `make test`
- [x] La compilación termina: `make build`

---

## Fase 3: Render con varios tipos

### Resumen

Una malla por tipo presente en el nivel, colores por tipo, reinicio de la hierba y resaltado de la capa objetivo.

### Cambios necesarios

#### 1. Hierba

**Archivo**: `src/render/grass.ts`

```ts
export interface GrassView {
  setTime(time: number): void;
  markCut(indices: number[], time: number): void;
  /** Puts every blade back to standing. */
  reset(): void;
  /** Makes the standing blades of `type` glow; null turns it off. */
  setHighlight(type: number | null): void;
}
```

- `createGrassView(scene, field, seed)` crea una capa por tipo con `countByType[type] > 0`. Cada capa tiene su `InstancedMesh`, su `instanceCutTime` y su `ShaderMaterial` con los colores del tipo.
- `instanceOf: Int32Array(bladeCount)` guarda la instancia de cada brizna en su capa. `markCut` agrupa los índices por capa y sube a la GPU solo el rango cambiado de cada capa.
- `reset()` rellena todos los `instanceCutTime` con `STANDING` y sube el atributo entero.
- Colores visuales con nombre en `src/render/grassColors.ts` (nuevo, lo comparte el HUD de la fase 4), uno por cada tipo de `GRASS_TYPE_ORDER`:

  | Tipo | Base | Punta |
  | --- | --- | --- |
  | Verde | `0x1f7a0c` | `0x8fe03a` (los de M1) |
  | Hielo | `0x9fc3dd` | `0xf4fbff` |
  | Trigo, lavanda, zarza | Colores provisionales de `plan.md:94-100` (no aparecen en M2) | |

- **Resaltado:** uniform `highlight` (0 o 1). Con `highlight = 1`, en el vertex shader, las briznas en pie (`instanceCutTime < 0`) crecen un 30 % en altura. En el fragment shader, el color se aclara con un pulso `0,5 + 0,5 × sin(time × 6)`. Las briznas cortadas no cambian.
- La forma de mata y la bajada al cortar no cambian. Los restos del corte toman el color del tipo, así que el hielo deja recortes azulados.

#### 2. Píldora de tamaño: posición en pantalla

**Archivo**: `src/render/cameraRig.ts`: `toScreen(x, y, z, width, height): { x: number; y: number }`. Proyecta un punto del campo a píxeles del contenedor con `Vector3.project(camera)`. El HUD lo usa para colocar la píldora bajo la cuchilla.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La compilación termina: `make build`

---

## Fase 4: HUD, capas de resultado y bucle principal

### Resumen

Mostrar el tiempo, el objetivo y el tamaño. Mostrar Victoria y Derrota. Conectar el bucle con los estados y el reinicio. Al terminar esta fase, el nivel es jugable.

### Cambios necesarios

#### 1. Textos

**Archivo**: `src/texts.ts`

```ts
export const texts = {
  hud: {
    size: 'Tamaño',
  },
  result: {
    wonTitle: '¡Nivel completado!',
    wonButton: 'Otra vez',
    lostTitle: '¡Se acabó el tiempo!',
    lostButton: 'Reintentar',
  },
  debug: { /* … ver fase 5 … */ },
} as const;
```

#### 2. Formato del reloj

**Archivo**: `src/ui/clock.ts`: `formatClock(seconds: number): string`, que redondea hacia arriba (`89,2 → "1:30"`, `0,1 → "0:01"`, `0 → "0:00"`, `60 → "1:00"`). No usa el DOM.

**Pruebas** (`tests/ui/clock.test.ts`): los casos anteriores y `9 → "0:09"`.

#### 3. HUD

**Archivo**: `src/ui/hud.ts`

```ts
export interface Hud {
  update(state: {
    timeLeft: number;
    timeTotal: number;
    remainingFraction: number;    // 1 − targetProgress
    size: number;
    growthFraction: number;
    sizeLabelX: number;           // píxeles, de toScreen
    sizeLabelY: number;
  }): void;
}

export function createHud(container: HTMLElement, target: GrassType): Hud;
```

- **Temporizador:** círculo azul oscuro con borde grueso. Anillo verde con `conic-gradient` según `timeLeft ÷ timeTotal` y `formatClock` en el centro.
- **Tarjeta objetivo:** caja clara junto al temporizador, con el icono SVG del tipo (una mata de puntas con los colores base/punta del tipo, dibujada en código) y debajo una barra azul que se vacía según `remainingFraction`.
- **Píldora «Tamaño N»:** bajo la cuchilla, en `(sizeLabelX, sizeLabelY + desplazamiento)`. Se llena según `growthFraction`.
- `update` solo escribe en el DOM cuando cambia un valor que se muestra (segundos enteros, porcentaje redondeado de la barra, tamaño o posición).
- Estilo de `plan.md:253`: colores planos y saturados, fuente redondeada y gruesa con contorno (pila de fuentes del sistema; sin fuente externa en M2), bordes gruesos y redondeados como en las capturas de referencia.

Los colores del icono y de la hierba son los mismos. Se definen una sola vez en `src/render/grassColors.ts` (`GRASS_COLORS: Record<GrassType, { base: number; tip: number }>`). `grass.ts` y `hud.ts` los importan.

#### 4. Capas de resultado

**Archivo**: `src/ui/result.ts`

```ts
export interface ResultOverlay {
  show(outcome: 'won' | 'lost'): void;
  hide(): void;
}

export function createResultOverlay(container: HTMLElement, onReplay: () => void): ResultOverlay;
```

Una capa semitransparente sobre el juego con el título y un botón grande. El botón llama a `onReplay`. Los eventos de puntero de la capa no llegan al joystick (`stopPropagation` en `pointerdown`).

#### 5. Estilos

**Archivo**: `src/ui/styles.css`: estilos del temporizador, la tarjeta, la barra, la píldora y las capas de resultado.

#### 6. Bucle principal

**Archivo**: `src/main.ts`
1. Crea `Game` (`createGame()`), la escena, la hierba, la cuchilla, la cámara, el joystick, el teclado, el HUD y la capa de resultado.
2. `restart()`: `resetGame(game)`, `grass.reset()`, `Object.assign(focus, createCameraFocus(...))`, `result.hide()`.
3. En cada frame:
   - `result = stepGame(game, direction, dt)` y `grass.markCut(result.cutIndices, time)`.
   - `grass.setHighlight(shouldHighlightTargets(game) ? game.targetType : null)`.
   - Si el estado cambió a `won` o `lost` en este frame, `resultOverlay.show(estado)`.
   - Cámara, cuchilla y hierba como en M1. La cámara sigue a la cuchilla también durante la onda.
   - `hud.update(...)` con `toScreen` de la posición de la cuchilla.
4. `stats.ts` se mantiene hasta la fase 5.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan (incluida `formatClock`): `make test`
- [x] La compilación termina: `make build`

#### Verificación manual:
- [ ] En el móvil se puede ganar el nivel: la onda corta el campo y aparece «¡Nivel completado!». «Otra vez» empieza de cero.
- [ ] En el móvil se puede perder: aparece «¡Se acabó el tiempo!». «Reintentar» empieza de cero.
- [ ] El HUD se lee bien en 390 × 844 y no tapa la cuchilla (juicio visual).
- [ ] El hielo se distingue bien del verde y sus restos se ven azulados (juicio visual).
- [ ] El resaltado de las últimas briznas se ve desde la distancia de la cámara.
- [ ] Con `?debug`, el móvil sigue a 55–60 fps al cortar.

---

## Fase 5: Panel `lil-gui` (`?debug`)

### Resumen

Panel de depuración para equilibrar el nivel: editar `config` en vivo, acciones rápidas y monitor. Sustituye a `stats.ts`.

### Cambios necesarios

#### 1. Configuración editable

**Archivo**: `src/config.ts`: quitar `as const`. Los tipos se infieren como `number` y las claves de `grassTypes` siguen dando `GrassType`. La lógica ya lee `config` en cada llamada.

**Archivo**: `src/logic/field.ts`: quitar `MIN_SIZE_BY_TYPE` del nivel de módulo. `cutInCircle` lee los tamaños mínimos de `config.grassTypes` al empezar cada llamada (cinco valores), para que el panel pueda cambiarlos.

#### 2. Dependencia

`npm install lil-gui` (versión actual, guardada en `package-lock.json`) en `dependencies`. Solo se importa desde `src/debug/`.

#### 3. Panel

**Archivo**: `src/debug/panel.ts` (sustituye a `src/debug/stats.ts`)

```ts
export interface DebugPanel {
  update(dt: number): void;
}

export function createDebugPanel(game: Game, actions: { restart(): void; markCut(indices: number[]): void }): DebugPanel;
```

- **Carpetas:** `blade`, `camera`, `level` y `grassTypes`, con un control numérico por valor. Los valores que solo se leen al reiniciar (`blade.startSize`) llevan la nota de `texts.debug.onRestart`. `level.stripeWidthMeters` no aparece en el panel, porque cambiarlo exige crear de nuevo el campo.
- **Tiempo del nivel:** el control de `level.timeSeconds` también escribe el valor en `game.level.timeSeconds` (`onChange`). `resetGame` lee `game.level.timeSeconds`, así que el cambio se aplica al reiniciar y lleva la nota «(al reiniciar)». Por eso `LevelDefinition.timeSeconds` no es `readonly`.
- **Acciones:**
  - **Ganar:** `actions.markCut(cutAllTargets(game))`.
  - **Tiempo 3 s:** `game.timeLeft = 3`.
  - **Reiniciar:** `actions.restart()`.
  - **Copiar config:** `navigator.clipboard.writeText(JSON.stringify(config, null, 2))`.
- **Monitor** (solo lectura, `.listen()`): FPS (media de 0,5 s, como `stats.ts`), briznas cortadas / total, objetivo restante y estado.

#### 4. Textos

**Archivo**: `src/texts.ts`: `debug` con `fps`, `bladesCut`, `targetsLeft`, `status`, `win`, `threeSeconds`, `restart`, `copyConfig` y `onRestart`.

#### 5. Bucle principal

**Archivo**: `src/main.ts`: con `?debug`, carga `./debug/panel` con `import()` dinámico (como hoy `stats.ts`) y llama a `panel.update(realSeconds)` en cada frame. `window.__siega` se mantiene.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] El panel queda en un fragmento aparte: `make build && grep -l 'lil-gui' dist/assets/*.js` encuentra un archivo y `! grep -q 'lil-gui' dist/assets/index-*.js`

#### Verificación manual:
- [ ] Con `?debug`, cambiar `blade.maxSpeed` cambia la velocidad al instante.
- [ ] «Ganar» lanza la onda y la capa de Victoria. «Tiempo 3 s» lleva a la derrota en 3 s.
- [ ] «Copiar config» deja en el portapapeles un JSON que se puede pegar en `config.ts`.
- [ ] Sin `?debug`, el panel no aparece y la red no descarga su fragmento.

---

## Desviaciones durante la implementación

- **Fase 1:** `randomFloat32Below` pasa a `randomFloat32Between(min, limit)` para colocar cada brizna dentro de su celda. La prueba «crece y corta con el radio nuevo» ahora va primero al borde oeste y crece yendo al este, porque con el nuevo reparto un carril de 15 m ya no llega al primer crecimiento.
- **Fase 2:** se extrae `cutBlade(field, blade)` en `field.ts` para que `cutInCircle` y `cutAllTargets` cuenten los cortes igual. La prueba del zigzag completo usa un nivel todo verde (objetivo verde) sin límite de tiempo, porque recorrer 30 × 30 m tarda más de 90 s.
- **Fase 3:** el reparto de briznas en capas (`layoutGrass`) y los rangos que cambian en `markCut` (`changedInstanceRanges`) viven en `src/render/grassLayout.ts`, sin Three.js, con pruebas en `tests/render/`. `toScreen` también tiene pruebas.
- **Fase 4:** `hudDisplay(state)` (función pura en `src/ui/hud.ts`) decide lo que muestra el HUD, redondeado; `createHud` solo escribe en el DOM cuando cambia. Tiene pruebas en `tests/ui/hud.test.ts`.
- **Fase 5:** `lil-gui@0.21.0` fijado exacto, como `three`.
- **Errores encontrados y no corregidos** (pruebas `- BUG` saltadas):
  - `createField` con un campo todo arena da briznas con posición `NaN` y tipo 255.
  - `targetProgress` da `NaN` en un nivel sin hierba objetivo.
  Ninguno se da con el nivel de franjas.

## Estrategia de pruebas

### Pruebas unitarias (Vitest)

- **Niveles:** forma de la cuadrícula, franjas, objetivo y tiempo.
- **Campo:** tipo por celda, sin briznas en arena, reparto uniforme, `countByType` y `cutByType` exactos, corte con tamaño infinito. Siguen las pruebas de M1.
- **Cuchilla:** `growthFraction`.
- **Juego:** `ready` → `playing` con el primer movimiento, tiempo, progreso, victoria antes que derrota, onda completa sin crecimiento, derrota con tiempo exacto a 0, estados finales quietos, resaltado en el umbral, reinicio igual a partida nueva, `cutAllTargets`.
- **Reloj:** `formatClock` redondea hacia arriba.

Las pruebas leen `config.ts` y no repiten números de equilibrio. Las pruebas de juego crean niveles pequeños (por ejemplo, 4 × 4 m con dos tipos) para que la victoria y la onda sean rápidas.

### Prueba de arquitectura

Sin cambios: `src/logic/levels.ts` queda cubierto por la regla existente.

### Pruebas manuales

Solo para lo visual y el dispositivo real: ganar y perder en el móvil, legibilidad del HUD, aspecto del hielo y del resaltado, fps y panel.

## Rendimiento

- Dos capas = dos llamadas de dibujo para la hierba. El número total de briznas no cambia (12 000).
- La onda llama a `cutInCircle` con un radio que crece hasta cubrir todo el campo. En el peor frame recorre las 900 celdas y las 12 000 briznas, pero salta las cortadas. Dura ~1,7 s y la cuchilla ya no se mueve. Si se nota en el móvil, se cambia a recorrer solo el anillo nuevo de celdas.
- El HUD solo toca el DOM cuando cambia lo que muestra. La píldora se mueve con `transform` para no forzar el diseño de la página.
- `reset()` sube todo el atributo de tiempos de corte una vez por reinicio.
- El resaltado es un uniform. No añade trabajo en la CPU.

## Notas de migración

No aplica: no hay datos guardados. `createField` cambia de opciones (`grassType` → `cells`), y las pruebas de campo se adaptan en la fase 1.

## Referencias

- Especificación: `plan.md`
- Plan anterior: `thoughts/shared/plans/2026-10-20-siega-total-m0-m1-prototipo-de-corte.md`
- Reglas de victoria y derrota: `plan.md:45-51`
- Generador (formato de cuadrícula): `plan.md:110-117`
- Resaltado gratuito: `plan.md:172`
- Hierba por tipo: `plan.md:225-229`
- Panel de depuración: `plan.md:293-300`
- Capturas de referencia de Grass Master aportadas por el usuario (HUD, franjas de hielo, píldora de tamaño).
