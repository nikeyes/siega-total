# Siega Total M6: calidad automática, campaña y v1.0 — Plan de implementación

## Resumen

M6 cierra la v1.0. Añade:

- **Calidad en tres niveles** (Alta, Media y Baja). Cada uno cambia el número de briznas, la resolución máxima, la sombra falsa y los restos. Solo cambia lo que se ve: el nivel se juega igual en cualquier calidad.
- **Calidad automática:** mide los fps al empezar cada intento y sube o baja un nivel para el siguiente.
- **Ajuste «Calidad»** en Ajustes: Auto, Alta, Media o Baja.
- **Guardado v3**, con `settings.quality`.
- **Restos según la calidad:** en Alta se quedan en el suelo; en Media se desvanecen, como hoy; en Baja hay menos.
- **Variedad desde el nivel 1:** en los niveles de un solo tipo de hierba, la arena dibuja el patrón.
- **Campaña curada de 50 niveles**, preseleccionada con una función pura y fijada en `campaign.ts`. Después del 50 sigue el modo infinito determinista.
- **v1.0:** versión 1.0.0, README y especificación al día. La etiqueta `v1.0.0` y la GitHub Release se crean solo cuando el usuario lo pida.

## Análisis del estado actual

- M0–M5 están publicados. M5 entró en `main` con las PR #8, #9 y #10 (`1864ec2`).
- El alcance sale de:
  - `plan.md:116-117` (densidad y contador exacto);
  - `plan.md:127-138` (campaña, modo infinito y curva de introducción);
  - `plan.md:184,197` (ajuste y guardado de la calidad);
  - `plan.md:209-223` (niveles de calidad);
  - `plan.md:235` (persistencia de los restos);
  - el reparto de hitos acordado en M4 (`thoughts/shared/plans/2026-10-21-siega-total-m4-economia-y-guardado.md:70`);
  - lo aplazado en M5 (`thoughts/shared/plans/2026-10-21-siega-total-m5-sonido-efectos-y-tutorial.md:88,90,118`).
- **No hay concepto de calidad.** Todo está fijo en Media:
  - `config.field.bladeCount: 12_000` (`src/config.ts:5`);
  - `config.render.maxPixelRatio: 1.5`, que se aplica una sola vez en `src/render/scene.ts:21`;
  - la sombra siempre se crea y no se puede ocultar (`src/render/blade.ts:48-54`);
  - los restos usan un pool fijo de 1 260 piezas que se encogen en 0,7 s (`src/main.ts:61,101-109`).
- **El número de briznas cambia el juego:**
  - el crecimiento cuenta cada brizna cortada (`src/logic/game.ts:130-131`, `cutsToNextSize = 200 × size` en `src/logic/blade.ts:32-34`);
  - las monedas se pagan por brizna (`src/logic/economy.ts:7-12`);
  - la validación y el tiempo estimado leen `config.field.bladeCount` (`src/logic/validation.ts:80,86-95`).
- **El contador ya es exacto** para cualquier número de briznas, porque `countByType` se cuenta al colocarlas (`src/logic/field.ts:80`).
- **Reconstrucción:** el número de briznas solo puede cambiar al crear `Field`, `Game` y `GrassView` de nuevo. Eso ocurre en `playLevel` (`src/main.ts:270-285`), al que llaman Siguiente, Reintentar, Jugar, Inicio y el panel.
- **Monedas:** `levelCoins` es un entero que suma `coinsForCuts`. `bankCoins` ingresa la diferencia (`economy.ts:20-24`). El HUD calcula el saldo en `main.ts:505`. `coinFloats` suma las monedas de los pasos (`src/ui/coinFloats.ts`). `formatCount` mostraría decimales.
- **Medición:** el bucle tiene el tiempo de frame sin recortar en `realSeconds` (`main.ts:434`). El panel calcula los fps en ventanas de 0,5 s (`src/debug/panel.ts:106-112`).
- **Guardado:** `SaveData` v2 (`src/logic/save.ts:14-28`). `sanitizeFlags` solo acepta booleanos (`save.ts:100-104`).
- **Ajustes:** las filas son interruptores booleanos (`src/ui/settings.ts:13-30`), enlazados por índice con botones creados una sola vez (`settings.ts:40-44,63-69`).
- **Generador:** con `grassTypeCount = 1` (niveles 1–4), todos los patrones salen con una sola región y el campo es uniforme (`src/logic/generator.ts:28-31`, `src/logic/difficulty.ts:49`).
- **Campaña:** `src/campaign.ts` está vacío. `levelFor` usa la primera semilla válida de cada nivel sin semilla curada (`src/logic/progression.ts:26-32`), y eso ya sirve de modo infinito. `tests/logic/progression.test.ts:115-121` exige que toda semilla curada sea válida.
- **Herramientas:** no hay `tsx` ni `vite-node`. `package.json` tiene `"version": "0.0.0"` y no hay README.

## Estado final deseado

1. **Peso por brizna:**
   - Cada brizna cortada cuenta `12 000 / briznas del campo` para el crecimiento y las monedas.
   - El crecimiento, las monedas y el tiempo de un nivel son iguales en las tres calidades. La única diferencia es menos de 1 moneda por el redondeo.
   - La validación y el tiempo estimado no dependen de la calidad.
2. **Monedas fraccionarias:** `levelCoins` admite decimales. El HUD, el «+N», la Victoria y el saldo usan siempre enteros, redondeados hacia abajo.
3. **Niveles de calidad** (en `config.quality.levels`):

   | Nivel | Briznas | Resolución máx. | Sombra | Restos |
   | --- | --- | --- | --- | --- |
   | Alta | 20 000 | 2× | Sí | Se quedan en el suelo (hasta 3 000) |
   | Media | 12 000 | 1,5× | Sí | Se desvanecen en 0,7 s; 1 por cada 3 briznas, tope de 30 por frame |
   | Baja | 6 000 | 1× | No | Se desvanecen; 1 por cada 9 briznas, tope de 10 por frame |

4. **Aplicación:** la calidad entera (briznas, resolución, sombra y restos) se aplica al construir cada intento en `playLevel`. Nunca cambia a mitad de un intento.
5. **Calidad automática:**
   - Cada sesión empieza en Media.
   - En cada intento solo cuentan los frames jugados (`playing`). Se descartan los 0,5 s iniciales y los frames de más de 0,25 s.
   - Tras 3 s medidos, el intento da un veredicto:
     - por debajo de 50 fps, el siguiente intento baja un nivel;
     - con 58 fps o más en 2 intentos seguidos, sube un nivel, pero nunca a uno del que ya se bajó en esta sesión.
   - Un intento con menos de 3 s medidos no da veredicto.
6. **Ajuste «Calidad»:**
   - Una fila más en Ajustes. Cada toque cicla Auto → Alta → Media → Baja → Auto y guarda.
   - En Auto muestra el nivel activo: «Calidad · Auto (Media)».
   - Un nivel fijo deja de medir.
7. **Guardado v3:** `settings.quality: 'auto' | 'high' | 'medium' | 'low'`. Un guardado v2 migra con `'auto'`. Un valor desconocido toma `'auto'`.
8. **Variedad:** los patrones tienen siempre al menos 2 regiones. Las regiones sin un tipo de hierba disponible quedan en arena, así que los niveles 1–4 muestran franjas, anillos, espiral, islas… Los niveles con 2 tipos de hierba o más no cambian.
9. **Campaña:**
   - `campaign.ts` tiene las semillas de los niveles 1–50, elegidas con `pickCampaign` y el botón «Copiar campaña» del panel.
   - No hay dos niveles seguidos, ni a dos de distancia, con el mismo patrón.
   - Del 51 en adelante, `levelFor` genera el nivel de forma determinista.
10. **Panel (`?debug`):**
    - el monitor muestra la calidad activa, el ajuste y los fps medidos del intento;
    - «fps simulados» (0 = desactivado) sustituye el tiempo de frame que mide la calidad;
    - `window.__siegaQuality` da `{ setting, level, measuredFps, pixelRatio, shadow }`;
    - «Copiar campaña».
11. **v1.0:** `package.json` en `1.0.0`, `README.md` y `plan.md` al día.
12. **Comprobación:** `make check test build size` pasa.

### Decisiones (resueltas con grill-me)

| Tema | Decisión |
| --- | --- |
| Densidad y juego | Peso por brizna: `bladeWeight = referenceBladeCount (12 000) / field.bladeCount`. Multiplica los cortes de hierba para el crecimiento y las monedas. Los obstáculos no cambian. La validación usa siempre la referencia. |
| Monedas fraccionarias | Se acumulan con decimales. Al mostrarlas y al ingresarlas se redondean hacia abajo. El saldo siempre es entero. |
| Momento del cambio | Todo en el siguiente intento (`playLevel`): briznas, resolución, sombra y restos. |
| Algoritmo de Auto | Medición por intento con histéresis: 0,5 s de calentamiento, frames de más de 0,25 s descartados, veredicto tras 3 s medidos. Por debajo de 50 fps baja; 58 fps o más en 2 intentos seguidos sube, nunca a un nivel del que se bajó. Función pura en `logic/quality.ts` y valores en `config.quality`. |
| Persistencia | No: Auto siempre empieza en Medio. Solo se guarda el ajuste. |
| Ajuste | Un botón que cicla, con «Auto (Media)» en Auto. |
| Restos | Alta: se posan en el suelo en una malla de 3 000 piezas, se reutiliza la más antigua y se vacía en cada intento. Media: como hoy. Baja: 1 por cada 9 briznas y tope de 10 por frame. |
| Orden de aparición | Manda el código (lavanda 10, roca 13, fruta 16, zarza 19, cactus 22). Se actualiza `plan.md:138`. |
| Variedad | Al menos 2 regiones por patrón. Las regiones sin tipo de hierba quedan en arena. |
| Curva | Sin cambios (`curveLastLevel: 25`). |
| Curación | `pickCampaign` puro y probado, y «Copiar campaña» en el panel. Criterio: primer intento válido cuyo patrón no repite el de los 2 niveles anteriores y cuya semilla no se ha usado; si ninguno cumple, el primero válido. El agente fija las 50 semillas y el usuario las repasa jugando. |
| Modo infinito | Determinista por número, con `levelFor`. Sin marca especial en el HUD. |
| v1.0 | `1.0.0`, README y `plan.md`. La etiqueta `v1.0.0` y la release, solo cuando el usuario lo pida. Sin cambios en el workflow. |
| Criterio de salida | Automatizable: en Chrome, con fps simulados, Auto baja en el siguiente intento; las tres calidades se ven; 50 semillas válidas y el nivel 51 se genera. Manual: el usuario juega 1 → 50 en el móvil en Auto, cambia las semillas que no le gusten, y no hay caídas sostenidas por debajo de 50 fps. |
| Entregas | Dos PR desde `main`. **PR A** `feat/m6-quality` (fases 1–4). **PR B** `feat/m6-campaign` (fases 5–7), creada tras fusionar la A. |

### Decisiones de detalle (tomadas al escribir el plan)

- **Nombres en el código:** `'high' | 'medium' | 'low'`, en inglés como el resto del código. Los textos visibles («Alta», «Media», «Baja») salen de `texts.ts`. `plan.md:197` se actualiza.
- **`config.field.bladeCount` pasa a `config.field.referenceBladeCount`.** El nombre nuevo dice que es la densidad de referencia de la lógica y no lo que se dibuja. Las pruebas que lo leen se actualizan.
- **Peso en `Game`:** `bladeWeight` se calcula una vez en `createGame` y vale 0 en un campo sin briznas.
- **`unbankedCoins(game)`** en `economy.ts` (`Math.floor(levelCoins + bonusCoins) - bankedCoins`) es la única regla de redondeo. La usan `bankCoins` y el HUD.
- **`coinFloats`** suelta la parte entera de lo acumulado y guarda el resto para el siguiente «+N». Nunca saca un «+0».
- **Restos que aterrizan:** en Alta, el trozo en vuelo no se encoge. Al acabar su vida se sustituye por uno tumbado en el suelo en el mismo (x, z), con el mismo color y un giro aleatorio.
- **Medir solo en Auto:** con un nivel fijo, el monitor no recibe frames. Volver a Auto sigue desde el nivel en que estaba.
- **Pixel ratio:** `GameScene.setMaxPixelRatio(max)` aplica `min(devicePixelRatio, max)` y vuelve a ajustar el tamaño. `config.render` desaparece.
- **Regiones de arena:** `typeOfRegion[region] ?? null`. Con un solo tipo, la región 0 es hierba y el resto arena. En «islas» y «camino serpenteante», la región 0 es el fondo, así que las islas y los caminos quedan en arena. Solo cambian los niveles con `grassTypeCount = 1`, porque los demás llaman al patrón con los mismos parámetros.
- **Densidad en los niveles 1–4:** las 12 000 briznas de referencia se reparten en menos celdas, así que la hierba se ve más densa. El tiempo estimado baja porque hay menos celdas que barrer.
- **«Copiar campaña»** copia el objeto entero al portapapeles y lo escribe también con `console.info`, para que el agente lo lea con `read_console_messages`.

### Hallazgos clave

- `src/logic/field.ts:53-57`: `levelFieldOptions` es el único sitio que da el número de briznas al campo.
- `src/logic/game.ts:128-133,158-163`: crecimiento y monedas de cada paso y de la onda.
- `src/logic/validation.ts:80,86-95`: la validación repite el reparto de `createField` con `config.field.bladeCount`.
- `src/render/burst.ts:64-140`: el pool de piezas; la vida y el encogido se leen al crearlo.
- `src/main.ts:270-285`: `playLevel` es el único punto donde se construye un intento.
- `src/ui/settings.ts:33-72`: los botones se crean una vez y se enlazan por índice; la lista de filas es estable en una sesión.
- `src/logic/generator.ts:28-31`: el patrón recibe `regionCount = grassTypeCount`.
- `src/debug/panel.ts:131-166`: herramientas de nivel y semilla; `copySeed` es el patrón de «Copiar campaña».

## Qué NO hacemos

- Guardar el nivel detectado entre sesiones.
- Cambiar la calidad a mitad de un intento.
- Sombras reales, antialiasing variable u otros parámetros de calidad fuera de la tabla.
- Cambiar la curva de dificultad o el orden de aparición.
- Semillas aleatorias en el modo infinito, o una marca de «modo infinito» en el HUD.
- Selector de niveles.
- Nuevas dependencias (`tsx`, `vite-node`).
- Mostrar la versión dentro del juego.
- Crear la etiqueta o la release sin que el usuario lo pida.
- Curar a mano las 50 semillas: eso lo hace el usuario después, con el panel.

## Enfoque de implementación

El mismo orden que en M3–M5: primero la lógica pura con TDD, después el navegador. Cada fase deja `make check test build` en verde.

- **PR A, `feat/m6-quality`** (fases 1–4): peso por brizna, guardado v3, monitor, aplicación de la calidad, ajuste y panel.
- **PR B, `feat/m6-campaign`** (fases 5–7): variedad, campaña y v1.0. Se crea desde `main` después de fusionar la A. La campaña se elige después de la fase 5, porque esa fase cambia los niveles 1–4.

### Verificación en el navegador (fases 4 y 7)

La hace el agente con Claude in Chrome, como en M5:

- **Preparación:** `make build && make preview` (`http://localhost:4173/siega-total/?debug`), en una pestaña nueva lo más cerca posible de 390 × 844.
- **Herramientas:**
  - `javascript_tool` para leer `window.__siega`, `window.__siegaQuality`, `localStorage['siega-total']` y el DOM;
  - `find`/`computer` para pulsar;
  - capturas de pantalla;
  - `read_console_messages` para errores y para «Copiar campaña».
- La cuchilla se mueve manteniendo D con eventos `keydown`/`keyup`.
- **Prohibido:** lanzar diálogos del navegador.
- **Grabación:** un GIF por verificación (`m6-a-calidad.gif`, `m6-b-campana.gif`). Solo se exporta si el usuario permite la descarga.

---

## Fase 1: Peso por brizna

### Resumen

La lógica se juega igual con cualquier número de briznas: el crecimiento y las monedas se ponderan, y las monedas admiten decimales sin que se vean.

### Cambios necesarios

#### 1. Configuración

**Archivo**: `src/config.ts`

```ts
field: {
  // …
  /** The blade count the game rules are tuned for; each blade cut counts referenceBladeCount / bladeCount of it. */
  referenceBladeCount: 12_000,
  // …
},
```

`bladeCount` desaparece. Lo leen `validation.ts`, `field.ts` y las pruebas.

#### 2. Campo

**Archivo**: `src/logic/field.ts`

```ts
/** The field of `level` with `bladeCount` blades, the spatial grid and the level's seed. */
export function levelFieldOptions(level: LevelDefinition, bladeCount: number): FieldOptions;
```

#### 3. Partida

**Archivo**: `src/logic/game.ts`

- `Game` gana el campo:
  ```ts
  /** How much each blade cut counts for growth and coins, so every quality plays the same. */
  bladeWeight: number;
  ```
- `createGame(level, bonuses, bladeCount = config.field.referenceBladeCount)` y `bladeWeight = field.bladeCount === 0 ? 0 : referenceBladeCount / field.bladeCount`.
- En `stepGame`: `growthCuts = cutIndices.length * game.bladeWeight + growthCutsOf(...)`.
- `levelCoins` es la suma con decimales de `coinsForCuts`. Su comentario lo dice.

#### 4. Economía

**Archivo**: `src/logic/economy.ts`

- `coinsForCuts`: las monedas de las briznas se multiplican por `game.bladeWeight`; las de los obstáculos, no.
- Función nueva:
  ```ts
  /** Whole coins of this attempt not yet in the balance: the level's coins rounded down, minus those banked. */
  export function unbankedCoins(game: Game): number;
  ```
- `bankCoins(game)` devuelve `unbankedCoins(game)` y suma esa cantidad a `bankedCoins`.

#### 5. Validación

**Archivo**: `src/logic/validation.ts`: `config.field.bladeCount` → `config.field.referenceBladeCount` en `boardOf` y `bladesInCells`. Su comentario dice que la validación siempre trabaja con la densidad de referencia.

#### 6. Monedas a la vista

- **`src/ui/coinFloats.ts`:** `step` acumula con decimales y suelta `Math.floor(gathered)`. Guarda el resto y devuelve null mientras la parte entera sea 0.
- **`src/main.ts`:**
  - HUD: `coins: save.coins + unbankedCoins(game)`.
  - `resultOverlay.show(..., { levelCoins: Math.floor(game.levelCoins), bonusCoins: game.bonusCoins }, save)`.

### Pruebas

**`tests/logic/game.test.ts`:**
- Un mismo nivel pequeño con N y 2N briznas: barrer todo el campo da el mismo tamaño final y el mismo `Math.floor(levelCoins)` (±1).
- `bladeWeight` es `referenceBladeCount / bladeCount`, y 0 en un campo sin hierba.
- La prueba de `field.bladeCount` (`:184`) pasa a `referenceBladeCount` por defecto, y a un valor explícito si se pasa `bladeCount`.

**`tests/logic/economy.test.ts`:**
- `coinsForCuts` multiplica las briznas por el peso y no los obstáculos. Las pruebas `:64,69` se actualizan.
- `unbankedCoins` redondea hacia abajo. Dos `bankCoins` seguidos no ingresan dos veces la misma moneda, y la suma ingresada es `Math.floor(levelCoins + bonusCoins)`.

**`tests/ui/coinFloats.test.ts`:**
- 0,6 + 0,6 en el mismo intervalo dan «+1» y guardan 0,2.
- Solo 0,4 no saca nada.

**`tests/logic/field.test.ts:69-70`:** `levelFieldOptions(level, 500)` da `bladeCount: 500`.

**`tests/logic/validation.test.ts:58`:** usa `referenceBladeCount`.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La compilación termina: `make build`

---

## Fase 2: Guardado v3 y monitor de calidad

### Resumen

Los tipos de calidad, el ajuste guardado y la función pura que decide el nivel de cada intento.

### Cambios necesarios

#### 1. Configuración

**Archivo**: `src/config.ts` (`render` desaparece)

```ts
quality: {
  /** Played seconds skipped at the start of each attempt, while shaders compile and the camera settles. */
  warmupSeconds: 0.5,
  /** Longer frames are a hidden tab or a hiccup, not the game's pace, and are left out. */
  maxSampleFrameSeconds: 0.25,
  /** Played seconds measured in each attempt before its verdict. */
  measureSeconds: 3,
  /** Below this, the next attempt drops one level… */
  dropBelowFps: 50,
  /** …and at or above this for riseAfterAttempts attempts in a row, it rises one. */
  riseAtFps: 58,
  riseAfterAttempts: 2,
  /** The level every session starts with. */
  startLevel: 'medium',
  /** Clippings lying on the ground at most, in the levels that keep them. */
  groundClippings: 3000,
  levels: {
    high: { bladeCount: 20_000, maxPixelRatio: 2, shadow: true, clippings: 'persistent', bladesPerClipping: 3, maxClippingsPerFrame: 30 },
    medium: { bladeCount: 12_000, maxPixelRatio: 1.5, shadow: true, clippings: 'fade', bladesPerClipping: 3, maxClippingsPerFrame: 30 },
    low: { bladeCount: 6_000, maxPixelRatio: 1, shadow: false, clippings: 'fade', bladesPerClipping: 9, maxClippingsPerFrame: 10 },
  },
},
```

- `bladesPerClipping` y `maxClippingsPerFrame` salen de `config.effects`.
- `config.quality` no entra en el panel: tiene textos y booleanos, y se lee al construir cada intento.

#### 2. Tipos y monitor

**Archivo**: `src/logic/quality.ts` (nuevo, puro)

```ts
export type QualityLevel = keyof typeof config.quality.levels;   // 'high' | 'medium' | 'low'
export type QualitySetting = 'auto' | QualityLevel;

/** From best to cheapest. */
export const QUALITY_LEVELS: readonly QualityLevel[] = ['high', 'medium', 'low'];
/** The order a tap on the setting goes through. */
export const QUALITY_SETTINGS: readonly QualitySetting[] = ['auto', 'high', 'medium', 'low'];

export function nextQualitySetting(setting: QualitySetting): QualitySetting;

export interface QualityMonitor {
  /** One played frame of the current attempt, `seconds` long. */
  sampleFrame(seconds: number): void;
  /** Frames per second measured in the current attempt, once measureSeconds are in; otherwise null. */
  measuredFps(): number | null;
  /** Closes the current attempt's verdict and gives the level to build the next one with. */
  nextAttempt(): QualityLevel;
}

export function createQualityMonitor(start: QualityLevel = config.quality.startLevel): QualityMonitor;

/** The level an attempt is built with: the fixed one, or the monitor's under 'auto'. */
export function qualityForAttempt(setting: QualitySetting, monitor: QualityMonitor): QualityLevel;
```

Reglas de `createQualityMonitor`:
- **Calentamiento y descarte:** los primeros `warmupSeconds` de cada intento no cuentan. Tampoco cuentan los frames de más de `maxSampleFrameSeconds`.
- **Medición:** se suman frames y segundos hasta llegar a `measureSeconds`. Después, `sampleFrame` no hace nada hasta el siguiente intento.
- **Veredicto en `nextAttempt`:**
  - sin medición completa, el nivel no cambia y la racha de subida se mantiene;
  - con menos de `dropBelowFps`, baja un nivel (si no está ya en `low`), apunta el nivel del que bajó y reinicia la racha;
  - con `riseAtFps` o más, suma uno a la racha; al llegar a `riseAfterAttempts`, sube un nivel si el de arriba existe y no se ha bajado de él, y reinicia la racha;
  - entre los dos umbrales, la racha vuelve a 0.
- `nextAttempt` empieza la medición del intento nuevo.
- `qualityForAttempt` llama a `monitor.nextAttempt()` solo con `'auto'`. Con un nivel fijo devuelve ese nivel y el monitor se queda como estaba.

#### 3. Guardado v3

**Archivo**: `src/logic/save.ts`

```ts
export interface Settings {
  sound: boolean;
  vibration: boolean;
  quality: QualitySetting;
}

export interface SaveData {
  version: 3;
  // … the rest as in v2
}

export const SAVE_VERSION = 3;
```

- `defaultSave()`: `settings.quality: 'auto'`.
- `migrate`, un paso por versión:
  ```ts
  if (data.version === 1) data = { ...data, version: 2, tutorialDone: true };
  // Version 2 had no quality setting; sanitize gives it the default, 'auto'.
  if (data.version === 2) data = { ...data, version: 3 };
  ```
- `sanitize`: `settings: sanitizeSettings(data.settings, defaults.settings)`.
  - Los booleanos (`sound`, `vibration`) siguen con `booleanOr`.
  - `quality` usa `oneOf(QUALITY_SETTINGS, value, fallback)`.
  - Las claves desconocidas se descartan.
  - `sanitizeFlags` desaparece si no lo usa nadie más.

### Pruebas

**`tests/logic/quality.test.ts`** (nuevo). Los frames se simulan con un ayudante `playFrames(monitor, fps, seconds)`:
- Sin frames, `nextAttempt()` da `medium` una y otra vez.
- A 40 fps durante 4 s: `medium` → `low`. Otra vez a 40 fps: se queda en `low`.
- A 60 fps en un intento sube solo tras el segundo intento seguido (`medium` → `medium` → `high`).
- Tras bajar de `high` a `medium`, dos intentos a 60 fps no vuelven a `high`.
- Un intento a 55 fps entre dos a 60 fps reinicia la racha.
- Los frames de 0,5 s (pestaña oculta) no cuentan: 3 s a 60 fps con un frame de 0,5 s en medio no bajan.
- Los primeros 0,5 s no cuentan: un pico de 20 fps solo al principio no baja.
- Un intento de 2 s no da veredicto y no rompe la racha.
- `measuredFps()` es null antes de `measureSeconds` y ≈ 40 tras 4 s a 40 fps.
- `qualityForAttempt('low', monitor)` da `low` y no consume el intento del monitor.
- `nextQualitySetting` recorre `auto → high → medium → low → auto`.

**`tests/logic/save.test.ts`:**
- `progressedSave()` pasa a v3 con `settings.quality: 'low'`. El viaje de ida y vuelta lo conserva.
- `defaultSave()` tiene `quality: 'auto'`.
- Un guardado v2 se carga con `version: 3`, `quality: 'auto'` y el resto intacto.
- Un guardado v1 sigue migrando: tutorial hecho, ajustes en true y `quality: 'auto'`.
- Con `quality: 'ultra'`, `quality: 3` o sin `quality`, ese campo toma `'auto'` y el resto se conserva.

**`tests/architecture.test.ts`:** sin cambios. Ya cubre `logic/quality.ts`.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La compilación termina: `make build`

---

## Fase 3: Aplicar la calidad en cada intento

### Resumen

`playLevel` construye cada intento con su calidad: briznas, resolución, sombra y restos, con los restos que se quedan en el suelo en Alta.

### Cambios necesarios

#### 1. Resolución

**Archivo**: `src/render/scene.ts`
- `GameScene` gana `setMaxPixelRatio(max: number): void`, que llama a `renderer.setPixelRatio(Math.min(window.devicePixelRatio, max))` y a `resize()`.
- `createGameScene` deja de leer `config.render`.

#### 2. Sombra

**Archivo**: `src/render/blade.ts`: `BladeView` gana `setShadowVisible(visible: boolean): void` (`shadow.visible = visible`).

#### 3. Restos que aterrizan

**Archivo**: `src/render/burst.ts`
- `BurstOptions` gana dos opciones:
  ```ts
  /** Pieces shrink away over their lifetime; when false they keep their size to the end. */
  shrink: boolean;                                                   // default true
  /** Called with where each piece ends up and its color, when its lifetime is over. */
  onExpire?: (x: number, z: number, color: number) => void;
  ```
- `Piece` guarda su color y su última posición. `update` llama a `onExpire` al ocultar cada pieza.
- Con los valores por defecto, la explosión de fruta y los restos de Media no cambian.

**Archivo**: `src/render/groundClippings.ts` (nuevo)

```ts
export interface GroundClippings {
  /** Lays a clipping flat on the ground at (x, z); past capacity, the oldest one is moved here. */
  place(x: number, z: number, color: number): void;
  /** Takes every clipping off the ground. */
  clear(): void;
  dispose(): void;
}
export function createGroundClippings(scene: Scene, capacity: number): GroundClippings;
```

- Un `InstancedMesh` de `PlaneGeometry` igual que los restos en vuelo (0,14 × 0,42), tumbado a y = 0,02, con color por instancia y un giro aleatorio en y.
- Usa un búfer circular (`next = (next + 1) % capacity`) y `frustumCulled = false`. Las instancias sin usar tienen escala 0.

**Archivo**: `src/render/clippings.ts`: función pura nueva, junto a `clippingBlades`.

```ts
/** The clippings' burst options for a quality level: flat strips that land when the level keeps them. */
export function clippingOptions(level: QualityLevel): Partial<BurstOptions>;
```

- Siempre da `geometry: 'flat'`, `pieceSize: 0.14`, `lifetimeSeconds: config.effects.clippingSeconds` y las velocidades de hoy.
- `poolSize` sale de `maxClippingsPerFrame` del nivel × `clippingSeconds` × 60.
- `shrink` es `clippings !== 'persistent'`. `onExpire` lo pone `main.ts`.

#### 4. Bucle principal

**Archivo**: `src/main.ts`
- Se crean:
  - `qualityMonitor = createQualityMonitor()`;
  - `groundClippings = createGroundClippings(scene, config.quality.groundClippings)`;
  - `let quality: QualityLevel | null = null`.
- `clippings` pasa a `let` y se crea en `applyQuality`.
- **`applyQuality(level)`**, llamado desde `playLevel` antes de `createGame`:
  ```ts
  function applyQuality(next: QualityLevel): void {
    groundClippings.clear();
    if (next === quality) return;
    quality = next;
    const settings = config.quality.levels[next];
    gameScene.setMaxPixelRatio(settings.maxPixelRatio);
    bladeView.setShadowVisible(settings.shadow);
    clippings?.dispose();
    clippings = createBurstView(gameScene.scene, {
      ...clippingOptions(next),
      onExpire: settings.clippings === 'persistent' ? groundClippings.place : undefined,
    });
  }
  ```
- **`playLevel`:** `applyQuality(qualityForAttempt(save.settings.quality, qualityMonitor))`, y luego `createGame(level, bonusesFor(save.upgrades), config.quality.levels[quality].bladeCount)`.
- **En el bucle:**
  - Si `screen === 'playing' && game.status === 'playing' && save.settings.quality === 'auto'`, se llama a `qualityMonitor.sampleFrame(debugPanel?.simulatedFrameSeconds() ?? realSeconds)`.
  - Los restos leen `bladesPerClipping` y `maxClippingsPerFrame` de `config.quality.levels[quality]`.
- `fitToContainer` sigue igual: `resize()` respeta el pixel ratio actual.
- `CLIPPING_POOL_FRAMES_PER_SECOND` pasa a `clippings.ts`, junto a `clippingOptions`.

### Pruebas

**`tests/render/clippings.test.ts`:**
- `clippingOptions('high')` no encoge y `'medium'`/`'low'` sí.
- `poolSize` es `maxClippingsPerFrame × clippingSeconds × 60`, redondeado hacia arriba, en cada nivel.
- Todas son `'flat'`, con `clippingSeconds` de vida.

**`tests/render/burstMotion.test.ts`:** sin cambios.

`groundClippings` y los cambios de `scene` y `blade` son solo Three.js. Se comprueban en Chrome en la fase 4.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La compilación termina: `make build`

---

## Fase 4: Ajuste de calidad y panel (fin de la PR A)

### Resumen

La fila «Calidad» en Ajustes, el estado de la calidad en el panel y los fps simulados para probarla.

### Cambios necesarios

#### 1. Ajustes

**Archivo**: `src/ui/settings.ts`

```ts
export interface SettingsActions {
  onToggleSound(): void;
  onToggleVibration(): void;
  onCycleQuality(): void;
  onClearProgress(): void;
  onBack(): void;
}

export interface SettingRow {
  key: keyof Settings;
  label: string;
  valueLabel: string;
  /** On or off for the switches; null for the quality picker, which has no pressed state. */
  pressed: boolean | null;
}

/** Sound, vibration where the browser can vibrate, and quality, which under Auto names the level in use. */
export function settingRows(save: SaveData, vibrationSupported: boolean, activeQuality: QualityLevel): SettingRow[];
```

- La fila de calidad va después de las de sonido y vibración, con `valueLabel`:
  - `texts.settings.qualityLevels[setting]` con un nivel fijo («Alta»);
  - `texts.settings.autoQuality` formateado («Auto (Media)») en Auto.
- `actions` se enlaza por `row.key` (`sound`, `vibration` o `quality`).
- `render(save, activeQuality)` pone `aria-pressed` solo cuando `pressed !== null` y lo quita en la fila de calidad.

#### 2. Bucle principal

**Archivo**: `src/main.ts`
- `onCycleQuality`: `save.settings.quality = nextQualitySetting(save.settings.quality)` y después `saveSettings()`.
- `renderSave()` pasa el nivel activo a `settingsScreen.render(save, quality!)`.
- **Depuración:**
  - `Object.defineProperty(window, '__siegaQuality', { get: () => ({ setting: save.settings.quality, level: quality, measuredFps: qualityMonitor.measuredFps(), pixelRatio: gameScene.renderer.getPixelRatio(), shadow: config.quality.levels[quality!].shadow }) })`;
  - `createDebugPanel(getGame, actions, getQuality)`, donde `getQuality` devuelve lo mismo.

#### 3. Panel

**Archivo**: `src/debug/panel.ts`
- `createDebugPanel(getGame, actions, getQuality: () => QualityStatus)`.
- El monitor gana `quality` (por ejemplo, «auto → medium») y `measuredFps`.
- Una carpeta `quality` con el número `simulatedFps` (0–120, 0 = desactivado).
- `DebugPanel` gana `simulatedFrameSeconds(): number | null`, que da `1 / simulatedFps` o null.

#### 4. Textos

**Archivo**: `src/texts.ts`
- `settings.quality: 'Calidad'`.
- `settings.qualityLevels: { auto: 'Auto', high: 'Alta', medium: 'Media', low: 'Baja' }`.
- `settings.autoQuality: 'Auto ({level})'`.
- `debug.quality: 'Calidad'`, `debug.measuredFps: 'FPS medidos'` y `debug.simulatedFps: 'FPS simulados'`.

### Pruebas

**`tests/ui/settings.test.ts`:**
- Hay tres filas con vibración y dos sin ella. La calidad siempre es la última.
- `'auto'` con `medium` activo da «Auto (Media)». `'low'` da «Baja» sea cual sea el nivel activo.
- `pressed` es null en la calidad y sigue a `save.settings` en los interruptores.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La carga inicial pesa menos de 2 MB comprimidos: `make size`
- [x] El panel sigue en un fragmento aparte: `make build && ! grep -q 'lil-gui' dist/assets/index-*.js`

#### Verificación en Chrome (agente, `?debug`, GIF `m6-a-calidad.gif`):
- [x] Al cargar, `__siegaQuality` da `{ setting: 'auto', level: 'medium' }` y `__siega.field.bladeCount` es 12 000.
- [x] Con «FPS simulados» a 30, tras más de 3,5 s manteniendo D, `measuredFps` ≈ 30. Al pulsar «Reiniciar», `level: 'low'`, 6 000 briznas, `pixelRatio` 1 y `shadow: false`. Una captura muestra la cuchilla sin sombra.
- [x] Con «FPS simulados» a 60 en varios intentos seguidos de más de 3,5 s tras bajar a `low`, la calidad se queda en `low` en esta sesión: no vuelve a un nivel del que ya bajó (4 intentos a 60 fps, siempre `low`).
- [x] Ajustes → «Calidad» cicla «Auto (Baja)» → «Alta» → «Media» → «Baja» → «Auto (…)». `localStorage` guarda cada paso en `settings.quality`, y tras recargar se mantiene.
- [x] Con «Alta» fija y Jugar: 20 000 briznas y `pixelRatio` = `min(devicePixelRatio, 2)`. Tras barrer un rato con D, una captura muestra restos tumbados en la hierba cortada. Al reintentar, el suelo vuelve a estar limpio.
- [x] Con un nivel fijo, los fps simulados no cambian el nivel.
- [x] Mismo nivel en Alta y en Baja con «Ganar»: el tamaño y las monedas de la Victoria son los mismos (±1 moneda).
- [x] Con un guardado v2 de M5 en `localStorage` y recargando, se conservan el nivel, el saldo y los ajustes. El siguiente `writeSave` deja `version: 3` y `quality: 'auto'`.
- [x] No hay errores en la consola (`read_console_messages`).

#### Verificación manual (usuario):
- [ ] Alta, Media y Baja se ven bien en el móvil, y los restos en el suelo de Alta quedan bonitos (juicio visual).
- [ ] En Auto, el móvil se asienta en un nivel sin tirones (sensación y rendimiento reales).

---

## Fase 5: Variedad en los primeros niveles

### Resumen

Con un solo tipo de hierba, el patrón se dibuja con hierba y arena.

### Cambios necesarios

#### 1. Configuración

**Archivo**: `src/config.ts`: `generator.minPatternRegions: 2`, con el comentario «Patterns always split the field at least this much; regions with no grass type left are sand, so even one-grass levels show their shape».

#### 2. Generador

**Archivo**: `src/logic/generator.ts`
- `regionCount: Math.max(config.generator.minPatternRegions, difficulty.grassTypeCount)` al llamar a `PATTERNS[pattern]`.
- `cells`: `region === SAND_REGION ? null : (typeOfRegion[region] ?? null)`, comentado como «regions past the level's grass types are sand».
- `fallbackLevel` no cambia.

### Pruebas

**`tests/logic/generator.test.ts`:**
- En los niveles 1, 2 y 3, para varias semillas, el campo tiene celdas verdes y celdas de arena fuera del claro de salida, y solo hay verde.
- En un nivel con `grassTypeCount ≥ 2` (por ejemplo, el 10), `generateLevel(10, seed)` es igual que antes del cambio: una instantánea de `cells` de una semilla, tomada antes de tocar el generador.

**`tests/logic/generator.property.test.ts` y `tests/logic/progression.test.ts`:** sin cambios. Deben seguir pasando: todo nivel aceptado es posible y los niveles 1–60 son válidos.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La compilación termina: `make build`

---

## Fase 6: Campaña de 50 niveles

### Resumen

La preselección pura, el botón del panel y las 50 semillas fijadas en `campaign.ts`.

### Cambios necesarios

#### 1. Configuración

**Archivo**: `src/config.ts`: `campaign: { levels: 50, distinctPatternsBehind: 2 }`.

#### 2. Preselección

**Archivo**: `src/logic/campaignPicker.ts` (nuevo, puro)

```ts
/**
 * A seed for each level from 1 to `lastLevel`: the first valid attempt whose pattern differs from the
 * `distinctPatternsBehind` levels before it and whose seed is not used yet, or else the first valid attempt.
 */
export function pickCampaign(lastLevel = config.campaign.levels): Record<number, number>;
```

- Por cada nivel prueba `attemptSeed(level, attempt)` desde el intento 0 hasta `config.generator.maxAttempts - 1`, con `generateLevel` y `validateLevel`.
- Se queda con el primer intento que cumple todo. Si ninguno cumple, toma el primero válido. Si no hay ninguno válido, el nivel no entra en el resultado y `levelFor` usará el nivel alternativo.

#### 3. Panel

**Archivo**: `src/debug/panel.ts`
- Botón `texts.debug.copyCampaign` («Copiar campaña») en la carpeta «Nivel».
- Construye el texto `{\n  1: 123,\n  …\n}` a partir de `pickCampaign()`, lo copia al portapapeles y lo escribe con `console.info`.

#### 4. Semillas

**Archivo**: `src/campaign.ts`
- El agente pulsa «Copiar campaña» en Chrome, lee la salida con `read_console_messages` y pega las 50 líneas.
- El comentario se mantiene y explica también «Copiar campaña» para regenerarla entera.

### Pruebas

**`tests/logic/campaignPicker.test.ts`** (nuevo):
- `pickCampaign(10)` da exactamente los niveles 1–10, siempre con las mismas semillas.
- Todos sus niveles son válidos.
- Ningún nivel repite el patrón de los dos anteriores.
- No hay semillas repetidas.

**`tests/logic/progression.test.ts`:**
- `campaignSeeds` tiene exactamente los niveles 1–50. La prueba que valida cada semilla ya existe (`:115-121`).
- Los niveles 51–100 de `levelFor(n, campaignSeeds)` son válidos, tienen objetivos y no repiten ninguna semilla de la campaña ni entre sí.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] Hay 50 semillas: `grep -cE '^\s+[0-9]+: [0-9]+,' src/campaign.ts` da 50

---

## Fase 7: v1.0 (fin de la PR B)

### Resumen

La versión, el README, la especificación al día y la verificación final.

### Cambios necesarios

#### 1. Versión

**Archivo**: `package.json`: `"version": "1.0.0"`. `package-lock.json` se actualiza con `npm install --package-lock-only`.

#### 2. README

**Archivo**: `README.md` (nuevo, en español, corto)
- qué es Siega Total;
- el enlace al juego (`https://<usuario>.github.io/siega-total/`, con el usuario real de `git remote -v`);
- controles: arrastrar, WASD o flechas;
- desarrollo: `make install`, `make dev`, `make check`, `make test`, `make build`, `make size` y `?debug`;
- cómo curar la campaña: «Otra semilla», «Copiar semilla» y «Copiar campaña»;
- licencia MIT y enlace a `CREDITS.md`.

#### 3. Especificación

**Archivo**: `plan.md`
- `:116-117`: las briznas se colocan según la calidad activa. Cada una pesa `12 000 / briznas` para el crecimiento y las monedas, así que el nivel se juega igual en cualquier calidad. El contador siempre es exacto.
- `:129` y `:267`: `campana.ts` → `campaign.ts`. La campaña se preselecciona con «Copiar campaña» y se cura jugando.
- `:131`: después del nivel 50, cada nivel se genera de forma determinista con la primera semilla válida.
- `:138`: «Después: lavanda (10), rocas (13), frutas (16), zarza (19) y cactus (22), uno nuevo cada 3 niveles.»
- En «Patrones», los niveles de un solo tipo dibujan el patrón con hierba y arena.
- `:197`: `calidad` → `quality: 'auto' | 'high' | 'medium' | 'low'`, guardado v3.
- `:216-221`: la calidad se aplica en el siguiente intento. Se mide 3 s tras 0,5 s de calentamiento; por debajo de 50 fps baja y con 58 fps en 2 intentos seguidos sube, sin volver a un nivel del que bajó. Cada sesión empieza en Media.
- `:235`: los restos se quedan en el suelo en Alta, se desvanecen en Media y son menos en Baja.

#### 4. Etiqueta y release

No se hacen en esta fase. Tras fusionar la PR B, si el usuario lo pide:
- `git tag v1.0.0` sobre `main` y `git push origin v1.0.0`;
- `gh release create v1.0.0` con notas por hito (M0–M6).

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La carga inicial pesa menos de 2 MB comprimidos: `make size`
- [x] El panel sigue en un fragmento aparte: `make build && ! grep -q 'lil-gui' dist/assets/index-*.js`
- [x] La versión es 1.0.0: `node -p "require('./package.json').version"` da `1.0.0`

#### Verificación en Chrome (agente, `?debug`, GIF `m6-b-campana.gif`). Es el criterio de salida automatizable de M6:
- [x] Los niveles 1, 2 y 3 («Ir al nivel») se ven distintos: las capturas muestran patrones de hierba y arena diferentes.
- [x] «Copiar campaña» escribe en la consola 50 líneas iguales a `campaign.ts`.
- [x] Del nivel 1 al 5 con «Ganar» y «Siguiente», el monitor muestra la semilla de `campaign.ts` de cada nivel.
- [x] «Ir al nivel» 51 genera un nivel válido (rechazo «-») y se juega con «Ganar».
- [x] La calidad automática baja con «FPS simulados» a 30 (repetición rápida de la fase 4).
- [x] No hay errores en la consola.

#### Verificación manual (usuario):
- [ ] La campaña 1 → 50 se juega en el móvil en Auto. Las semillas que no gusten se cambian con «Otra semilla» / «Copiar semilla» (juicio de diseño).
- [ ] Sin caídas sostenidas por debajo de 50 fps en el móvil (rendimiento real).
- [ ] El README se lee bien en GitHub (juicio visual).

---

## Desviaciones durante la implementación (PR A)

- **Tolerancias de coma flotante:** `coinFloats` suelta las monedas enteras con una tolerancia de 1e-9 (100 pasos de 0,6 daban 59 en lugar de 60), y el monitor compara los fps con los umbrales con la misma tolerancia (50 fps exactos medían 49,999… y bajaban). Las dos las encontró bugmagnet.
- **Luz de los interruptores:** la fila «Calidad» usa la clase `settings-switch`, que dibujaba una luz gris de «apagado». La luz solo se dibuja ahora en las filas con `aria-pressed` (`src/ui/styles.css`).
- **`config.render`** se mantuvo hasta la fase 3, que es cuando `scene.ts` deja de leerlo.
- **GIF `m6-a-calidad.gif`:** no se exportó (hace falta permiso de descarga); las acciones se hicieron por JavaScript, así que la grabación solo tiene 4 fotogramas.
- **Criterio de la subida en Chrome:** el criterio original esperaba volver de `low` a `medium` con dos intentos a 60 fps, lo que contradecía la regla «nunca a un nivel del que se bajó». Manda la regla; el criterio se reescribió.
- **Arreglos tras validar M0–M6** (incluidos en la PR A):
  - los restos en el aire ya no caen en el intento nuevo: `BurstView.clear()` y `applyQuality` lo llama en cada intento (`tests/render/burst.test.ts`);
  - «Copiar semilla» copia el número y la semilla del nivel en juego, no del campo «Nivel», y avisa con un comentario si es el nivel de reserva (`rebuildsFromSeed` en `progression.ts`);
  - el panel `?debug` queda entre la pausa y los boosters, sin taparlos;
  - `keyboardDirection` usa un `Map` y la cuchilla resuelve las paredes después de los obstáculos, así que nunca entra en hierba dura al quedar encajada contra una roca. Las dos pruebas `- BUG` saltadas están activas;
  - la prueba de propiedades del generador comprueba que la cuchilla no choca con nada en la salida.
- **Comparación Alta/Baja:** «Ganar» en el nivel 1 da 0 monedas en ambas (todo es objetivo verde). Se comparó un mismo recorrido en el nivel 2: Baja 170 monedas y 170 de crecimiento, Alta 165 y 165,6 (diferencia por la posición aleatoria de las briznas en una franja estrecha).

## Desviaciones durante la implementación (PR B)

- **Base de la PR B:** la PR A no estaba fusionada, así que `feat/m6-campaign` se creó encima de `feat/m6-quality` y la PR B apunta a ella.
- **`pickCampaign` perezoso:** genera intentos hasta el primero que cumple, en vez de validar los 50 de cada nivel. Mismo resultado (comprobado contra `campaign.ts`); «Copiar campaña» pasa de 2,7 s a ~0,5 s.
- **Instantánea del nivel 10:** la prueba «sin cambios con 2 tipos o más» usa `toMatchSnapshot` (`tests/logic/__snapshots__/generator.test.ts.snap`), tomada antes de tocar el generador.
- **Pruebas de la campaña:** `campaignSeeds` no se compara con `pickCampaign()`, porque el usuario cambiará semillas a mano; solo se exige que estén los niveles 1–50 y que sean válidos.
- **`plan.md`:** además de lo previsto, se actualizaron el esquema del guardado (nombres en inglés), el árbol del repositorio, las reglas de código, el uso de boosters (no en la onda, la Brújula no se repite activa), el guardado al usar un booster y los pasos de la CI.
- **GIF `m6-b-campana.gif`:** no se grabó; la verificación se hizo por JavaScript sobre `make preview`.

## Estrategia de pruebas

### Pruebas unitarias (Vitest)

- **Peso por brizna:** el mismo nivel con densidades distintas da el mismo crecimiento y las mismas monedas, el peso se calcula bien y el redondeo de las monedas no ingresa dos veces.
- **Calidad:** veredicto de bajada, racha de subida, bloqueo de un nivel del que se bajó, descarte de frames largos y del calentamiento, intento corto sin veredicto, nivel fijo sin medición y ciclo del ajuste.
- **Guardado v3:** migración desde v2 y v1, saneado de `quality` y viaje de ida y vuelta.
- **Interfaz pura:** `settingRows` con la calidad.
- **Render puro:** `clippingOptions`.
- **Generador:** arena en los niveles de un solo tipo y ningún cambio en los niveles con más tipos.
- **Campaña:** `pickCampaign` determinista, válido, variado y sin repetir semillas. `campaignSeeds` completo. Modo infinito válido hasta el 100.

Las pruebas leen `config.ts` y `texts.ts` y no repiten números ni textos. Los niveles pequeños se hacen con `levelFromRows` (`tests/logic/levelFixtures.ts`).

### Prueba de arquitectura

Sin cambios en la regla. Cubre `logic/quality.ts` y `logic/campaignPicker.ts`, que no pueden importar `render/`, `ui/`, `debug/` ni `three`.

### Verificación en el navegador

El agente la hace con Claude in Chrome al final de las fases 4 y 7, sobre `make preview` con `?debug`. Usa:
- `window.__siegaQuality` y `window.__siega` para la calidad y la densidad;
- «FPS simulados» para forzar el veredicto;
- `localStorage` para el guardado;
- capturas para la sombra, los restos y los patrones.

Al usuario le queda lo que solo se juzga en el móvil real: la sensación, el rendimiento y la curación de la campaña.

## Rendimiento

- **Monitor:** O(1) por frame, sin memoria.
- **Peso:** una multiplicación más por paso.
- **Alta:**
  - 20 000 briznas en las mismas mallas instanciadas;
  - los restos del suelo son una sola malla de 3 000 instancias, que solo se actualizan al aterrizar cada trozo (como mucho 30 por frame);
  - resolución hasta 2×.
- **Baja:** 6 000 briznas, resolución 1×, sin sombra y un tercio de los restos.
- **Cambio de nivel:** la vista de restos se vuelve a crear solo cuando cambia la calidad, como mucho una vez por intento.
- **Validación de la campaña en las pruebas:** son ~100 niveles con hasta 50 intentos cada uno, comparable a la prueba actual de los niveles 1–60. Si `make test` se alarga mucho, la prueba del 51–100 baja a 51–75.
- **Carga inicial:** sin recursos nuevos. `make size` lo vigila.

## Notas de migración

- **Guardado v2 → v3:** `migrate` sube la versión y `sanitize` pone `quality: 'auto'`. Un jugador de M5 conserva todo y empieza en Auto (Media).
- **Cambios de API:**
  - `config.field.bladeCount` → `config.field.referenceBladeCount`; `config.render` desaparece; `config.effects.bladesPerClipping` y `maxClippingsPerFrame` pasan a `config.quality.levels`;
  - `levelFieldOptions(level, bladeCount)`;
  - `createGame(level, bonuses, bladeCount?)`, y `Game` gana `bladeWeight`;
  - `unbankedCoins(game)` en `economy.ts`;
  - `GameScene.setMaxPixelRatio` y `BladeView.setShadowVisible`;
  - `BurstOptions` gana `shrink` y `onExpire`;
  - `SettingsActions` gana `onCycleQuality`, `SettingRow.pressed` admite null, y `settingRows` y `render` reciben el nivel activo;
  - `createDebugPanel(getGame, actions, getQuality)` y `DebugPanel.simulatedFrameSeconds`;
  - `SaveData` v3 con `settings.quality`.
- **Niveles 1–4:** cambian de aspecto por la arena. Un jugador a mitad de esos niveles ve un campo distinto al recargar, pero su progreso (número de nivel) se mantiene.

## Referencias

- Especificación: `plan.md`. Densidad en `:116-117`, campaña en `:127-138`, ajustes y guardado en `:184,197`, calidad en `:209-223` y restos en `:235`.
- Planes anteriores:
  - `thoughts/shared/plans/2026-10-21-siega-total-m5-sonido-efectos-y-tutorial.md` (lo aplazado a M6, en las líneas 88, 90 y 118);
  - `thoughts/shared/plans/2026-10-21-siega-total-m4-economia-y-guardado.md` (reparto de hitos, en la línea 70);
  - `thoughts/shared/plans/2026-10-20-siega-total-m3-generador.md` (curación de la campaña, en la línea 64).
- Patrones que se reutilizan:
  - temporizador puro con estado: `src/ui/blockedNotice.ts`, `src/audio/cutRhythm.ts`;
  - migración un paso por versión: `src/logic/save.ts:54-58`;
  - pool de piezas instanciadas: `src/render/burst.ts`;
  - copia para el código desde el panel: `src/debug/panel.ts:159`;
  - búsqueda de la primera semilla válida: `src/logic/progression.ts:17-24`.
