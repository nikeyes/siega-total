# Siega Total M4: economía, mejoras, boosters y guardado — Plan de implementación

## Resumen

M4 cierra el bucle de juego. El jugador juega, gana monedas y compra mejoras y boosters, y el progreso queda guardado. Para ello añade:

- **Monedas:** se ganan al cortar hierba, fruta y cactus, y la onda de victoria también da. Hay un bonus por el tiempo sobrante, un contador en el HUD y un «+N» flotante agrupado.
- **Mejoras permanentes:** tamaño inicial, velocidad, tiempo extra y crecimiento. Se aplican a la partida, no a `config`.
- **Boosters:**
  - Mejora: +1 tamaño.
  - Brújula: una flecha en el suelo durante 15 s.
  - Reloj: +30 s, también desde la Derrota para continuar la partida.
- **Guardado** versionado en `localStorage`, con migración y saneado.
- **Pantallas:** Inicio, Tienda, Pausa (con botón y `visibilitychange`) y Ajustes (solo «Borrar progreso»).
- **Panel de depuración:** carpetas de economía, «Dar monedas» y «Borrar guardado».

## Análisis del estado actual

- M0–M3 están publicados. M3 entró en `main` con las PR #2, #3 y #4 (`8ea9c65`).
- `plan.md:318`, la lista de hitos, está vacía. El alcance de M4 sale de `plan.md:140-205` y de las decisiones de abajo.
- **Monedas:** nadie lee `config.grassTypes.*.coins` (`src/config.ts:10-14`), y los obstáculos no tienen monedas. Las monedas de cada paso se pueden calcular con `StepResult.cutIndices` → `field.types` y `cutObstacles` → `level.obstacles[i].type`. `stepWinWave` también devuelve sus cortes (`src/logic/game.ts:113-121`).
- **Tiempo al ganar:** `game.timeLeft` se congela cuando cae el último objetivo, porque la onda no descuenta tiempo (`game.ts:96-104`).
- **Valores de la cuchilla:** se leen directamente de `config`:
  - `createBlade` usa `config.blade.startSize` (`src/logic/blade.ts:24-26`);
  - `moveBlade` usa `config.blade.maxSpeed` (`blade.ts:52-65`);
  - el tiempo inicial sale de `level.timeSeconds` (`game.ts:56`, `game.ts:73`).
- **Validación:** la validación y la estimación de tiempo leen `config.blade.startSize` y `maxSpeed` (`src/logic/validation.ts:35,53,57,99,171,200,202`). Si las mejoras cambiaran `config`, los niveles y sus tiempos dependerían de cada jugador.
- **DOM:** `tsconfig.logic.json` compila `src/logic` sin los tipos del DOM, así que `localStorage` no puede estar en `logic/`.
- **`main.ts`:**
  - crea las vistas una vez;
  - `playLevel`, `loadLevel` y `restart` cambian el nivel (`src/main.ts:59-82`);
  - el bucle nunca se para (`main.ts:128-173`);
  - la capa de resultado se muestra en el frame en que cambia el estado (`main.ts:146-148`);
  - arranca en `loadLevel(1)` (`main.ts:89`).
- **Capas:** el patrón es `createResultOverlay`, con `stopPropagation` en `pointerdown` para que el joystick no capture los toques (`src/ui/result.ts:23-52`).
- **Piezas reutilizables:**
  - para el «+N», `cameraRig.toScreen` (`src/render/cameraRig.ts:38-42`) y `restartAnimation` (`src/ui/hud.ts:126-130`);
  - para la flecha, el calco transparente de la sombra (`src/render/blade.ts:48-54`).
- **Pruebas:** se ejecutan en Node, sin DOM (`vite.config.ts`). En `ui/` solo se prueban funciones puras: `hudDisplay`, `formatClock` y `createBlockedNotice`. Las pruebas leen `config` y cambian valores con `try/finally` (`tests/logic/progression.test.ts:17-25`).
- **Depuración:** el panel `createDebugPanel(getGame, { restart, markCut, playLevel })` se carga con `import()` dinámico solo con `?debug` (`main.ts:102-116`). `window.__siega` devuelve la partida actual.

## Estado final deseado

1. **Inicio:** al abrir la página aparece Inicio, con «Siega Total», el saldo y los botones «Jugar · Nivel N», «Tienda» y ⚙. Detrás se ve el campo del nivel guardado.
2. **HUD:**
   - arriba a la derecha, el saldo más lo ganado en el nivel, que sube en vivo;
   - cada 0,2 s sale de la cuchilla un «+N» con lo cortado en ese intervalo;
   - el botón ⏸ pausa la partida;
   - abajo a la derecha, tres botones de booster con sus usos.
3. **Victoria y Derrota:**
   - **Victoria:** las monedas del nivel, el bonus (segundos sobrantes × 100) y los botones «Siguiente», «Tienda» e «Inicio».
   - **Derrota:** las monedas del nivel y los botones «+30 s», «Reintentar» e «Inicio». «+30 s» continúa la partida con el campo tal como estaba.
4. **Ingreso de monedas:** se suman al saldo y se guardan en cada final (ganar o perder). Continuar desde la Derrota no las cuenta dos veces.
5. **Tienda:** muestra las 4 mejoras (nivel, efecto, precio o «Máximo») y los 3 boosters (usos y precio). Solo deja comprar con saldo suficiente.
6. **Mejoras:** cambian la partida (tamaño inicial, velocidad, tiempo y crecimiento). Los niveles generados y su validación no cambian.
7. **Boosters:**
   - **Mejora:** +1 tamaño al instante.
   - **Reloj:** +30 s.
   - **Brújula:** una flecha en el suelo junto a la cuchilla apunta 15 s a la unidad objetivo en pie más cercana.
8. **Pausa:** el botón ⏸ y ocultar la pestaña durante la partida abren Pausa («Continuar», «Reintentar», «Inicio»). En pausa no corre el tiempo ni la brújula.
9. **Ajustes:** solo «Borrar progreso», con confirmación en dos toques sin diálogos del navegador. Borra el guardado y vuelve al nivel 1.
10. **Guardado:** al recargar se conservan el nivel, las monedas, las mejoras y los usos de los boosters. Si los datos están dañados o `localStorage` falla, el juego sigue con los valores por defecto.
11. **Panel (`?debug`):** carpetas `economy`, `upgrades` y `boosters`, y los botones «Dar monedas» y «Borrar guardado».
12. **Comprobación:** `make check test build size` pasa, y la carga inicial pesa menos de 2 MB comprimidos.

### Decisiones (resueltas con grill-me)

| Tema | Decisión |
| --- | --- |
| Reparto de hitos | **M4:** economía, mejoras, boosters, tienda, guardado e Inicio/Pausa/Ajustes. **M5:** sonido, vibración, confeti, lluvia de monedas y tutorial (con sus ajustes). **M6:** calidad automática (con su ajuste), campaña curada y v1.0. |
| Cómo se aplican las mejoras | Una función pura `bonusesFor(upgrades)` y `createGame(level, bonuses)`. La partida guarda los bonos. `config`, el generador y la validación no cambian: el nivel es el mismo para todos y siempre se puede jugar con el tamaño base. |
| Escala de monedas | La de la especificación: cada brizna da `coins` de su tipo, también las que corta la onda de victoria. Los precios van en miles. |
| Fruta, cactus y bonus | `config.obstacles.*.coins`: sandía 300, fresa 100 y cactus 500. Bonus de victoria = `floor(timeLeft)` × `config.economy.coinsPerSecondLeft` (100). |
| Derrota | Las monedas cortadas se ingresan también al perder, sin bonus. |
| Mejoras | Precio del nivel k = `basePrice × priceGrowth^k`, redondeado a 100. **Tamaño inicial:** máx 4, +1 tamaño, 8 000 × 2,0. **Velocidad:** máx 10, +6 %, 5 000 × 1,5. **Tiempo extra:** máx 10, +5 s, 5 000 × 1,5. **Crecimiento:** máx 10, +10 % de cortes para la barra, 5 000 × 1,5. |
| Boosters en partida | Tres botones redondos en el HUD (abajo a la derecha) con el número de usos. Con 0 usos se ven apagados. Precios: Mejora 3 000, Brújula 2 000 y Reloj 3 000. Se empieza con 2 usos de cada uno. |
| Brújula | Una flecha en el suelo junto a la cuchilla que apunta a la unidad objetivo en pie más cercana (`nearestTarget` en la lógica, recalculada cada 0,2 s). Dura 15 s y la cuenta atrás está en la partida. |
| Derrota con Reloj | «+30 s» gasta un Reloj. Si no quedan, compra uno con monedas, y si no llegan, aparece apagado. `lost` → `playing`. Las monedas se ingresan en cada final, solo lo ganado desde el último ingreso. |
| Pantallas | Inicio, Tienda (mejoras y boosters), Pausa, Victoria, Derrota y Ajustes (solo «Borrar progreso»). Todas son capas HTML sobre el canvas. La página siempre abre en Inicio. |
| Guardado | `SaveData` v1 solo con `level`, `coins`, `upgrades` y `boosters`. Las funciones puras están en `logic/save.ts` y el acceso seguro a `localStorage` en `ui/storage.ts`. M5 y M6 añaden versiones con su migración. |
| «+N» | Un contador 🪙 en vivo y un «+N» agrupado cada 0,2 s sobre la cuchilla, también durante la onda de victoria. |
| Entregas | Un plan y tres PR desde `main`. **PR A** (fases 1–3): monedas y guardado. **PR B** (fases 4–5): mejoras y pantallas. **PR C** (fases 6–7): boosters. |
| Criterio de salida | Pruebas automáticas de economía, guardado, mejoras y boosters, y `make check test build size`. El agente hace en Chrome toda la verificación de navegador que pueda. Al usuario le quedan los fps en el móvil real y la sensación de juego. |

### Decisiones de detalle (tomadas al escribir el plan)

- **Pausa en `main.ts`:**
  - Mientras la pantalla no sea la partida, no se llama a `stepGame`, así que no corre ni el tiempo ni la brújula. La escena se sigue dibujando.
  - `visibilitychange` (pestaña oculta) solo abre Pausa si el estado es `playing`.
- **Abandonar el nivel** («Inicio» o «Reintentar» desde Pausa): las monedas del intento sin ingresar se pierden y el nivel vuelve a empezar. Solo los finales ingresan.
- **Nivel guardado:** al ganar, `save.level = level.number + 1` (si `level.number ≥ 1`). «Siguiente» e «Inicio → Jugar» cargan `save.level`.
- **Cuándo se guarda:** al ingresar (ganar o perder), al comprar, al usar un booster y al borrar el progreso. Un booster usado se guarda en ese momento para que recargar no lo devuelva. Es la única escritura a mitad de nivel, y solo cambia `boosters`.
- **Tiempo total del anillo:** `game.timeTotal` empieza en `level.timeSeconds + bonuses.extraSeconds`. El Reloj suma a `timeLeft` y sube `timeTotal` a `max(timeTotal, timeLeft)`, para que el anillo no pase del 100 %.
- **Booster Mejora:** se puede usar en `ready` y en `playing`. Sube `blade.size` en 1 y mantiene `growthProgress`. La cámara se aleja sola, porque `followBlade` lee el tamaño.
- **Booster Reloj:** se puede usar en `ready`, en `playing` y en `lost`. En `lost`, el tiempo pasa a 30 s y el estado a `playing`.
- **Booster Brújula:** se puede usar en `ready` y en `playing` si no está activa. Mientras está activa, el botón aparece apagado.
- **Tienda:** «Volver» regresa a la pantalla de la que vienes (Inicio o Victoria).
- **Iconos:** son SVG en código, como los de la tarjeta de objetivos (`hud.ts:132-174`). En M4 no se añaden recursos.
- **Borrar progreso:** el primer toque cambia el botón a «¿Seguro? Toca otra vez». El segundo borra. Si pasan 3 s, el botón vuelve a su texto. No se usa `window.confirm`, porque bloquea la automatización del navegador.

### Hallazgos clave

- `plan.md:144-172`: monedas, mejoras y boosters. El jugador empieza con 2 usos de cada booster y los usa en cualquier momento.
- `plan.md:174-184`: el flujo de pantallas. Victoria tiene «Siguiente» y «Tienda». En Derrota, el reloj continúa la partida. Pausa con `visibilitychange`.
- `plan.md:186-205`: el guardado versionado, cuándo se guarda, la migración y los datos dañados.
- `src/logic/obstacles.ts:40`: el patrón `obstacleGrowthCuts(type)` para leer valores por tipo de `config`. `obstacleCoins` lo sigue.
- `tests/architecture.test.ts:7-8`: la regla ya prohíbe `/audio` en la lógica, y el guardado no la cambia.

## Qué NO hacemos

- Sonido, vibración, confeti, lluvia de monedas, destello de subida de tamaño y tutorial (M5).
- Ajustes de sonido, vibración y calidad, y sus campos en el guardado (M5 y M6).
- Calidad automática: se sigue en calidad media (M6).
- Curar las 50 semillas de la campaña (lo hace el usuario).
- Selector de niveles (la especificación lo descarta).
- Iconos o modelos nuevos de Kenney: la moneda y los boosters son SVG en código.
- Guardar a mitad de nivel, salvo el uso de un booster.
- Comprar boosters desde el HUD en mitad de la partida. Solo se compran en la Tienda o con el «+30 s» de la Derrota.
- Brillo de la fruta y el cactus objetivo, que sigue fuera desde M3.

## Enfoque de implementación

Mismo orden que en M3: primero la lógica pura con TDD, después la interfaz. Cada fase deja `make check test build` en verde, y cada PR se publica y se juega.

- **PR A (fases 1–3):** monedas y guardado. Al recargar se sigue en el nivel guardado y con el saldo.
- **PR B (fases 4–5):** mejoras, Tienda, Inicio, Pausa y Ajustes.
- **PR C (fases 6–7):** boosters y criterio de salida.

Rama de cada PR: `feat/m4-economy-a`, `feat/m4-economy-b` y `feat/m4-economy-c`, cada una desde `main` después de fusionar la anterior.

### Verificación en el navegador (fases 3, 5 y 7)

Las hace el agente con Claude in Chrome:

- **Preparación:** `make build && make preview`, que sirve en `http://localhost:4173/siega-total/`. Se usa una pestaña nueva con la ventana a 390 × 844.
- **Herramientas:**
  - `javascript_tool` para leer `window.__siega` y `localStorage['siega-total']`;
  - `find`/`computer` para pulsar los botones de las capas y del panel `?debug`;
  - capturas de pantalla para la legibilidad.
- **Prohibido:** no se lanzan diálogos del navegador.
- **Grabación:** cada verificación se graba en un GIF (`m4-a-monedas.gif`, `m4-b-pantallas.gif` y `m4-c-boosters.gif`).

---

## Fase 1: Monedas en la lógica

### Resumen

Contar las monedas de cada paso y el bonus de victoria, y entregar al saldo solo lo ganado desde el último ingreso.

### Cambios necesarios

#### 1. Configuración

**Archivo**: `src/config.ts`
- `obstacles.cactus.coins: 500`, `obstacles.watermelon.coins: 300` y `obstacles.strawberry.coins: 100`. La roca no tiene `coins`.
- Una sección nueva:

```ts
economy: {
  coinsPerSecondLeft: 100,
  /** The floating «+N» shows the coins of this interval added together. */
  floatIntervalSeconds: 0.2,
},
```

#### 2. Monedas por corte

**Archivo**: `src/logic/economy.ts` (nuevo)

```ts
/** Coins of the blades and obstacles cut in one step. */
export function coinsForCuts(game: Game, cutIndices: readonly number[], cutObstacles: readonly number[]): number;
/** Coins of a piece of `type`; 0 for rocks. */
export function obstacleCoins(type: ObstacleType): number;
/** Bonus for winning with `timeLeft` seconds to spare. */
export function timeBonus(timeLeft: number): number;
```

- Brizna: `config.grassTypes[GRASS_TYPE_ORDER[field.types[i]]].coins`.
- `obstacleCoins` sigue el patrón de `obstacleGrowthCuts` (`obstacles.ts:40`).
- `timeBonus` = `Math.floor(timeLeft) × coinsPerSecondLeft`.

#### 3. Monedas en la partida

**Archivo**: `src/logic/game.ts`
- `Game` gana:
  - `levelCoins: number`: lo cortado en este intento, onda incluida;
  - `bonusCoins: number`: el bonus de tiempo, fijado al pasar a `winWave`;
  - `bankedCoins: number`: lo ya entregado al saldo.
- `StepResult` gana `coins: number`.
- `stepGame` suma `coinsForCuts` a `levelCoins`, tanto en `playing` como en `stepWinWave`.
- Al pasar a `winWave`: `bonusCoins = timeBonus(timeLeft)`.
- `resetGame` pone a 0 los tres.
- `cutAllTargets` (depuración) no da monedas.

**Archivo**: `src/logic/economy.ts`

```ts
/** Coins earned since the last call, to add to the balance at the end of the level. */
export function bankCoins(game: Game): number;   // levelCoins + bonusCoins − bankedCoins; actualiza bankedCoins
```

### Pruebas

**`tests/logic/economy.test.ts`** (niveles pequeños con `levelFromRows`; se extrae a `tests/logic/levelFixtures.ts` para compartirlo con `game.test.ts`):
- Cortar N briznas de verde da N × `coins` del verde, y N de trigo da N × `coins` del trigo.
- Una fresa cortada da `config.obstacles.strawberry.coins`. Una roca da 0.
- `timeBonus(40.9)` = 40 × `coinsPerSecondLeft`.
- Ganar un nivel deja `levelCoins` igual a las monedas de todo lo cortable del campo, porque la onda corta el resto, y `bonusCoins = timeBonus(timeLeft)`.
- Perder no da bonus.
- `bankCoins` devuelve lo ganado y, llamado otra vez sin cortar más, devuelve 0.
- Tras `bankCoins` en `lost`, forzar `status = 'playing'`, cortar más y ganar: el segundo `bankCoins` solo da lo nuevo más el bonus.
- `resetGame` pone a 0 las monedas del intento.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Las pruebas de economía, juego y arquitectura pasan: `make test`
- [x] La compilación termina: `make build`

> **Desviaciones (implementación):** `obstacleCoins` vive en `src/logic/obstacles.ts`, junto a `obstacleGrowthCuts`, porque usa su `settingsOf` privado; `economy.ts` lo importa. BugMagnet encontró un bonus negativo (−100) al ganar en el mismo paso en que se acaba el tiempo: `stepGame` ahora limita `timeLeft` a 0 antes de comprobar la victoria.

---

## Fase 2: Guardado

### Resumen

Un esquema versionado y puro, con valores por defecto, migración y saneado, y una capa fina sobre `localStorage` que nunca lanza excepciones.

### Cambios necesarios

#### 1. Configuración de los usos iniciales

**Archivo**: `src/config.ts`: la sección `boosters` con `startUses` y `price`. La fase 6 añade los demás campos.

```ts
boosters: {
  upgrade: { price: 3000, startUses: 2 },
  compass: { price: 2000, startUses: 2 },
  clock: { price: 3000, startUses: 2 },
},
```

La sección `upgrades` llega en la fase 4. Hasta entonces, el saneado de `upgrades` solo exige enteros ≥ 0.

#### 2. Esquema

**Archivo**: `src/logic/save.ts` (nuevo)

```ts
export type UpgradeKind = 'startSize' | 'speed' | 'extraTime' | 'growth';
export type BoosterKind = keyof typeof config.boosters;

export interface SaveData {
  version: 1;
  /** Next level to play, ≥ 1. */
  level: number;
  coins: number;
  /** Bought level of each upgrade. */
  upgrades: Record<UpgradeKind, number>;
  /** Uses left of each booster. */
  boosters: Record<BoosterKind, number>;
}

export const SAVE_VERSION = 1;
export function defaultSave(): SaveData;
/** Reads stored JSON; damaged, missing or unknown-version data gives the defaults, and every field is sanitized. */
export function loadSave(raw: string | null): SaveData;
export function serializeSave(save: SaveData): string;
```

- `loadSave` empieza con `JSON.parse` dentro de `try`. Después:
  - si no hay objeto o `version` no es un número, devuelve los valores por defecto;
  - si la versión es mayor que `SAVE_VERSION`, devuelve los valores por defecto;
  - si no, aplica `migrate`, que en v1 es la identidad;
  - por último, sanea campo a campo.
- Saneado:
  - `level`: entero ≥ 1;
  - `coins`: entero ≥ 0;
  - cada mejora y cada booster: entero ≥ 0. Desde la fase 4, las mejoras también ≤ `max`;
  - un campo inválido o que falta toma su valor por defecto, y el resto se conserva.
- `migrate(data: { version: number }): unknown` tiene un comentario que explica cómo añade M5 el paso v1 → v2.

#### 3. Acceso al navegador

**Archivo**: `src/ui/storage.ts` (nuevo)

```ts
const SAVE_KEY = 'siega-total';
export function readSave(): SaveData;          // loadSave(localStorage.getItem) con try/catch → defaultSave()
export function writeSave(save: SaveData): void; // setItem con try/catch; si falla, console.warn y sigue
export function clearSave(): void;
```

#### 4. Bucle principal

**Archivo**: `src/main.ts`
- `let save = readSave()` al arrancar, y `loadLevel(save.level)` en lugar de `loadLevel(1)`.
- En el frame en que el estado pasa a `won` o `lost`:
  1. `save.coins += bankCoins(game)`;
  2. si gana y `level.number ≥ 1`, `save.level = level.number + 1`;
  3. `writeSave(save)`.
- «Siguiente» carga `save.level`.
- Se borra el comentario «there is no saving» de `loadLevel`.

#### 5. Panel

**Archivo**: `src/debug/panel.ts`
- `DebugActions` gana `giveCoins(amount: number)` y `clearSave()`.
- Botones nuevos: «Dar monedas» (+`10 000`) y «Borrar guardado».
- Carpeta `economy` con `addNumberFolder`.
- `main.ts` implementa las dos acciones:
  - `giveCoins` suma y guarda;
  - `clearSave` borra, pone `save = defaultSave()` y llama a `loadLevel(1)`.

**Archivo**: `src/texts.ts`: `debug.giveCoins: 'Dar monedas'` y `debug.clearSave: 'Borrar guardado'`.

### Pruebas

**`tests/logic/save.test.ts`**:
- `loadSave(serializeSave(s))` devuelve `s` (viaje de ida y vuelta).
- `loadSave(null)`, `loadSave('')`, `loadSave('{no json')`, `loadSave('42')` y `loadSave('null')` dan `defaultSave()`.
- Una versión mayor que `SAVE_VERSION` da `defaultSave()`.
- Con `coins: -5`, `coins: 'mucho'` o `level: 0`, ese campo toma su valor por defecto y el resto se conserva.
- Con `level: 3.7`, el nivel sale entero.
- Si falta un booster, toma `startUses`.
- `defaultSave()` empieza en el nivel 1, con 0 monedas, mejoras a 0 y boosters con `config.boosters.*.startUses`.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan (`storage.ts` usa el DOM y está fuera de `logic/`): `make check`
- [x] Las pruebas de guardado y arquitectura pasan: `make test`
- [x] La compilación termina: `make build`

> **Desviaciones (implementación):** BugMagnet encontró que `1e999` en el JSON se lee como `Infinity` y pasaba el saneado; ahora los números también tienen que ser finitos. En `main.ts`, la acción de depuración `clearSave` se llama `clearProgress`, para no confundirla con `clearSave` de `ui/storage.ts`.

---

## Fase 3: Interfaz de monedas (fin de la PR A)

### Resumen

Mostrar el saldo en vivo, el «+N» agrupado y las monedas en Victoria y Derrota.

### Cambios necesarios

#### 1. Agrupador del «+N»

**Archivo**: `src/ui/coinFloats.ts` (nuevo, puro, como `blockedNotice.ts`)

```ts
/** Adds up the coins of each step and lets one «+N» out every `config.economy.floatIntervalSeconds`. */
export function createCoinFloats(): { step(coins: number, dt: number): number | null };
```

- Devuelve la suma acumulada cuando ha pasado el intervalo y hay algo acumulado. Después reinicia la cuenta.
- Si no hay monedas, no sale nada y el reloj del intervalo no empieza.

#### 2. HUD

**Archivo**: `src/ui/hud.ts`
- `HudState` gana `coins: number` (saldo + `levelCoins` + `bonusCoins` − `bankedCoins`) y `floatCoins: number | null`.
- `HudDisplay` gana `coinsLabel` (formato `es-ES`).
- Arriba a la derecha va `.hud-coins`, con el icono SVG de la moneda (`ICONS.coin`) y el número.
- Para el «+N» hay 6 elementos `.hud-float` reutilizados en anillo. Cada uno toma la posición `toScreen` de la cuchilla (desplazada hacia arriba), muestra `+N` y anima con `restartAnimation` (sube y se desvanece en 0,6 s, en `styles.css`).

#### 3. Victoria y Derrota

**Archivo**: `src/ui/result.ts`
- `show(outcome, summary: { levelCoins: number; bonusCoins: number })`.
- **Victoria:** «Monedas N», «Bonus de tiempo N» y el total.
- **Derrota:** «Monedas N».
- En la PR A los botones siguen como en M3 («Siguiente» y «Reintentar»). Los demás llegan en las fases 5 y 7.
- Función pura `resultLines(outcome, summary): string[]`, con prueba.

#### 4. Textos

**Archivo**: `src/texts.ts`: `result.coins: 'Monedas'`, `result.timeBonus: 'Bonus de tiempo'` y `result.total: 'Total'`.

#### 5. Bucle principal

**Archivo**: `src/main.ts`: `coinFloats.step(result.coins, dt)` en cada frame. El HUD recibe `coins` y `floatCoins`. `resultOverlay.show` recibe el resumen.

### Pruebas

- **`tests/ui/coinFloats.test.ts`:** suma varios pasos y sale una vez por intervalo. No sale con 0 monedas. Lo de la onda también sale.
- **`tests/ui/hud.test.ts`:** `coinsLabel` formatea `12840 → "12.840"`.
- **`tests/ui/result.test.ts`:** `resultLines` en Victoria tiene las monedas, el bonus y el total, y en Derrota solo las monedas.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La carga inicial pesa menos de 2 MB comprimidos: `make size`

#### Verificación en Chrome (agente, `?debug`, 390 × 844, GIF `m4-a-monedas.gif`):
- [x] Con `localStorage` vacío, empieza el nivel 1.
- [x] Al mover la cuchilla con el teclado (`computer`, tecla D), sube el contador 🪙 y aparecen elementos `.hud-float` con texto `+N`.
- [x] «Ganar» en el panel muestra la Victoria con monedas, bonus y total. `JSON.parse(localStorage['siega-total'])` tiene `level: 2` y `coins` igual al total mostrado.
- [x] Al recargar, el HUD dice «Nivel 2» y el contador muestra el saldo guardado.
- [x] Con «Tiempo 3 s» y esperando, aparece la Derrota con las monedas y el saldo guardado sube en esa cantidad.
- [x] Con `localStorage['siega-total'] = '{roto'` y recargando, el juego arranca en el nivel 1 sin errores en la consola (`read_console_messages`).

> **Notas de la verificación en Chrome:** Chrome no dejó bajar la ventana de 606 × 723, así que se verificó a ese tamaño; a 390 px, el HUD de la izquierda acaba en 218 px y el contador de monedas cabe a la derecha. Las pulsaciones cortas de `computer` (tecla D) no sacan la cuchilla del claro inicial, así que se mantuvo D con eventos `keydown`/`keyup`. El GIF no se exportó, porque exportarlo descarga un archivo y eso necesita permiso del usuario. La verificación encontró que al arrancar se seguía cargando el nivel 1 (la edición había cambiado el `loadLevel(1)` de `clearProgress`), y se corrigió.

#### Verificación manual (usuario):
- [ ] El «+N» se lee bien y no satura la pantalla al cortar rápido (juicio visual).

---

## Fase 4: Mejoras en la lógica

### Resumen

Precios, compra y efectos de las cuatro mejoras, aplicados a la partida sin tocar `config`.

### Cambios necesarios

#### 1. Configuración

**Archivo**: `src/config.ts`

```ts
upgrades: {
  /** Prices are rounded to this many coins. */
  priceRoundTo: 100,
  startSize: { max: 4, perLevel: 1, basePrice: 8000, priceGrowth: 2 },
  speed: { max: 10, perLevel: 0.06, basePrice: 5000, priceGrowth: 1.5 },
  extraTime: { max: 10, perLevel: 5, basePrice: 5000, priceGrowth: 1.5 },
  growth: { max: 10, perLevel: 0.1, basePrice: 5000, priceGrowth: 1.5 },
},
```

`UpgradeKind` pasa a ser `Exclude<keyof typeof config.upgrades, 'priceRoundTo'>`. El saneado de `loadSave` limita cada mejora a su `max`.

#### 2. Bonos de la partida

**Archivo**: `src/logic/upgrades.ts` (nuevo)

```ts
export interface GameBonuses {
  startSize: number;        // tamaño con el que empieza la cuchilla
  speedMultiplier: number;  // 1 + perLevel × nivel
  extraSeconds: number;
  growthMultiplier: number; // cada corte cuenta × esto para la barra
}
export function noBonuses(): GameBonuses;   // startSize = config.blade.startSize, multiplicadores 1, 0 s
export function bonusesFor(upgrades: SaveData['upgrades']): GameBonuses;
/** Price of the next level of `kind`, or null when it is at its max. */
export function upgradePrice(kind: UpgradeKind, currentLevel: number): number | null;
/** Spends the coins and raises the level; false (and no change) without coins or at max. */
export function buyUpgrade(save: SaveData, kind: UpgradeKind): boolean;
```

`upgradePrice` = `round(basePrice × priceGrowth^level / priceRoundTo) × priceRoundTo`.

#### 3. La partida usa los bonos

- **`src/logic/blade.ts`:**
  - `createBlade(x, z, size = config.blade.startSize)`;
  - `moveBlade(blade, direction, dt, width, depth, maxSpeed = config.blade.maxSpeed)`. El frenado sigue durando `brakeSeconds`, así que la deceleración es `maxSpeed / brakeSeconds`.
- **`src/logic/game.ts`:**
  - `createGame(level = sampleLevel(), bonuses = noBonuses())`;
  - `Game` gana `readonly bonuses: GameBonuses` y `timeTotal: number`;
  - `bladeAtCenter(field, bonuses.startSize)`;
  - `timeLeft = timeTotal = level.timeSeconds + bonuses.extraSeconds`, también en `resetGame`;
  - `moveBlade(..., config.blade.maxSpeed × speedMultiplier)`;
  - `addCuts(blade, (briznas + growthCuts) × growthMultiplier)`.
- **`src/main.ts`:** `createGame(level, bonusesFor(save.upgrades))`. El HUD usa `game.timeTotal` en lugar de `level.timeSeconds`.
- **`src/debug/panel.ts`:** al cambiar `level.timeSeconds`, también se actualizan `timeTotal` y `timeLeft` de la partida en `ready`.

### Pruebas

**`tests/logic/upgrades.test.ts`**:
- Los precios crecen nivel a nivel, son múltiplos de `priceRoundTo` y valen `null` en `max`.
- `buyUpgrade` sin monedas suficientes devuelve `false` y no cambia nada. Con monedas, resta el precio exacto y sube el nivel. En `max` devuelve `false`.
- `bonusesFor` con todo a 0 es igual a `noBonuses()`.

**`tests/logic/game.test.ts`**:
- Con `startSize: 3`, la cuchilla empieza en tamaño 3 y, tras `resetGame`, vuelve a 3.
- Con `speedMultiplier: 1.5`, en 1 s recorre 1,5 veces lo de base.
- Con `extraSeconds: 10`, `timeLeft` y `timeTotal` empiezan 10 s por encima de `level.timeSeconds`.
- Con `growthMultiplier: 2`, la cuchilla sube de tamaño con la mitad de briznas.
- Crear una partida con bonos no cambia `level` (mismas celdas, objetivos y `timeSeconds`).

**`tests/logic/save.test.ts`**: una mejora por encima de su `max` sale saneada a `max`.

### Criterios de éxito

#### Verificación automática:
- [ ] Los tipos pasan: `make check`
- [ ] Las pruebas de mejoras, juego, cuchilla, guardado, progresión y validación pasan sin cambiar sus expectativas: `make test`
- [ ] La compilación termina: `make build`

---

## Fase 5: Pantallas y Tienda de mejoras (fin de la PR B)

### Resumen

Inicio, Tienda, Pausa y Ajustes, y el flujo entre ellas.

### Cambios necesarios

#### 1. Estado de pantalla

**Archivo**: `src/main.ts`
- `type Screen = 'home' | 'playing' | 'paused' | 'result' | 'shop' | 'settings'` y `let screen: Screen = 'home'`.
- Solo con `screen === 'playing'` o `'result'` se llama a `stepGame`. En `'result'` la cuchilla frena y la onda termina. En las demás pantallas, el bucle dibuja con `dt` 0 para la lógica.
- `showScreen(next)` oculta todas las capas y muestra la de `next`. La Tienda recuerda la pantalla anterior para «Volver».
- `document.addEventListener('visibilitychange', …)`: si `document.hidden` y `screen === 'playing'` y `game.status === 'playing'`, se pasa a `'paused'`.

#### 2. Capas

Todas siguen el patrón de `result.ts`: un `div` con su clase, `stopPropagation` en `pointerdown` y la clase `visible`.

| Archivo | Contenido | Acciones |
| --- | --- | --- |
| `src/ui/home.ts` | Título, saldo y «Jugar · Nivel N» | `onPlay`, `onShop`, `onSettings` |
| `src/ui/shop.ts` | Una fila por mejora: nombre, «Nivel k/máx», efecto y botón con el precio o «Máximo» (apagado sin saldo). La sección de boosters llega en la fase 7. | `onBuyUpgrade(kind)`, `onBack` |
| `src/ui/pause.ts` | «Pausa» | `onResume`, `onRetry`, `onHome` |
| `src/ui/settings.ts` | «Borrar progreso» con confirmación en dos toques (vuelve a su texto a los 3 s) | `onClearProgress`, `onBack` |

- Funciones puras con prueba:
  - `shopUpgradeRows(save): { kind; label; levelLabel; effectLabel; price: string | null; canBuy: boolean }[]`;
  - `homeDisplay(save): { coinsLabel; playLabel }`;
  - `createConfirmButtonState()` → `{ press(now): 'armed' | 'confirmed'; label(now) }` para el borrado en dos toques.
- **`src/ui/result.ts`:**
  - Victoria: «Siguiente», «Tienda» e «Inicio»;
  - Derrota: «Reintentar» e «Inicio»;
  - `ResultActions` gana `onShop` y `onHome`.
- **`src/ui/hud.ts`:** botón ⏸ arriba a la derecha, junto a las monedas, con la acción `onPause`.

#### 3. Flujo

- **Al arrancar:** `loadLevel(save.level)` y `showScreen('home')`.
- **Inicio:**
  - «Jugar»: si la partida ya terminó (`won`) o es otro nivel, primero `loadLevel(save.level)`; después `showScreen('playing')`;
  - «Tienda» y ⚙ abren sus capas.
- **Pausa:**
  - «Continuar» → `'playing'`;
  - «Reintentar» → `restart()` y `'playing'`;
  - «Inicio» → `restart()` y `'home'`.
- **Victoria:**
  - «Siguiente» → `loadLevel(save.level)` y `'playing'`;
  - «Tienda» → `'shop'` (al volver, otra vez la Victoria);
  - «Inicio» → `loadLevel(save.level)` y `'home'`.
- **Derrota:** «Reintentar» → `restart()`. «Inicio» → `restart()` y `'home'`.
- **Comprar una mejora:** `buyUpgrade(save, kind)`, `writeSave(save)` y se redibujan la Tienda y el saldo. Se aplica desde la siguiente partida que se crea o se reinicia: `restart()` reconstruye la partida con los bonos nuevos.
- **Borrar progreso:** `clearSave()`, `save = defaultSave()`, `loadLevel(1)` y `'home'`.

`restart()` pasa a ser `playLevel(game.level)`: libera las vistas y crea la partida de nuevo con `createGame(game.level, bonusesFor(save.upgrades))`, así que recoge las mejoras recién compradas.

#### 4. Textos

**Archivo**: `src/texts.ts`: secciones nuevas.
- **`home`:** `title: 'Siega Total'`, `play: 'Jugar'`, `shop: 'Tienda'`.
- **`pause`:** `title: 'Pausa'`, `resume: 'Continuar'`, `retry: 'Reintentar'`, `home: 'Inicio'`.
- **`shop`:**
  - `title: 'Tienda'`, `upgrades: 'Mejoras'`, `max: 'Máximo'`, `level: 'Nivel'`, `back: 'Volver'`;
  - nombres de las mejoras: `startSize: 'Tamaño inicial'`, `speed: 'Velocidad'`, `extraTime: 'Tiempo extra'`, `growth: 'Crecimiento'`;
  - efectos: `'+1 tamaño'`, `'+6 % velocidad'`, `'+5 s'`, `'+10 % crecimiento'`, formateados desde `config` con una función de `shop.ts`.
- **`settings`:** `title: 'Ajustes'`, `clearProgress: 'Borrar progreso'`, `confirmClear: '¿Seguro? Toca otra vez'`.
- **`result`:** `shop` y `home`.

### Pruebas

- **`tests/ui/shop.test.ts`:**
  - sin saldo, `canBuy` es falso;
  - con saldo justo, es verdadero;
  - en `max`, `price` es `null`;
  - los efectos salen de `config.upgrades`.
- **`tests/ui/confirmButton.test.ts`:**
  - el primer toque arma;
  - el segundo antes de 3 s confirma;
  - pasados 3 s, el segundo toque vuelve a armar.
- **`tests/ui/home.test.ts`:** `playLabel` es «Jugar · Nivel N» y el saldo se formatea con `es-ES`.

### Criterios de éxito

#### Verificación automática:
- [ ] Los tipos pasan: `make check`
- [ ] Todas las pruebas pasan: `make test`
- [ ] La carga inicial pesa menos de 2 MB comprimidos: `make size`

#### Verificación en Chrome (agente, `?debug`, 390 × 844, GIF `m4-b-pantallas.gif`):
- [ ] Al abrir aparece Inicio con «Jugar · Nivel N» y el saldo. Mientras no se pulsa Jugar, `window.__siega.status` sigue en `ready` aunque se pulse D.
- [ ] Jugar → mover → ⏸ abre Pausa. `timeLeft` no cambia en 2 s de pausa. «Continuar» vuelve.
- [ ] Ocultar la pestaña (abrir otra pestaña y volver) durante `playing` deja la Pausa abierta.
- [ ] «Dar monedas» → Inicio → Tienda → comprar «Velocidad»: el saldo baja el precio mostrado y `localStorage` tiene `upgrades.speed: 1`. Tras «Reintentar», `window.__siega.bonuses.speedMultiplier` es 1,06.
- [ ] Comprar «Tamaño inicial» y reintentar: `window.__siega.blade.size` empieza en 2.
- [ ] Sin saldo, el botón de compra está desactivado (`disabled`).
- [ ] Victoria → «Tienda» → «Volver» regresa a la Victoria. «Siguiente» carga el nivel siguiente.
- [ ] Ajustes → «Borrar progreso» dos veces: el guardado vuelve a los valores por defecto y Inicio dice «Nivel 1». Un solo toque, esperando 3 s, no borra.
- [ ] Captura de cada pantalla a 390 × 844: ningún texto se corta ni se sale de la pantalla.

#### Verificación manual (usuario):
- [ ] Las pantallas se ven coherentes con el HUD y se leen bien en el móvil (juicio visual).

---

## Fase 6: Boosters en la lógica

### Resumen

Usar y comprar los tres boosters, la búsqueda del objetivo más cercano y continuar desde la Derrota.

### Cambios necesarios

#### 1. Configuración

**Archivo**: `src/config.ts`: completar `boosters`.

```ts
boosters: {
  upgrade: { price: 3000, startUses: 2, sizes: 1 },
  compass: { price: 2000, startUses: 2, seconds: 15, retargetSeconds: 0.2 },
  clock: { price: 3000, startUses: 2, seconds: 30 },
},
```

#### 2. Boosters

**Archivo**: `src/logic/boosters.ts` (nuevo)

```ts
export function canUseBooster(game: Game, kind: BoosterKind): boolean;
/** Applies the booster to the game; does nothing and returns false when it cannot be used now. */
export function applyBooster(game: Game, kind: BoosterKind): boolean;
/** Spends one use from the save and applies it; false (no change) without uses or when it cannot be used. */
export function useBooster(save: SaveData, game: Game, kind: BoosterKind): boolean;
/** Buys one use; false (no change) without coins. */
export function buyBooster(save: SaveData, kind: BoosterKind): boolean;
/** Defeat's «+30 s»: uses a clock, or buys one first when there is none and the coins reach. */
export function continueWithClock(save: SaveData, game: Game): boolean;
```

| Booster | `canUseBooster` | Efecto |
| --- | --- | --- |
| `upgrade` | `ready` o `playing` | `blade.size += sizes` |
| `compass` | `ready` o `playing`, y `compassLeft ≤ 0` | `game.compassLeft = seconds` |
| `clock` | `ready`, `playing` o `lost` | `timeLeft += seconds`; `timeTotal = max(timeTotal, timeLeft)`; en `lost`, `status = 'playing'` |

**Archivo**: `src/logic/game.ts`: `Game` gana `compassLeft: number` (0 al crear y en `resetGame`). En `playing` se resta `dt` hasta 0. En `ready` no corre. Al ganar o perder se pone a 0.

#### 3. Objetivo más cercano

**Archivo**: `src/logic/boosters.ts`

```ts
/** Position of the closest standing target unit (blade or piece) to (x, z), or null when none is left. */
export function nearestTarget(game: Game, x: number, z: number): { x: number; z: number } | null;
```

Recorre las briznas objetivo en pie (`targetGrassTypes`, `field.cut`, `positionsX/Z`) y las piezas objetivo en pie. Es O(briznas). Con 12 000 briznas cada 0,2 s, el coste es despreciable. Si hace falta, se puede recorrer la cuadrícula por anillos, pero no se hace en M4.

### Pruebas

**`tests/logic/boosters.test.ts`**:
- `upgrade` sube el tamaño en 1 en `playing` y no hace nada en `won`.
- `clock` suma 30 s en `playing`. En `lost`, pasa a `playing` con 30 s y el campo sigue tal como estaba (`cutCount` igual).
- `compass` pone `compassLeft = 15`. No se puede volver a usar mientras está activa. Baja con `stepGame` en `playing` y no baja en `ready`.
- `useBooster` sin usos devuelve `false` y no cambia nada. Con usos, resta 1.
- `buyBooster` sin saldo devuelve `false`. Con saldo, resta el precio y suma 1 uso.
- `continueWithClock`:
  - sin Relojes y con saldo, compra uno, lo usa y queda con 0 usos;
  - sin Relojes ni saldo, devuelve `false`.
- Continuar desde `lost`, cortar el resto y ganar: `bankCoins` no cuenta dos veces (con `economy.test.ts`).
- `nearestTarget`:
  - devuelve la brizna objetivo más cercana e ignora las no objetivo y las cortadas;
  - devuelve una pieza objetivo si está más cerca;
  - devuelve `null` sin objetivos en pie.

### Criterios de éxito

#### Verificación automática:
- [ ] Los tipos pasan: `make check`
- [ ] Las pruebas de boosters, juego, economía y arquitectura pasan: `make test`
- [ ] La compilación termina: `make build`

---

## Fase 7: Interfaz de boosters (fin de la PR C)

### Resumen

Botones de booster en el HUD, la flecha de la brújula en el suelo, «+30 s» en la Derrota y los boosters en la Tienda.

### Cambios necesarios

#### 1. HUD

**Archivo**: `src/ui/hud.ts`
- Tres botones redondos abajo a la derecha (`.hud-boosters`), con el icono SVG y el número de usos. Usan `stopPropagation` en `pointerdown`.
- Acción `onBooster(kind)`.
- `HudState` gana `boosters: Record<BoosterKind, { uses: number; usable: boolean }>`. Un botón está apagado si no tiene usos o si `usable` es falso.
- Función pura `boosterButtons(state)` con prueba.

#### 2. Flecha de la brújula

**Archivo**: `src/render/compass.ts` (nuevo)

```ts
export interface CompassView {
  /** Points the arrow from the blade toward `target`; hidden when target is null. */
  update(blade: Blade, target: { x: number; z: number } | null): void;
  dispose(): void;
}
export function createCompassView(scene: Scene): CompassView;
```

- Es una flecha plana (`ShapeGeometry`) con `MeshBasicMaterial` transparente, `depthWrite: false` y y = 0,02, como la sombra de `render/blade.ts`.
- Se coloca a `bladeRadius(size) + 0,6` m del centro, hacia el objetivo, girada con `atan2`.
- `compassAngle(from, to)` es una función pura en `render/compassMath.ts`, con prueba.

**Archivo**: `src/main.ts`: mientras `game.compassLeft > 0`, se recalcula `nearestTarget` cada `retargetSeconds` (con un acumulador local) y se llama a `compassView.update`. Si no, se pasa `null`.

#### 3. Derrota y Tienda

- **`src/ui/result.ts`:** en la Derrota, primer botón «+30 s». Muestra el número de Relojes o, si no quedan, el precio. Está apagado si no hay ni Relojes ni saldo. La acción `onContinue` llama a `continueWithClock(save, game)`, `writeSave(save)`, `showScreen('playing')` y oculta la capa.
- **`src/ui/shop.ts`:** sección «Boosters», con una fila por booster: nombre, efecto, usos y botón de precio. `shopBoosterRows(save)` es pura y tiene prueba. `onBuyBooster(kind)` llama a `buyBooster` y `writeSave`.
- **`src/main.ts`:**
  - `onBooster(kind)` llama a `useBooster(save, game, kind)` y, si sale bien, `writeSave(save)`. Con `upgrade` se aplica al momento: el radio y la cámara siguen a `blade.size`;
  - al pasar de `lost` a `playing` con «+30 s», se reinicia el control de cambio de estado, para que la siguiente victoria o derrota abra su capa.

#### 4. Panel

**Archivo**: `src/debug/panel.ts`: carpetas `upgrades` y `boosters` con `addNumberFolder`. `basePrice`, `priceGrowth` y `perLevel` llevan «(al reiniciar)».

#### 5. Textos

**Archivo**: `src/texts.ts`:
- `boosters.upgrade: 'Mejora'`, `compass: 'Brújula'`, `clock: 'Reloj'`;
- los efectos `'+1 tamaño'`, `'Flecha 15 s'` y `'+30 s'`, formateados desde `config`;
- `shop.boosters: 'Boosters'`, `shop.uses: 'Usos'`;
- `result.continue: '+30 s'`.

### Pruebas

- **`tests/ui/hud.test.ts`:** `boosterButtons` apaga un booster con 0 usos o no usable y muestra los usos.
- **`tests/ui/shop.test.ts`:** `shopBoosterRows` muestra los usos y `canBuy` según el saldo.
- **`tests/ui/result.test.ts`:** el botón «+30 s» muestra los usos, el precio sin usos o aparece apagado sin usos ni saldo (función pura `continueButton(save)`).
- **`tests/render/compassMath.test.ts`:**
  - un objetivo al norte da la flecha hacia −z;
  - al este, hacia +x;
  - la distancia de la flecha crece con el tamaño.

### Criterios de éxito

#### Verificación automática:
- [ ] Los tipos pasan: `make check`
- [ ] Todas las pruebas pasan: `make test`
- [ ] La carga inicial pesa menos de 2 MB comprimidos: `make size`
- [ ] El panel sigue en un fragmento aparte: `make build && ! grep -q 'lil-gui' dist/assets/index-*.js`

#### Verificación en Chrome (agente, `?debug`, 390 × 844, GIF `m4-c-boosters.gif`). Es el criterio de salida automatizable de M4:
- [ ] Con el guardado vacío, los tres botones muestran «2».
- [ ] Mejora: `window.__siega.blade.size` sube en 1 y el botón muestra «1». Tras recargar, `localStorage` mantiene `boosters.upgrade: 1`.
- [ ] Brújula: `window.__siega.compassLeft` empieza en 15 y baja. La captura muestra la flecha junto a la cuchilla. Mientras está activa, el botón aparece apagado. A los 15 s la flecha desaparece.
- [ ] Reloj en partida: `timeLeft` sube 30 s.
- [ ] «Tiempo 3 s» → Derrota → «+30 s»:
  - el estado vuelve a `playing` con el campo tal como estaba (`field.cutCount` igual);
  - al ganar con «Ganar», el saldo guardado sube solo en lo nuevo más el bonus.
- [ ] Sin Relojes y con saldo: «+30 s» muestra el precio y lo cobra. Sin Relojes ni saldo, aparece apagado.
- [ ] Tienda: comprar un booster suma 1 uso y resta el precio.
- [ ] Se juegan los niveles 1 → 10 seguidos con «Ganar» y «Siguiente». Se compra al menos una mejora de cada tipo y se usa cada booster. Tras recargar, Inicio muestra el nivel 11, el saldo, las mejoras y los usos. No aparecen errores en la consola.

#### Verificación manual (usuario):
- [ ] Criterio de salida en el móvil: los niveles 1 → 10 se juegan a mano. Las mejoras se notan y la economía no se rompe (juicio de equilibrio).
- [ ] La flecha de la brújula se entiende y no tapa la cuchilla (juicio visual).
- [ ] Mantiene 55–60 fps con la brújula activa y el «+N» saliendo.

---

## Estrategia de pruebas

### Pruebas unitarias (Vitest)

- **Economía:** monedas por tipo y por pieza, onda incluida, el bonus, `bankCoins` sin contar dos veces y el reinicio.
- **Guardado:** viaje de ida y vuelta, JSON roto, valores no objeto, versión futura, saneado campo a campo, máximos de las mejoras y valores por defecto.
- **Mejoras:** precios crecientes y redondeados, máximo, compra sin saldo y efectos en la partida (tamaño, velocidad, tiempo y crecimiento). El nivel no cambia.
- **Boosters:** cuándo se puede usar cada uno, efectos, usos, compra, continuar desde la Derrota y `nearestTarget`.
- **Interfaz pura:** `coinFloats`, `coinsLabel`, `resultLines`, `continueButton`, `shopUpgradeRows`, `shopBoosterRows`, `homeDisplay`, el botón de confirmación y `boosterButtons`.
- **Render puro:** `compassAngle` y la distancia de la flecha.

Las pruebas leen `config.ts` y no repiten números de equilibrio. Los niveles de prueba son pequeños y hechos a mano, con `levelFromRows`, extraído a `tests/logic/levelFixtures.ts`.

### Prueba de arquitectura

Sin cambios en la regla. Cubre `economy.ts`, `save.ts`, `upgrades.ts` y `boosters.ts`. `tsconfig.logic.json` garantiza que `save.ts` no toca `localStorage`.

### Verificación en el navegador

El agente la hace con Claude in Chrome al final de las fases 3, 5 y 7, sobre `make preview` y con `?debug` (ver «Verificación en el navegador»). Comprueba el flujo, `localStorage`, `window.__siega` y la consola, y deja GIF y capturas. Al usuario solo le queda lo subjetivo y el dispositivo real.

## Rendimiento

- **Monedas:** `coinsForCuts` recorre los cortes del paso, que es lo mismo que ya recorre `markCut`.
- **«+N»:** como mucho 5 escrituras al DOM por segundo, sobre 6 elementos reutilizados.
- **Brújula:** `nearestTarget` es O(12 000) cada 0,2 s, solo con la brújula activa. La flecha es una malla con una llamada de dibujo.
- **Pantallas:** son capas HTML ocultas con una clase. En pausa, la escena se sigue dibujando sin pasos de lógica.
- **Carga inicial:** no hay recursos nuevos. El JS crece unos pocos KB, y `make size` lo vigila.

## Notas de migración

- `SaveData` v1 es el primer formato, así que no hay datos anteriores que migrar. `migrate` es la identidad y explica cómo añadir v2 en M5.
- Cambios de API:
  - `createGame(level, bonuses?)`, `createBlade(x, z, size?)` y `moveBlade(..., maxSpeed?)`, con valores por defecto que mantienen las pruebas actuales;
  - `Game` gana `bonuses`, `timeTotal`, `levelCoins`, `bonusCoins`, `bankedCoins` y `compassLeft`;
  - `StepResult` gana `coins`;
  - `ResultOverlay.show` recibe el resumen de monedas.

## Referencias

- Especificación: `plan.md`. Economía y boosters en `plan.md:144-172`, pantallas en `plan.md:174-184` y guardado en `plan.md:186-205`.
- Planes anteriores:
  - `thoughts/shared/plans/2026-10-20-siega-total-m0-m1-prototipo-de-corte.md`
  - `thoughts/shared/plans/2026-10-20-siega-total-m2-nivel-fijo.md`
  - `thoughts/shared/plans/2026-10-20-siega-total-m3-generador.md`
- Patrones que se reutilizan:
  - capa con `stopPropagation`: `src/ui/result.ts:23-52`;
  - temporizador puro: `src/ui/blockedNotice.ts`;
  - proyección a pantalla: `src/render/cameraRig.ts:38-42`;
  - calco en el suelo: `src/render/blade.ts:48-54`;
  - valores por tipo: `src/logic/obstacles.ts:40`.
