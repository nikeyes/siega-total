# Siega Total M5: sonido, efectos y tutorial — Plan de implementación

## Resumen

M5 da respuesta sensorial a todo lo que ya pasa en la partida y enseña a jugar en la primera partida. Añade:

- **Sonido:** 8 sonidos Kenney CC0 en MP3, tocados con WebAudio:
  - corte, con un «zip» cuyo tono sube en las rachas;
  - subida de tamaño, rebote, fruta o cactus cortado;
  - victoria, derrota, toque de botón y monedas.
- **Vibración:** 10 ms al subir de tamaño y al rebotar, donde el navegador lo permita.
- **Efectos visuales:**
  - destello de subida de tamaño (anillo en el suelo, «¡Tamaño N!» y pulso de la píldora);
  - restos de hierba despedidos;
  - anillo de la onda de victoria;
  - confeti y lluvia de monedas en la Victoria.
- **Tutorial:** una mano animada enseña el joystick en la primera partida.
- **Ajustes:** interruptores de «Sonido» y «Vibración», también desde Pausa.
- **Guardado v2:** `settings` y `tutorialDone`, con migración desde v1.

## Análisis del estado actual

- M0–M4 están publicados. M4 entró en `main` con las PR #5, #6 y #7 (`b8a5df7`).
- El alcance sale de `plan.md:231-241` (efectos), `plan.md:174-184` (pantallas, tutorial y ajustes), `plan.md:186-205` (guardado), `plan.md:243-253` (recursos) y del reparto acordado en M4 (`thoughts/shared/plans/2026-10-21-siega-total-m4-economia-y-guardado.md:70`).
- **Eventos:** `StepResult` (`src/logic/game.ts:47-57`) da `cutIndices`, `cutObstacles`, `sizesGained`, `coins` y `blocked`.
  - `sizesGained` no lo lee nadie.
  - El booster Mejora sube `blade.size` fuera de `stepGame` (`src/logic/boosters.ts:25-27`), así que no aparece en `sizesGained`.
  - `blocked` es `true` en cada paso mientras se empuja. `createBlockedNotice` (`src/ui/blockedNotice.ts:9-26`) ya saca el flanco y lo repite cada `blockedMessageSeconds`.
  - `ready → playing` ocurre dentro de `stepGame` (`game.ts:109-112`) y nadie lo detecta.
- **Cambios de estado en el bucle:** `main.ts:301-315` guarda `statusBefore` y solo reacciona a `won`/`lost`. `playing → winWave` (`game.ts:132-136`) no se detecta. La onda dura ≤ ~1,7 s y no tiene visual propio. La capa de Victoria aparece en `won`.
- **Efectos existentes:**
  - `render/burst.ts`: un pool de 200 cubos con constantes fijas (`burst.ts:5-12`), solo para fruta y cactus (`main.ts:305-308`).
  - No hay restos de hierba: la brizna cortada solo baja en el shader (`src/render/grass.ts:35-39`).
  - La píldora «Tamaño N» cambia el texto sin animación (`src/ui/hud.ts:117-120,178-181`).
  - `restartAnimation` (`hud.ts:205-209`) repite una animación CSS.
- **Guardado:** `SaveData` v1 (`src/logic/save.ts:9-18`). `migrate` es la identidad y explica el paso a v2 (`save.ts:43-50`). `sanitize` (`save.ts:65-74`) solo copia los campos que lista y no hay saneado de booleanos.
- **Ajustes:** `src/ui/settings.ts` solo tiene «Borrar progreso» y no tiene `render()`. `src/ui/pause.ts` tiene «Continuar», «Reintentar» e «Inicio».
- **Capas:** `createLayer` (`src/ui/layer.ts:2-9`) para `pointerdown` con `stopPropagation`. El desbloqueo del audio tiene que escuchar en fase de captura sobre `window`.
- **HUD fuera de la partida:** `styles.css:258` oculta los elementos del HUD en `home`, `shop` y `settings`. Los elementos nuevos tienen que entrar en ese selector.
- **Recursos:** `public/` solo tiene `models/`. `scripts/check-size.mjs` suma todo `dist/` comprimido, salvo el panel. Hoy la carga inicial es de 215,6 KB, con un límite de 2 048 KB. `ffmpeg` está instalado (`/opt/homebrew/bin/ffmpeg`).
- **Patrón de carga asíncrona:** `loadObstacleModels` + `placeholderObstacleModels` (`src/render/obstacleModels.ts:28-100`, `main.ts:221-230`).
- **PRNG:** `createRandom(seed)` (mulberry32) en `src/logic/random.ts:2`.
- **Colores de hierba:** `GRASS_COLORS` en `src/render/grassColors.ts:4`.
- **Arquitectura:** `tests/architecture.test.ts:7-8` ya prohíbe importar `/audio`, `/ui`, `/render`, `/debug` y `three` desde `logic/`.
- **Pruebas:** Vitest en Node (`vite.config.ts:7`, `tests/**/*.test.ts`), sin DOM. En `ui/`, `render/` y `audio/` solo se prueban funciones puras.

## Estado final deseado

1. **Sonido:**
   - Al cortar suena un zip, como mucho uno cada 60 ms. En una racha, cada zip sube el tono un 3 %, hasta ×2. Tras 0,3 s sin cortar, vuelve al tono base.
   - Suenan también la subida de tamaño, el rebote (a la vez que «Necesitas más tamaño»), la fruta o el cactus cortado, el jingle de victoria al empezar la onda, el tintineo de monedas al abrir la Victoria, la derrota y un toque en cada botón.
   - Antes del primer toque o tecla no suena nada. Pulsar «Jugar» siempre desbloquea el audio.
   - Mientras los sonidos cargan, el juego sigue en silencio y sin errores.
2. **Vibración:** 10 ms al subir de tamaño y al rebotar, solo con `navigator.vibrate`.
3. **Ajustes:**
   - «Sonido: Sí/No» y «Vibración: Sí/No» encima de «Borrar progreso».
   - «Vibración» no aparece sin `navigator.vibrate`.
   - Cada toque guarda. Silenciar corta lo que esté sonando.
   - Se abren desde Inicio (⚙) y desde Pausa («Ajustes»). «Volver» regresa a la pantalla de origen.
4. **Subida de tamaño:** un anillo blanco crece desde la cuchilla y se desvanece en 0,4 s, sale «¡Tamaño N!» sobre la cuchilla y la píldora late. Con el booster Mejora también.
5. **Restos:** al cortar hierba saltan trozos planos del color de su tipo, que caen y desaparecen en 0,7 s. Como mucho 1 por cada 3 briznas y 30 por frame.
6. **Victoria:**
   - durante la onda, un anillo en el suelo sigue a `winWave.radius`;
   - al abrir la capa de Victoria caen ~60 papelitos y ~20 monedas durante unos 2 s, sin bloquear los botones.
7. **Tutorial:**
   - Con `tutorialDone` en false, al pulsar «Jugar» aparece una mano que pulsa y arrastra en círculo, con «Arrastra para mover» y, solo con `(pointer: fine)`, «o usa WASD / flechas».
   - Desaparece con el primer movimiento y en ese momento se guarda `tutorialDone: true`.
   - La página sigue abriendo en Inicio.
8. **Guardado v2:** `settings: { sound, vibration }` y `tutorialDone`. Un guardado v1 migra con el tutorial hecho y los ajustes activados.
9. **Panel (`?debug`):**
   - carpetas `audio`, `vibration` y `effects`;
   - botón «Reiniciar tutorial»;
   - registro de disparos en `window.__siegaFeedback`.
10. **Comprobación:** `make check test build size` pasa, con los sonidos dentro de los 2 MB.

### Decisiones (resueltas con grill-me)

| Tema | Decisión |
| --- | --- |
| Origen de los sonidos | Archivos Kenney CC0, no síntesis. |
| Formato y peso | MP3 mono de 64 kbps, convertidos una vez con `ffmpeg` y guardados en `public/sounds/`. `check-size` los sigue contando, sin excepción. |
| Sonidos | 8: `cut`, `sizeUp`, `bounce`, `obstacleCut`, `win`, `lose`, `tap` y `coins`. El agente elige los archivos y el usuario los juzga de oído. |
| Música | Ninguna en la v1.0. Se cierra la pregunta abierta de `plan.md`. |
| Zip | WebAudio, con un `AudioContext` reanudado en el primer `pointerdown`/`keydown`. Función pura de ritmo: como mucho 1 zip cada 60 ms, +3 % de tono por zip seguido, tope ×2 y vuelta al tono base tras 0,3 s sin cortes. Valores en `config.audio`. |
| Eventos | `logic/feedback.ts` puro: `createFeedbackTracker().step(game, result)` → eventos `started`, `cut`, `obstacleCut`, `sizeUp`, `winWave`, `won` y `lost`. `sizeUp` compara `blade.size` entre frames, así que también cuenta el booster Mejora. El rebote sigue el ritmo de `blockedNotice`. |
| Destello de tamaño | Anillo blanco en el suelo (0,4 s), «¡Tamaño N!» flotante y pulso de la píldora. Varias subidas en un paso dan un solo efecto con el tamaño final. |
| Victoria | Anillo en el suelo que sigue a la onda, con el jingle al empezarla. Confeti y monedas en HTML y CSS al abrir la capa de Victoria, generados por una función pura con PRNG, con el tintineo de monedas. |
| Restos | Sí, sin persistencia: 400 piezas planas, 1 por cada 3 briznas, tope de 30 por frame y 0,7 s de vida. La persistencia según la calidad queda para M6. |
| Arranque y tutorial | La página siempre abre en Inicio. Con `tutorialDone` en false, la mano sale al pulsar «Jugar». Desaparece con el primer movimiento, que guarda `tutorialDone: true`. «Borrar progreso» la reactiva. `plan.md:183` se actualiza. |
| Guardado v2 | v1 + `settings: { sound, vibration }` + `tutorialDone`. Sin calidad, que llega con v3 en M6. Desde v1: `tutorialDone: true` y los ajustes en true. Lo que no sea boolean toma su valor por defecto. |
| Ajustes | Dos interruptores con `aria-pressed`, «Sí»/«No». «Vibración» se oculta sin `navigator.vibrate`. Se abre desde Inicio y desde Pausa, y «Volver» regresa al origen. |
| Entregas | Un plan y dos PR desde `main`. **PR A** (fases 1–3): guardado v2, eventos, sonido, vibración y ajustes. **PR B** (fases 4–6): efectos visuales y tutorial. |
| Verificación | Con `?debug`, el audio y la vibración apuntan cada disparo en `window.__siegaFeedback`. El panel gana las carpetas `audio`, `vibration` y `effects` y el botón «Reiniciar tutorial». El agente verifica en Chrome. Al usuario le quedan los sonidos de oído, la vibración en un Android real, la sensación de los efectos y los fps en el móvil. |

### Decisiones de detalle (tomadas al escribir el plan)

- **Zip solo al jugar:** los eventos `cut` y `obstacleCut` solo salen de pasos jugados (estado anterior `ready` o `playing`). Los cortes de la onda no suenan uno a uno, porque ahí ya suena el jingle. Los restos y las explosiones de fruta de la onda sí se ven.
- **Desbloqueo del audio:** `window.addEventListener('pointerdown' | 'keydown', unlock, { capture: true })`, porque las capas paran la propagación de `pointerdown`. `unlock` llama a `context.resume()` y se quita al conseguirlo.
- **Toque de botón:** un solo oyente `click` en el contenedor `#app` que suena con `event.target.closest('button')`. Así no se toca `layerButton` ni cada pantalla.
- **Silenciar:** `setEnabled(false)` pone la ganancia maestra a 0 y para las fuentes activas. Con el sonido apagado, `play` no hace nada y no apunta en el registro.
- **Registro de depuración:** `window.__siegaFeedback` es un array de `{ kind: 'sound' | 'vibration'; name: string; rate?: number; at: number }`. Solo existe con `?debug` y guarda los últimos 200. Solo apunta lo que de verdad se envía (sonido activado, contexto en marcha y búfer cargado; vibración activada y soportada).
- **Anillo de tamaño en movimiento:** el anillo sigue a la cuchilla mientras dura, para no quedarse atrás al avanzar.
- **Semilla del confeti:** `game.level.seed`. El confeti de un nivel es siempre igual, lo que facilita las pruebas.

### Hallazgos clave

- `plan.md:231-241`: tabla de efectos. «Máximo 1 cada 60 ms», vibración de 10 ms «no en iPhone» y desactivable.
- `plan.md:183`: «el nivel 1 empieza directo». Cambia a «al pulsar Jugar por primera vez».
- `src/logic/save.ts:43-50`: el comentario de `migrate` ya describe el paso v1 → v2.
- `src/logic/game.ts:47-57,108-142`: `StepResult` y las transiciones de estado.
- `src/ui/blockedNotice.ts:9-26`: el patrón de temporizador puro que siguen el ritmo del zip y el tracker.
- `src/render/obstacleModels.ts:28-100`: el patrón de carga asíncrona con alternativa.
- `src/ui/layer.ts:6`: las capas paran `pointerdown`, así que el desbloqueo del audio escucha en captura.

## Qué NO hacemos

- Música (no hay en la v1.0).
- Calidad automática, el ajuste de calidad y la persistencia de los restos según la calidad (M6).
- Restos persistentes en el suelo.
- Sonidos sintetizados o un generador tipo jsfxr.
- Volumen por sonido en Ajustes. Solo hay un interruptor; los volúmenes se ajustan en `config.audio`.
- Saltar Inicio en la primera partida.
- Tutorial de los boosters, de la hierba objetivo o del «Necesitas más tamaño». La curva de niveles ya los enseña (`plan.md:133-138`).
- Brillo de la fruta y el cactus objetivo, que sigue fuera desde M3.
- Botón de silencio en el HUD.

## Enfoque de implementación

Mismo orden que en M3 y M4: primero la lógica pura con TDD, después el navegador. Cada fase deja `make check test build` en verde.

- **PR A, `feat/m5-feedback-a`** (fases 1–3): guardado v2, eventos, sonido, vibración y ajustes. Al terminar, el juego suena y vibra y se puede silenciar.
- **PR B, `feat/m5-feedback-b`** (fases 4–6): restos, anillos, destello, confeti, monedas y tutorial. Se crea desde `main` después de fusionar la A.

### Verificación en el navegador (fases 3 y 6)

La hace el agente con Claude in Chrome, como en M4:

- **Preparación:** `make build && make preview` (`http://localhost:4173/siega-total/?debug`). Pestaña nueva con la ventana lo más cerca posible de 390 × 844.
- **Herramientas:**
  - `javascript_tool` para leer `window.__siega`, `window.__siegaFeedback`, `localStorage['siega-total']` y el DOM;
  - `find`/`computer` para pulsar botones;
  - capturas de pantalla.
- Para mover la cuchilla se mantiene D con eventos `keydown`/`keyup`, como en M4.
- **Prohibido:** no se lanzan diálogos del navegador.
- **Grabación:** cada verificación se graba en un GIF (`m5-a-sonido.gif`, `m5-b-efectos.gif`). Solo se exporta si el usuario da permiso para la descarga.

---

## Fase 1: Guardado v2 y eventos de efectos

### Resumen

El guardado pasa a v2 con los ajustes y el tutorial, y un módulo puro traduce cada paso de la partida en eventos de efectos.

### Cambios necesarios

#### 1. Guardado v2

**Archivo**: `src/logic/save.ts`

```ts
export interface Settings {
  sound: boolean;
  vibration: boolean;
}

export interface SaveData {
  version: 2;
  level: number;
  coins: number;
  upgrades: Record<UpgradeKind, number>;
  boosters: Record<BoosterKind, number>;
  settings: Settings;
  /** True once the player has made the first move with the hand hint on screen. */
  tutorialDone: boolean;
}

export const SAVE_VERSION = 2;
```

- `defaultSave()`: `settings: { sound: true, vibration: true }` y `tutorialDone: false`.
- `migrate`:
  ```ts
  /** Brings older saves up to SAVE_VERSION, one version at a time. */
  function migrate(data: { version: number }): unknown {
    // A version 1 save belongs to someone who has already played, so the hand hint is not shown again.
    if (data.version === 1) data = { ...data, version: 2, tutorialDone: true };
    return data;
  }
  ```
  Los ajustes de un v1 faltan y `sanitize` les da los valores por defecto (true).
- `sanitize` gana:
  - `settings: sanitizeFlags(data.settings, defaults.settings)`: un booleano por cada clave de los valores por defecto. Las claves desconocidas se descartan.
  - `tutorialDone: booleanOr(data.tutorialDone, defaults.tutorialDone)`.
  - `function booleanOr(value: unknown, fallback: boolean): boolean`: `typeof value === 'boolean' ? value : fallback`.

#### 2. Eventos de efectos

**Archivo**: `src/logic/feedback.ts` (nuevo)

```ts
export type FeedbackEvent =
  | { kind: 'started' }                 // ready → playing: the first move
  | { kind: 'cut' }                     // blades cut by the blade in this step
  | { kind: 'obstacleCut' }             // a fruit or cactus cut by the blade in this step
  | { kind: 'sizeUp'; size: number }    // the blade grew, by cutting or by the booster
  | { kind: 'winWave' }                 // the last target fell; the wave starts
  | { kind: 'won' }
  | { kind: 'lost' };

export interface FeedbackTracker {
  /** Events of the step that just ran; call it once per frame, after stepGame. */
  step(game: Game, result: StepResult): FeedbackEvent[];
}

export function createFeedbackTracker(): FeedbackTracker;
```

- El tracker recuerda la partida, su estado y el tamaño de la cuchilla del frame anterior.
- Si `game` es otra partida (otro objeto), se reinicia sin emitir eventos. Así `playLevel`/`restart` no dan un `sizeUp` ni un `won` falso.
- **Estado anterior jugable** (`ready` o `playing`):
  - `cut` si `result.cutIndices.length > 0`;
  - `obstacleCut` si alguna pieza de `result.cutObstacles` no es una roca.
- **`sizeUp`** si `game.blade.size > tamaño anterior`, con el tamaño nuevo. Funciona en cualquier estado, así que el booster Mejora usado entre frames también cuenta.
- **Transiciones:** `ready → playing` da `started`, `→ winWave` da `winWave`, `→ won` da `won` y `→ lost` da `lost`. `lost → playing` (Reloj) no da ningún evento.
- El orden de la lista es fijo: `started`, `cut`, `obstacleCut`, `sizeUp`, `winWave`, `won` y `lost`.

### Pruebas

**`tests/logic/save.test.ts`**:
- `progressedSave()` pasa a v2, con `settings: { sound: false, vibration: true }` y `tutorialDone: true`. El viaje de ida y vuelta lo conserva.
- `defaultSave()` tiene los ajustes en true y `tutorialDone: false`.
- Un guardado v1 (sin `settings` ni `tutorialDone`) se carga con `version: 2`, `tutorialDone: true`, los ajustes en true y el resto de campos intactos.
- Con `settings.sound: 'no'`, `settings: 5`, `settings: []` o `tutorialDone: 1`, ese campo toma su valor por defecto y el resto se conserva.
- Una clave desconocida en `settings` se descarta.
- La prueba «acepta una versión anterior» con `{ version: 0 }` se sustituye por la de la migración desde v1.

**`tests/logic/feedback.test.ts`** (niveles pequeños con `levelFromRows`):
- El primer paso con dirección da `started`. Los siguientes no.
- Cortar hierba al jugar da `cut`. Un paso sin cortes, no.
- Cortar una fresa da `obstacleCut`.
- Llenar la barra da `sizeUp` con el tamaño nuevo. `applyBooster(game, 'upgrade')` entre dos pasos da `sizeUp` en el siguiente.
- Cortar el último objetivo da `winWave`. Los pasos de la onda cortan sin dar `cut`. Al acabar, da `won` una sola vez.
- Agotar el tiempo da `lost`. Continuar con el Reloj y volver a jugar no da `started`.
- Pasar otra partida (como tras `restart`) con más o menos tamaño no da eventos.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Las pruebas de guardado, eventos y arquitectura pasan: `make test`
- [x] La compilación termina: `make build`

---

## Fase 2: Sonido y vibración

### Resumen

Los 8 sonidos Kenney en MP3, un reproductor WebAudio que nunca falla, el ritmo puro del zip, la vibración y su conexión con los eventos.

### Cambios necesarios

#### 1. Recursos

- Se descargan de kenney.nl los paquetes **Interface Sounds**, **Impact Sounds**, **Music Jingles** y **RPG Audio** (este último para las monedas). Si algún sonido encaja mejor en otro paquete CC0 de Kenney, se usa ese.
- El agente elige un archivo por sonido: `cut` (corto y seco), `sizeUp` (ascendente), `bounce` (sordo), `obstacleCut` (explosión o «pop»), `win` (jingle corto), `lose` (jingle descendente), `tap` (clic suave) y `coins` (tintineo).
- Cada uno se convierte con:
  ```bash
  ffmpeg -i <origen>.ogg -ac 1 -ar 44100 -b:a 64k public/sounds/<nombre>.mp3
  ```
- Los ocho se guardan en `public/sounds/` y pesan menos de 150 KB en total.
- **`CREDITS.md`:** una entrada por paquete usado, con el mismo formato que las de modelos: autor, enlace, CC0 1.0 y «Archivos usados: origen → `public/sounds/…`».

#### 2. Configuración

**Archivo**: `src/config.ts`

```ts
audio: {
  /** The zip plays at most once every this many seconds while the blade cuts. */
  cutMinIntervalSeconds: 0.06,
  /** Each zip in a streak plays this much higher than the one before… */
  cutPitchStep: 0.03,
  /** …up to this playback rate. */
  cutMaxPitch: 2,
  /** A pause in cutting this long ends the streak and the pitch goes back to 1. */
  cutStreakResetSeconds: 0.3,
  volume: { cut: 0.4, sizeUp: 0.8, bounce: 0.8, obstacleCut: 0.7, win: 0.8, lose: 0.8, tap: 0.5, coins: 0.7 },
},
vibration: {
  milliseconds: 10,
},
```

#### 3. Ritmo del zip

**Archivo**: `src/audio/cutRhythm.ts` (nuevo, puro, como `blockedNotice.ts`)

```ts
export interface CutRhythm {
  /** The playback rate of the zip to play in this step, or null when none plays. */
  step(cut: boolean, dt: number): number | null;
}
export function createCutRhythm(): CutRhythm;
```

- Solo con `cut` puede sonar un zip, y como mucho uno cada `cutMinIntervalSeconds`. El primero de una racha sale al momento.
- **Tono:** el primer zip de una racha suena a 1. Cada uno de los siguientes suma `cutPitchStep`, hasta `cutMaxPitch`.
- **Fin de la racha:** `cutStreakResetSeconds` seguidos sin `cut`.

#### 4. Reproductor

**Archivo**: `src/audio/sounds.ts` (nuevo)

```ts
export type SoundName = keyof typeof config.audio.volume;

export interface SoundPlayer {
  /** Plays `name` at `rate`; silent while locked, muted or still loading. */
  play(name: SoundName, rate?: number): void;
  /** Muting also stops the sounds that are playing. */
  setEnabled(enabled: boolean): void;
}

export function createSoundPlayer(baseUrl: string, onPlayed?: (name: SoundName, rate: number) => void): SoundPlayer;
```

- **Contexto:** crea un `AudioContext` al arrancar; puede empezar suspendido. Si el navegador no tiene `AudioContext`, el reproductor no hace nada.
- **Desbloqueo:** `pointerdown` y `keydown` en `window`, en fase de captura, llaman a `context.resume()`. Los oyentes se quitan cuando `state === 'running'`.
- **Carga:** cada archivo se carga con `fetch(baseUrl + name + '.mp3')` → `arrayBuffer` → `decodeAudioData`. Si uno falla, `console.warn` y ese sonido queda mudo; los demás siguen.
- **`play`:** solo si está activado, el contexto está en marcha y el búfer cargado. Crea un `AudioBufferSourceNode` con `playbackRate`, una `GainNode` con `config.audio.volume[name]` y la ganancia maestra. Apunta la fuente en un conjunto para poder pararla, la quita en `onended` y llama a `onPlayed`.
- **`setEnabled(false)`:** para las fuentes activas y deja de tocar.

#### 5. Vibración

**Archivo**: `src/audio/vibration.ts` (nuevo)

```ts
export function canVibrate(): boolean;   // typeof navigator.vibrate === 'function'
export interface Vibration {
  pulse(): void;                         // navigator.vibrate(config.vibration.milliseconds) when enabled and supported
  setEnabled(enabled: boolean): void;
}
export function createVibration(onPulsed?: () => void): Vibration;
```

#### 6. Bucle principal

**Archivo**: `src/main.ts`
- Se crean `soundPlayer = createSoundPlayer(import.meta.env.BASE_URL + 'sounds/', logSound)`, `vibration = createVibration(logVibration)`, `cutRhythm = createCutRhythm()` y `feedback = createFeedbackTracker()`.
- Después de `readSave()`: `soundPlayer.setEnabled(save.settings.sound)` y `vibration.setEnabled(save.settings.vibration)`. `clearProgress` hace lo mismo con los valores por defecto.
- En el bucle, después de `stepGame`:
  ```ts
  const events = feedback.step(game, result);
  const zipRate = cutRhythm.step(events.some((event) => event.kind === 'cut'), dt);
  if (zipRate !== null) soundPlayer.play('cut', zipRate);
  for (const event of events) playFeedback(event);
  ```
- `playFeedback(event)`, una función local de `main.ts`:

  | Evento | Efecto |
  | --- | --- |
  | `obstacleCut` | `play('obstacleCut')` |
  | `sizeUp` | `play('sizeUp')` y `vibration.pulse()` |
  | `winWave` | `play('win')` |
  | `won` | `play('coins')` |
  | `lost` | `play('lose')` |
  | `started` | nada en esta fase (la fase 6 lo usa) |

- **Rebote:** el resultado de `blockedNotice.step(result.blocked, dt)` va a una constante `showBlocked`. Si es `true`, `play('bounce')` y `vibration.pulse()`. El HUD recibe la misma constante.
- **Toques:** `container.addEventListener('click', (event) => { if ((event.target as Element).closest('button')) soundPlayer.play('tap'); })`.
- **Depuración:** con `?debug`, `logSound` y `logVibration` añaden una entrada a `window.__siegaFeedback` (array de los últimos 200). Sin `?debug`, no se pasan.

### Pruebas

**`tests/audio/cutRhythm.test.ts`**:
- Sin cortes no sale nada.
- El primer corte sale con 1.
- Con cortes en cada paso de 16 ms, sale como mucho uno cada `cutMinIntervalSeconds`.
- Cada zip seguido sube `cutPitchStep` y nunca pasa de `cutMaxPitch`.
- Tras `cutStreakResetSeconds` sin cortes, el siguiente vuelve a 1. Una pausa más corta mantiene la racha.

**`tests/architecture.test.ts`:** sin cambios. Ya cubre que `logic/feedback.ts` no importe `audio/`.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La carga inicial, con los sonidos, pesa menos de 2 MB comprimidos: `make size`
- [x] Hay 8 sonidos: `ls public/sounds/*.mp3 | wc -l` da 8
- [x] `CREDITS.md` cita cada paquete de sonidos usado: `grep -c 'public/sounds/' CREDITS.md` ≥ 1

---

## Fase 3: Ajustes de sonido y vibración (fin de la PR A)

### Resumen

Los interruptores en Ajustes, el acceso desde Pausa y las carpetas del panel.

### Cambios necesarios

#### 1. Ajustes

**Archivo**: `src/ui/settings.ts`

```ts
export interface SettingsActions {
  onToggleSound(): void;
  onToggleVibration(): void;
  onClearProgress(): void;
  onBack(): void;
}

export interface SettingRow {
  key: keyof Settings;
  label: string;        // «Sonido» / «Vibración»
  valueLabel: string;   // «Sí» / «No»
  pressed: boolean;
}

/** The switches to show; vibration is left out where the browser cannot vibrate. */
export function settingRows(save: SaveData, vibrationSupported: boolean): SettingRow[];

export function createSettingsScreen(
  container: HTMLElement,
  actions: SettingsActions,
  vibrationSupported: boolean,
): { readonly layer: HTMLElement; render(save: SaveData): void };
```

- Cada fila es un `button.settings-switch` con `aria-pressed` y el texto «Sonido · Sí». Va encima de «Borrar progreso».
- `render` actualiza el texto y `aria-pressed`.
- Estilos en `styles.css`, coherentes con `layer-button-secondary`, con un indicador para el estado «Sí».

#### 2. Pausa

**Archivo**: `src/ui/pause.ts`: `PauseActions` gana `onSettings`. Botón «Ajustes» (secundario) entre «Reintentar» e «Inicio».

#### 3. Bucle principal

**Archivo**: `src/main.ts`
- `let settingsReturnsTo: 'home' | 'paused' = 'home'` y una función `openSettings(from)`, como `openShop`.
- Inicio ⚙ → `openSettings('home')`. Pausa «Ajustes» → `openSettings('paused')`. «Volver» → `showScreen(settingsReturnsTo)`.
- `onToggleSound`: invierte `save.settings.sound`, llama a `writeSave` y `soundPlayer.setEnabled`, y redibuja.
- `onToggleVibration`: lo mismo con la vibración.
- `renderSave()` también llama a `settingsScreen.render(save)`.
- `createSettingsScreen(container, …, canVibrate())`.

#### 4. Textos

**Archivo**: `src/texts.ts`
- `settings.sound: 'Sonido'`, `settings.vibration: 'Vibración'`, `settings.on: 'Sí'` y `settings.off: 'No'`.
- `pause.settings: 'Ajustes'`.
- `debug.resetTutorial: 'Reiniciar tutorial'` llega en la fase 6.

#### 5. Panel

**Archivo**: `src/debug/panel.ts`: `addNumberFolder` para `config.audio` y `config.vibration`.

### Pruebas

**`tests/ui/settings.test.ts`** (nuevo):
- Con vibración soportada hay dos filas; sin ella, solo «Sonido».
- `valueLabel` y `pressed` siguen a `save.settings`.
- Los textos salen de `texts.settings`.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La carga inicial pesa menos de 2 MB comprimidos: `make size`
- [x] El panel sigue en un fragmento aparte: `make build && ! grep -q 'lil-gui' dist/assets/index-*.js`

#### Verificación en Chrome (agente, `?debug`, GIF `m5-a-sonido.gif`):
- [x] Antes de tocar nada, `window.__siegaFeedback` está vacío.
- [x] Al pulsar «Jugar» aparece `{ kind: 'sound', name: 'tap' }`.
- [x] Al mantener D sobre la hierba aparecen entradas `cut`, separadas como mínimo 60 ms, con `rate` creciente hasta como mucho 2.
- [x] Al chocar con una roca o una hierba más alta aparecen a la vez `bounce` y el texto «Necesitas más tamaño».
- [x] El booster Mejora deja una entrada `sizeUp`.
- [x] «Ganar» deja `win` y después `coins`. «Tiempo 3 s» deja `lose`.
- [x] Ajustes → «Sonido: No»: `localStorage` tiene `settings.sound: false` y cortar ya no añade entradas de sonido. Tras recargar sigue en «No».
- [x] Pausa → «Ajustes» → «Volver» regresa a Pausa.
- [x] En Chrome de escritorio (sin `navigator.vibrate` según la plataforma), «Vibración» aparece u oculta según `canVibrate()`, y las entradas `vibration` coinciden con ese soporte.
- [x] Con un guardado v1 de M4 en `localStorage` y recargando: Inicio muestra el mismo nivel y saldo, y el guardado pasa a `version: 2` con `tutorialDone: true` al siguiente `writeSave`.
- [x] No hay errores en la consola (`read_console_messages`).

#### Verificación manual (usuario):
- [ ] Los 8 sonidos encajan con el estilo y el volumen está equilibrado (de oído).
- [ ] El zip con la racha resulta satisfactorio y no cansa (sensación).
- [ ] La vibración se nota en un Android real y no en iPhone (dispositivo real).

---

## Fase 4: Efectos en la escena

### Resumen

Restos de hierba y un anillo en el suelo para la subida de tamaño y la onda de victoria.

### Cambios necesarios

#### 1. Configuración

**Archivo**: `src/config.ts`

```ts
effects: {
  /** One clipping flies for every this many blades cut… */
  bladesPerClipping: 3,
  /** …and no more than this many in one frame. */
  maxClippingsPerFrame: 30,
  clippingSeconds: 0.7,
  sizeUpRingSeconds: 0.4,
  /** The size-up ring grows from the blade's radius to this many times it. */
  sizeUpRingGrowth: 1.8,
  confettiPieces: 60,
  coinRainPieces: 20,
  celebrationSeconds: 2,
},
```

#### 2. Pool de piezas configurable

**Archivo**: `src/render/burst.ts`
- `createBurstView(scene, options?: Partial<BurstOptions>)`. `BurstOptions` reúne las constantes de hoy: `poolSize`, `geometry` (`'cube' | 'flat'`), `pieceSize`, `lifetimeSeconds`, `minUpSpeed`, `maxUpSpeed`, `maxSideSpeed` y `spinSpeed`. Los valores por defecto son los actuales, así que la explosión de fruta no cambia.
- `'flat'` usa una `PlaneGeometry` alargada con `side: DoubleSide`.
- `lifetimeSeconds` se lee al crear. Los restos pasan `config.effects.clippingSeconds`.

#### 3. Restos de hierba

**Archivo**: `src/render/clippings.ts` (nuevo, puro)

```ts
/** Which cut blades throw a clipping: one in every `bladesPerClipping`, at most `max`, spread over the list. */
export function clippingBlades(cutIndices: readonly number[], bladesPerClipping: number, max: number): number[];
```

**Archivo**: `src/main.ts`
- `clippings = createBurstView(scene, { poolSize: 400, geometry: 'flat', pieceSize: 0.14, lifetimeSeconds: config.effects.clippingSeconds, minUpSpeed: 1.5, maxUpSpeed: 3, maxSideSpeed: 1.8 })`.
- Por cada índice de `clippingBlades(result.cutIndices, …)`, `clippings.spawn(field.positionsX[i], field.positionsZ[i], GRASS_COLORS[GRASS_TYPE_ORDER[field.types[i]]].tip, 1)`.
- Vale también en la onda, porque el tope por frame limita el coste.
- `clippings.update(dt)` junto a `burst.update(dt)`.

#### 4. Anillo en el suelo

**Archivo**: `src/render/groundRing.ts` (nuevo)

```ts
export interface GroundRing {
  /** Draws the ring at (x, z) with `radius` and `opacity`; opacity 0 hides it. */
  show(x: number, z: number, radius: number, opacity: number): void;
  dispose(): void;
}
export function createGroundRing(scene: Scene, color: number): GroundRing;
```

- Es una `RingGeometry` fina de radio 1, escalada al radio, con `MeshBasicMaterial` transparente, `depthTest: false`, `renderOrder` alto e y = 0,03, como la flecha de la brújula.

**Archivo**: `src/render/ringMath.ts` (nuevo, puro)

```ts
/** Radius and opacity of the size-up ring `age` seconds after it started, or null once it is over. */
export function sizeUpRing(age: number, bladeRadius: number): { radius: number; opacity: number } | null;
```

- El radio va de `bladeRadius` a `bladeRadius × sizeUpRingGrowth`, con salida suave. La opacidad baja de 1 a 0 en `sizeUpRingSeconds`.

**Archivo**: `src/main.ts`
- **Anillo de tamaño:** `sizeUpRingView = createGroundRing(scene, 0xffffff)` y `let sizeUpAge = Infinity`. En `sizeUp`, `sizeUpAge = 0`. Cada frame se suma `dt` y, mientras `sizeUpRing` no sea null, se dibuja en la cuchilla. Si no, opacidad 0.
- **Anillo de onda:** `waveRingView = createGroundRing(scene, 0xfff3b0)`. Con `game.status === 'winWave'`, `show(wave.x, wave.z, wave.radius, 0.8)`; si no, opacidad 0.
- **Reinicio:** `playLevel` pone `sizeUpAge = Infinity`.

### Pruebas

- **`tests/render/clippings.test.ts`:**
  - 9 cortes con 3 por pieza dan 3;
  - 300 cortes con un tope de 30 dan 30, repartidos por toda la lista;
  - 2 cortes dan 1, para que hasta un corte suelto se vea;
  - 0 cortes dan 0.
- **`tests/render/ringMath.test.ts`:**
  - en `age` 0, radio = `bladeRadius` y opacidad 1;
  - el radio crece y la opacidad baja sin saltos;
  - en `sizeUpRingSeconds`, devuelve null.
- **`tests/render/burstMotion.test.ts`:** sin cambios.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La compilación termina: `make build`

---

## Fase 5: Efectos en el HUD y la Victoria

### Resumen

«¡Tamaño N!» con el pulso de la píldora, y confeti y lluvia de monedas al abrir la Victoria.

### Cambios necesarios

#### 1. Subida de tamaño en el HUD

**Archivo**: `src/ui/hud.ts`
- `HudState` gana `sizeUp: number | null`: el tamaño nuevo en el frame de la subida y null en los demás.
- `HudDisplay` gana `sizeUpLabel: string | null`, con el formato `texts.hud.sizeUp` («¡Tamaño N!»).
- Un elemento nuevo, `.hud-size-up`, va 90 px por encima de la cuchilla, más arriba que «Necesitas más tamaño». Con `sizeUpLabel`, cambia el texto y llama a `restartAnimation` (sube, crece y se desvanece en 0,8 s).
- La píldora `.hud-size` recibe la clase `pulse` con `restartAnimation` (escala 1 → 1,25 → 1 y brillo, 0,4 s).
- `main.ts` pasa `sizeUp` desde el evento `sizeUp` del frame.
- `styles.css`: animaciones `hud-size-up-rise` y `hud-size-pulse`. `.hud-size-up` entra en el selector de `styles.css:258`.

#### 2. Confeti y monedas

**Archivo**: `src/ui/celebration.ts` (nuevo)

```ts
export interface CelebrationPiece {
  kind: 'confetti' | 'coin';
  /** Horizontal start, 0–100 % of the width. */
  leftPercent: number;
  delaySeconds: number;
  fallSeconds: number;
  /** Sideways drift while falling, in % of the width. */
  driftPercent: number;
  spinDegrees: number;
  /** Confetti color; coins use the coin icon. */
  color: string;
}

/** The pieces of one celebration, the same for the same seed. */
export function celebrationPieces(seed: number): CelebrationPiece[];

export interface Celebration {
  /** Drops the pieces over the screen; they remove themselves when they land. */
  play(seed: number): void;
  clear(): void;
}
export function createCelebration(container: HTMLElement): Celebration;
```

- `celebrationPieces` usa `createRandom(seed)` de `logic/random.ts` y da `config.effects.confettiPieces` papelitos y `coinRainPieces` monedas.
  - Cada pieza empieza antes de `celebrationSeconds`, con `delaySeconds + fallSeconds` ≤ `celebrationSeconds + 1`.
  - Los colores salen de una paleta fija y saturada en `celebration.ts`: los de la hierba, el amarillo de la moneda y un rojo.
- **DOM:** `div.celebration` a pantalla completa, con `pointer-events: none` y `z-index` por encima de las capas.
  - Cada pieza es un `div` con variables CSS (`--left`, `--delay`, `--fall`, `--drift`, `--spin`, `--color`). Las monedas llevan `coinIconSvg`.
  - La animación `celebration-fall` va de arriba (−10 %) hasta abajo (110 %) del alto.
  - `play` borra las piezas anteriores y programa su propio borrado tras `celebrationSeconds + 1` s.
  - `clear()` vacía el contenedor. Se llama desde `showScreen` cuando la pantalla nueva no es `'result'`.
- **`main.ts`:** en el evento `won`, `celebration.play(game.level.seed)` junto al sonido `coins`.

#### 3. Textos

**Archivo**: `src/texts.ts`: `hud.sizeUp: '¡Tamaño {size}!'`, formateado en `hudDisplay`.

### Pruebas

- **`tests/ui/hud.test.ts`:** `sizeUpLabel` es «¡Tamaño 3!» con `sizeUp: 3` y null sin subida.
- **`tests/ui/celebration.test.ts`:**
  - da `confettiPieces` papelitos y `coinRainPieces` monedas;
  - la misma semilla da las mismas piezas y otra semilla da otras;
  - `leftPercent` está en 0–100;
  - todas terminan antes de `celebrationSeconds + 1`.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La compilación termina: `make build`

---

## Fase 6: Tutorial y criterio de salida (fin de la PR B)

### Resumen

La mano de la primera partida, el botón del panel para repetirla y la actualización de la especificación.

### Cambios necesarios

#### 1. Mano del tutorial

**Archivo**: `src/ui/icons.ts`: `handIconSvg()`, una mano con el índice extendido, en colores planos con contorno, como los demás iconos.

**Archivo**: `src/ui/tutorial.ts` (nuevo)

```ts
export interface TutorialHint {
  show(): void;
  hide(): void;
}
/** The hand that shows how to drag, with the keys hint for mouse users; it never takes touches. */
export function createTutorialHint(container: HTMLElement): TutorialHint;
```

- `div.tutorial` con `pointer-events: none`, centrado en la mitad inferior. Lleva:
  - la mano, con la animación `tutorial-drag` en bucle de 2,4 s: baja (toque), dibuja un círculo de ~60 px y se levanta;
  - un círculo semitransparente bajo el dedo, como la base del joystick, que aparece mientras «toca»;
  - `p.tutorial-text` con `texts.tutorial.drag`;
  - `p.tutorial-keys` con `texts.tutorial.keys`, que solo se ve con `@media (pointer: fine)`.
- `.tutorial` entra en el selector de `styles.css:258` y tampoco se ve en `paused` ni en `result`.

#### 2. Flujo

**Archivo**: `src/main.ts`
- **Inicio → «Jugar»:** después de `showScreen('playing')`, `if (!save.tutorialDone) tutorialHint.show()`.
- **En el bucle, evento `started`:** si `!save.tutorialDone`, `tutorialHint.hide()`, `save.tutorialDone = true` y `writeSave(save)`.
- **`playLevel`:** llama a `tutorialHint.hide()`. Si se sale a Inicio sin moverse, «Jugar» la vuelve a mostrar.
- **`clearProgress`:** con `defaultSave()`, `tutorialDone` vuelve a false, así que el siguiente «Jugar» enseña la mano.

#### 3. Panel

**Archivo**: `src/debug/panel.ts`
- `DebugActions` gana `resetTutorial()`. `main.ts` pone `save.tutorialDone = false` y llama a `writeSave(save)`.
- Botón «Reiniciar tutorial».
- `addNumberFolder` para `config.effects`.

#### 4. Textos

**Archivo**: `src/texts.ts`
- `tutorial.drag: 'Arrastra para mover'` y `tutorial.keys: 'o usa WASD / flechas'`.
- `debug.resetTutorial: 'Reiniciar tutorial'`.

#### 5. Especificación

**Archivo**: `plan.md`
- `:39`: «menos de 2 MB comprimidos, sonidos incluidos».
- `:183`: «Primera partida: al pulsar Jugar por primera vez, una mano animada enseña el joystick. Desaparece con el primer movimiento.»
- `:184`: se mantiene. La calidad llega en M6.
- `:250`: «Paquetes CC0 (Kenney), en MP3».
- `:251` y `:325`: «Ninguna en la v1.0».

### Pruebas

Ninguna prueba nueva de la interfaz: `createTutorialHint` es solo DOM. El evento `started` y la migración del tutorial ya están probados en la fase 1.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La carga inicial pesa menos de 2 MB comprimidos: `make size`
- [x] El panel sigue en un fragmento aparte: `make build && ! grep -q 'lil-gui' dist/assets/index-*.js`

#### Verificación en Chrome (agente, `?debug`, GIF `m5-b-efectos.gif`). Es el criterio de salida automatizable de M5:
- [x] **Tutorial:**
  - con `localStorage` vacío, la página abre en Inicio; al pulsar «Jugar», `.tutorial` es visible y una captura muestra la mano y el texto;
  - al pulsar D, `.tutorial` se oculta y `localStorage` tiene `tutorialDone: true`;
  - tras recargar y pulsar «Jugar», no aparece.
- [x] «Reiniciar tutorial» y después «Jugar» vuelven a mostrar la mano. Con «Borrar progreso», también.
- [x] **Subida de tamaño:** el booster Mejora hace visible «¡Tamaño N!» en `.hud-size-up` y pone la clase `pulse` en la píldora. Una captura en ese momento muestra el anillo en el suelo.
- [x] **Restos:** una captura con D pulsada sobre la hierba muestra trozos de su color en el aire.
- [x] **Victoria:** «Ganar» con la captura durante la onda muestra el anillo de la onda. Al abrir la Victoria, `.celebration` tiene 80 piezas y una captura muestra el confeti y las monedas. Los botones «Siguiente» y «Tienda» siguen respondiendo durante la caída. A los 3 s, `.celebration` está vacío.
- [x] Se juegan los niveles 1 → 5 con «Ganar» y «Siguiente», sin errores en la consola.

#### Verificación manual (usuario):
- [ ] La mano se entiende sin texto en el móvil (juicio visual).
- [ ] El destello, los restos, el confeti y las monedas resultan satisfactorios sin tapar el juego (sensación).
- [ ] Mantiene 55–60 fps en el móvil al cortar con restos y en la Victoria con confeti.
- [ ] Criterio de salida en el móvil: los niveles 1 → 10 se juegan a mano con sonido y vibración, y nada molesta.

---

## Estrategia de pruebas

### Pruebas unitarias (Vitest)

- **Guardado v2:** valores por defecto, migración desde v1 (tutorial hecho, ajustes en true, resto intacto), saneado de booleanos y descarte de claves desconocidas en `settings`.
- **Eventos:** cada evento en su paso, `sizeUp` también con el booster, ningún `cut` en la onda, `won` una sola vez y ningún evento al cambiar de partida.
- **Ritmo del zip:** límite de 60 ms, subida del tono, tope y fin de la racha.
- **Interfaz pura:** `settingRows`, `sizeUpLabel` y `celebrationPieces`.
- **Render puro:** `clippingBlades` y `sizeUpRing`.

Las pruebas leen `config.ts` y `texts.ts` y no repiten números ni textos. Los niveles de prueba se hacen con `levelFromRows` (`tests/logic/levelFixtures.ts`).

### Prueba de arquitectura

Sin cambios en la regla. Cubre `logic/feedback.ts`, que no puede importar `audio/`.

### Verificación en el navegador

El agente la hace con Claude in Chrome al final de las fases 3 y 6, sobre `make preview` con `?debug`. Usa `window.__siegaFeedback` para el sonido y la vibración, el DOM para las capas y capturas para los efectos 3D. Al usuario solo le queda lo que se oye, se siente y se mide en el móvil real.

## Rendimiento

- **Eventos:** `feedback.step` es O(1) más un recorrido de `cutObstacles`, que es corto.
- **Audio:** una fuente WebAudio por sonido. Como mucho ~17 zips por segundo y unos pocos sonidos más. Los búferes se descodifican una vez.
- **Restos:** como mucho 30 piezas nuevas por frame en un pool de 400 de un `InstancedMesh`, con una llamada de dibujo. El recorrido de `update` es O(400) solo mientras quedan piezas vivas, como en `burst`.
- **Anillos:** dos mallas con una llamada de dibujo cada una, ocultas con opacidad 0.
- **Confeti:** 80 `div` con animación CSS de `transform` y `opacity`, que corre en el compositor, durante unos 3 s y solo en la Victoria.
- **Tutorial:** una capa con animación CSS, solo hasta el primer movimiento.
- **Carga inicial:** 8 MP3 de menos de 150 KB en total. Hoy son 215,6 KB, así que quedan ~1,7 MB de margen. `make size` lo vigila.

## Notas de migración

- **Guardado v1 → v2:** `migrate` añade `version: 2` y `tutorialDone: true`, y `sanitize` completa `settings` con los valores por defecto. Un jugador de M4 conserva el nivel, el saldo, las mejoras y los boosters, y no ve la mano.
- **Cambios de API:**
  - `createBurstView(scene, options?)`, con valores por defecto que no cambian la explosión de fruta;
  - `createSettingsScreen(container, actions, vibrationSupported)` devuelve `render`;
  - `PauseActions` gana `onSettings`;
  - `HudState` gana `sizeUp`;
  - `DebugActions` gana `resetTutorial`;
  - `SaveData` gana `settings` y `tutorialDone`.

## Referencias

- Especificación: `plan.md`. Efectos en `plan.md:231-241`, pantallas y tutorial en `plan.md:174-184`, guardado en `plan.md:186-205` y recursos en `plan.md:243-253`.
- Planes anteriores:
  - `thoughts/shared/plans/2026-10-21-siega-total-m4-economia-y-guardado.md` (reparto de hitos en la línea 70)
  - `thoughts/shared/plans/2026-10-20-siega-total-m3-generador.md`
- Patrones que se reutilizan:
  - temporizador puro: `src/ui/blockedNotice.ts:9-26`;
  - carga asíncrona con alternativa: `src/render/obstacleModels.ts:28-100` y `src/main.ts:221-230`;
  - pool de piezas: `src/render/burst.ts`;
  - calco en el suelo sin prueba de profundidad: `src/render/compass.ts`;
  - capa con `stopPropagation`: `src/ui/layer.ts:2-9`;
  - animación CSS repetible: `src/ui/hud.ts:205-209`;
  - PRNG con semilla: `src/logic/random.ts:2`.
