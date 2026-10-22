# Siega Total: mejoras inspiradas en Grass Master — Plan de implementación

## Resumen

Ocho mejoras de ambiente y recompensa, tomadas del juego original como idea y hechas con recursos propios, generados en código:

- **Mundo** (mejoras 2 y 5, revisadas):
  - el campo es una isla, una losa con acantilado de tierra rodeada de mar animado;
  - el suelo tiene textura y su color depende del **bioma** del nivel, que es su tipo de hierba dominante;
  - la hierba se mece como una ola de viento: todas las briznas en la misma dirección, pero desfasadas.
- **Brillo bajo la cuchilla** (1), teñido según el bioma.
- **Cuchilla con siete formas** (14): un brazo más en cada tamaño, dientes desde el 5 y disco dentado desde el 7.
- **Rotura propia por obstáculo** (3): sandía, fresa y cactus, sintetizados, con variantes y un tono algo distinto cada vez.
- **Victoria por fases** (4): acorde de «barra completa», tres estrellas y después el confeti, todo sintetizado.
- **Aviso suave de poco tiempo** (13): el reloj pasa a ámbar y late, con un aviso sonoro blando.
- **Música de menú** (8): una variante más tranquila del compositor lo-fi, con fundido cruzado al cambiar de pantalla.

Todo el sonido nuevo se sintetiza en código, con la vista puesta en la calma: nada estridente y nada más fuerte que lo que ya suena. Se retiran tres MP3 de Kenney (`obstacleCut`, `win`, `coins`).

Las demás mejoras del documento original quedan descritas en «Trabajo futuro», al final.

## Análisis del estado actual

- **No hay biomas.** Cada campo mezcla hasta 5 tipos de hierba por celda (`GRASS_TYPE_ORDER`, `src/logic/field.ts:7`). Las celdas `null` son «arena» (`src/logic/levels.ts:25`).
- **Escena** (`src/render/scene.ts:19-41`):
  - el cielo es un color plano;
  - el suelo es un único `PlaneGeometry(width + 40, depth + 40)` de arena `0xf5c86a` sin luz, creado una sola vez al arrancar;
  - no hay borde, ni mar, ni sombras reales.
- **Viento** (`src/render/grass.ts:34,77-78`): `sin(time·2 + root.x·0.5 + root.y·0.3)` desplaza x y z por igual, 0,05 m, con fase según la posición. No hay ráfagas ni deriva en una dirección.
- **Cuchilla** (`src/render/blade.ts:15-83`):
  - `BLADE_ARM_COUNT = 2` es fijo y `createCurvedArmShape()` no tiene parámetros;
  - todo se construye a radio 1 y se escala con `bladeRadius(size)`;
  - la sombra es un círculo, que la calidad baja apaga (`setShadowVisible`, `main.ts:125`).
- **Tamaño:** no tiene tope (`addCuts`, `src/logic/blade.ts:41-50`). El booster de tamaño suma 1 (`boosters.ts:26`). `feedback.ts:59` emite `sizeUp` en los dos casos.
- **Sonidos sueltos** (`src/audio/sounds.ts`):
  - un MP3 de Kenney por nombre (`config.audio.volume`, `config.ts:158`);
  - `play(name, rate)` ya acepta un `rate`, pero nadie lo usa;
  - no hay variantes.
- **Rotura de obstáculos:** `feedback.ts:56-58` emite un único `obstacleCut` sin tipo, y `main.ts:460` toca `obstacleCut.mp3`. Las rocas no se rompen.
- **Victoria:**
  - `winWave` toca `win.mp3`;
  - `won` toca `coins.mp3` y lanza `celebration.play(seed)` (`main.ts:468-474`);
  - el resultado se muestra en el mismo frame (`main.ts:534-538`);
  - no hay estrellas (`src/ui/result.ts:62-103`).
- **Tiempo:** el HUD pinta el anillo con `--time-percent` (`src/ui/hud.ts:182`, `styles.css:67-94`). No hay ningún aviso de poco tiempo.
- **Música** (`src/audio/lofi.ts`, `src/audio/music.ts`):
  - un solo compositor con `config.audio.music` (70 bpm);
  - `updateMusic()` (`main.ts:295-297`) solo enciende o apaga la música; la pista es la misma en todas las pantallas.
- **Síntesis existente:** `cutLoop.ts` tiene su propio filtro paso banda biquad Butterworth (`cutLoop.ts:79-99`) y se prueba en node sin AudioContext (`tests/audio/cutLoop.test.ts`).
- **Volumen real de los efectos actuales:** RMS de cada MP3 × su volumen en `config` ≈ 0,13–0,18 (por ejemplo, `obstacleCut` 0,176 × 0,7 y `win` 0,240 × 0,8). Medido con `sox … stat`.
- **Restricciones:**
  - `src/logic` no usa el DOM, `three` ni `Math.random` (`tests/architecture.test.ts`);
  - las pruebas son vitest en `node` (`vite.config.ts:5-8`);
  - los textos visibles van en `texts.ts` y los números de equilibrio en `config.ts`;
  - la carga inicial pesa menos de 2 MB (`make size`).

### Medidas de los originales (referencia, no se copian)

Analizados con `sox` (duración, momento del pico, caída de 20 dB y reparto de la energía por bandas). Estos números son el objetivo de carácter de cada sonido sintetizado; ningún archivo del original entra en el repo.

| Original | Duración | Pico | Cae −20 dB | Energía por banda (40–300 / 300–1k / 1–3k / 3–6k / 6k+) |
|---|---|---|---|---|
| `big_fruit_break` (sandía) | 0,73–0,90 s | 0,08–0,10 s | 0,38–0,50 s | 20 / 10 / 12–22 / 13–23 / 5 % — golpe grave (~70 Hz) y salpicadura |
| `small_fruit_explosion` (fresa) | 0,80–1,18 s | 0,02–0,10 s | 0,58–0,66 s | 2 / 23 / 39 / 15 / 9 % — «pop» medio |
| `small_berry` | 0,48 s | 0,06 s | 0,14 s | 1 / 3 / 12 / 63 / 13 % — chasquido agudo |
| `cactus_break` | 0,38–0,40 s | 0,04–0,06 s | 0,18–0,28 s | 1 / 1–5 / 26–58 / 22–30 / 10–26 % — crujido seco |
| `progress_bar_complete` | 1,5 s | 0,02 s | 0,14 s | 1 / 12 / 50 / 14 / 18 % — campanilla |
| `star_1..3` | 0,90–0,98 s | 0,02 s | 0,08–0,10 s | 300–1k: 73 → 65 → 54 % — notas que suben (~290 → 390 → 430 Hz) |
| `confetti` | 1,9 s | 0,06 s | 0,22 s | 11 / 16 / 13 / 9 / 30 % — brillo agudo (lo recortamos) |
| `Alert1` | 2,0 s | 0,00 s | 0,76 s | 5 / 28 / 36 / 6 / 3 % — aviso medio, blando |
| Música de menú / de partida | 58 / 64 s | — | — | Casi nada por encima de 3 kHz; ~66 bpm frente a ~122 bpm |

## Estado final deseado

1. **Bioma:**
   - `dominantGrassType(cells)` devuelve el tipo de hierba con más celdas del nivel;
   - en un empate gana el primero de `GRASS_TYPE_ORDER`, y en un campo sin hierba, `'green'`;
   - el bioma se aplica al cargar cada nivel.
2. **Isla:**
   - el campo es una losa de `config.world.slabThickness` (1,2 m);
   - la cara de arriba es el suelo del bioma, con ruido suave y un borde algo más oscuro;
   - las caras laterales son tierra anaranjada moteada;
   - alrededor hay mar hasta donde alcanza la cámara.
   - El suelo por bioma:

     | Bioma | Suelo |
     |---|---|
     | verde | verde claro moteado |
     | hielo | blanco azulado |
     | trigo | ocre claro |
     | lavanda | verde grisáceo apagado |
     | zarza | tierra oscura |

   - Las celdas vacías y la hierba cortada dejan ver ese suelo.
3. **Mar:**
   - azul con vetas claras que se mueven despacio;
   - una línea de espuma junto a la orilla que late suavemente;
   - en calidad Baja, el mar se queda quieto.
4. **Viento:**
   - la hierba se inclina siempre hacia `config.world.wind.direction`;
   - una ola de ráfaga recorre el campo en esa dirección, con un desfase pequeño por brizna;
   - el balanceo máximo es de 0,12 m.
5. **Brillo:**
   - un halo radial suave bajo la cuchilla, de 1,5 veces su radio y con mezcla aditiva;
   - el color depende del bioma;
   - se ve en las tres calidades.
6. **Cuchilla:** la forma depende del tamaño y cambia en el mismo frame que el anillo y el sonido de subir de tamaño.

   | Tamaño | Forma |
   |---|---|
   | 1 | 2 brazos curvos (la de hoy) |
   | 2 | 3 brazos |
   | 3 | 4 brazos |
   | 4 | 5 brazos más anchos, con agujero en el buje |
   | 5 | 6 brazos con dientes de sierra |
   | 6 | 8 brazos con dientes |
   | 7 o más | disco dentado |

   Ninguna forma pasa del radio 1: la cuchilla sigue midiendo lo mismo que su radio de corte.
7. **Rotura:**
   - cada obstáculo que se rompe suena con su propio sonido (sandía, fresa o cactus);
   - cada uno tiene `config.audio.variants` variantes (4), elegidas al azar;
   - el tono varía ±`config.audio.pitchJitter` (6 %);
   - en un mismo paso suena como mucho uno por tipo.
8. **Poco tiempo:**
   - cuando `timeLeft` baja de `config.level.lowTimeSeconds` (10 s) en `playing`, suena una vez un aviso blando de dos notas;
   - el anillo del reloj pasa a ámbar y late una vez por segundo;
   - si el reloj vuelve a superar el umbral (booster o «+30 s»), el aviso se apaga y puede volver a sonar.
9. **Victoria por fases:**
   1. al empezar la ola suena «barra completa»;
   2. en la pantalla de resultado entran tres estrellas, una cada `config.effects.starIntervalSeconds` (0,35 s), cada una con su nota más aguda;
   3. después caen el confeti y la lluvia de monedas, con un brillo suave.
   - Los botones se pueden pulsar desde el principio.
   - Si se sale de la pantalla antes de que termine, la secuencia se cancela.
10. **Música:**
    - partida (`playing`, `paused`) con el estilo `game`, el de hoy;
    - menús (inicio, tienda, ajustes, resultado) con el estilo `menu`: 60 bpm, sin bombo, escobillas más suaves, melodía más escasa y otra progresión;
    - al cambiar de estilo, fundido cruzado de `config.audio.music.crossfadeSeconds` (1,5 s).
11. **Volumen de los sonidos sintetizados:**
    - RMS × volumen en `config` ≤ 0,12, por debajo de los efectos de hoy;
    - pico ≤ 0,5;
    - ataque sin clic: los 2 primeros ms por debajo del 10 % del pico;
    - empiezan y acaban en cero;
    - menos del 10 % de la energía por encima de 6 kHz.
12. **Recursos:**
    - `public/sounds/` ya no tiene `obstacleCut.mp3`, `win.mp3` ni `coins.mp3`;
    - `CREDITS.md` quita esas entradas y describe los sonidos sintetizados.
13. **Panel `?debug`:** la carpeta «Sonidos» tiene un botón por cada sonido sintetizado, para afinarlos de oído.
14. **Comprobación:** `make check test build size` pasa.

### Decisiones (resueltas con grill-me)

| Tema | Decisión |
| --- | --- |
| Alcance | Mejoras 1, 2, 3, 4, 5 (revisada), 8, 13 y 14. El resto se documenta como trabajo futuro, en una sección de este plan. |
| Bioma | El tipo de hierba dominante del nivel, calculado con una función pura. No se guardan datos nuevos ni cambia el generador. |
| Suelo | Tabla por bioma (verde claro, blanco azulado, ocre, verde grisáceo, tierra oscura) con ruido y borde oscuro. Acantilado siempre de tierra anaranjada. |
| Nubes (5) | Sustituidas, porque el original no las tiene: losa con acantilado, mar animado con espuma y viento en ola. En calidad Baja el mar no se mueve. |
| Formas de la cuchilla | 7 formas con tope en el tamaño 7 (la tabla de arriba). Sin turbina. |
| Origen de los sonidos | Todos sintetizados a partir del análisis de los originales: rotura, victoria y aviso. Volumen contenido, nada estridente: el objetivo es la calma. |
| Estrellas | Solo celebración: siempre 3. Ni guardado ni economía. |
| Secuencia de victoria | Ola con «barra completa», 3 estrellas cada 0,35 s en la pantalla de resultado y después confeti. Botones activos desde el principio. |
| Música de menú | Segundo juego de parámetros del compositor (`menu`) y fundido cruzado de 1,5 s. El resultado cuenta como menú. |
| Poco tiempo | A los 10 s: anillo ámbar que late y un único aviso blando, que se rearma si el tiempo vuelve a subir. |
| Entregas | 4 PR por tema: mundo, cuchilla, sonido y victoria. |

### Decisiones de detalle (tomadas al escribir el plan)

- **Bioma = `GrassType`.** No se crea un tipo nuevo. Los colores de cada bioma viven en `src/render/biomes.ts`, igual que `grassColors.ts`.
- **El suelo cambia por nivel:** `GameScene.setBiome(type)` sustituye la textura de la cara de arriba. Se llama donde se construye cada intento (`playLevel`, `main.ts:~310`), junto a `bladeGlow.setBiome`.
- **Texturas generadas como `DataTexture`** a partir de funciones puras que devuelven `Uint8Array` RGBA, sin `canvas`. Así se prueban en node.
- **Losa:** un `BoxGeometry(width, slabThickness, depth)` con la cara de arriba en `y = 0` y un material por cara: suelo arriba y acantilado en los lados y abajo. La arena exterior (`SAND_MARGIN`) desaparece.
- **Mar:**
  - un `PlaneGeometry` de `config.world.seaMargin` (60 m) a cada lado, a `y = -slabThickness · 0.7`;
  - un `ShaderMaterial` con `time`, el tamaño del campo y los colores;
  - la espuma se calcula como la distancia al rectángulo del campo;
  - `setAnimated(false)` congela su `time`.
- **Viento:**
  - la fórmula vive en `src/render/windMath.ts` como función TypeScript probada (`windLean`);
  - el GLSL de `grass.ts` se genera con las mismas constantes de `config.world.wind`;
  - la inclinación es `(0,5 + 0,5·sin(fase))` y siempre es positiva, así que la hierba nunca se inclina contra el viento;
  - la fase es `time·speed − dot(raíz, dirección)·waveNumber + desfase`;
  - el desfase de cada brizna es un hash de su raíz, de hasta ±`phaseJitter`.
- **Brillo:** su propia vista (`src/render/bladeGlow.ts`), separada de `BladeView`, con `update(blade)` y `setBiome(type)`. Está a `y = 0,015`, entre la sombra (0,01) y los restos en el suelo (0,02).
- **Formas de la cuchilla:**
  - `bladeShapeFor(size)` (puro) devuelve `{ kind: 'arms', arms, width, teeth, hubHole } | { kind: 'disc', teeth }`;
  - las siluetas salen de funciones puras de contorno (`armOutline`, `discOutline`), que devuelven listas de puntos;
  - la geometría se crea una vez por forma y se guarda en caché;
  - `BladeView.update` cambia los meshes cuando cambia la forma.
- **Filtros compartidos:** el biquad de `cutLoop.ts` pasa a `src/audio/filters.ts` (`bandPass`, `lowPass`, `highPass`). `cutLoop.ts` y los sonidos nuevos lo usan, así que el filtro no se duplica.
- **Nombres de sonido:** `config.audio.volume` queda con `sizeUp, bounce, lose, tap` (MP3) y `watermelonBreak, strawberryBreak, cactusBreak, levelComplete, star1, star2, star3, confetti, lowTime` (sintetizados). `SYNTHESIZED_SOUNDS` en `src/audio/synthesizedSounds.ts` dice cuáles se generan; el resto se descarga.
- **Variantes:**
  - solo las roturas tienen 4 variantes y variación de tono; los demás sonidos tienen 1 y `rate = 1`;
  - el reproductor guarda `AudioBuffer[]` por nombre;
  - la elección usa `Math.random`, que está permitido fuera de `src/logic`;
  - la síntesis usa `createRandom(semilla fija + variante)`, así que suena igual en cada sesión.
- **Evento de rotura con tipo:** `{ kind: 'obstacleCut', obstacle: 'watermelon' | 'strawberry' | 'cactus' }`, uno por tipo distinto cortado en el paso y en el orden de `config.obstacles`. Sigue sin sonar durante la ola.
- **Evento `lowTime`:** se emite cuando `previous.timeLeft > lowTimeSeconds ≥ game.timeLeft` con `status === 'playing'`. `Previous` gana `timeLeft`. Como exige cruzar el umbral desde arriba, se rearma solo.
- **Estado del reloj en el HUD:** `lowTime = status === 'playing' && timeLeft ≤ lowTimeSeconds`. Pone `data-low-time` en `.hud-timer`, y el CSS cambia el color del anillo a `--hud-time-low` (`#ffb84d`) y anima `hud-timer-pulse` (escala 1 → 1,06 → 1, 1 s).
- **Secuencia de victoria:**
  - `victorySteps()` (puro, en `src/ui/victorySequence.ts`) devuelve `[{ at, step }]`: estrellas en `starsDelaySeconds + i · starIntervalSeconds` y confeti justo después de la última estrella;
  - `createVictorySequence({ onStep })` programa los pasos con `setTimeout` y tiene `cancel()`;
  - `main.ts` la lanza con `won` y la cancela en `showScreen` cuando se deja `result`.
- **Estilos de música:**
  - `config.audio.music.styles.{game, menu}` tienen `bpm, swing, melodyChance, levels`;
  - las progresiones viven en `lofi.ts` (`LOFI_PROGRESSIONS.game` es la de hoy; `menu` es Fmaj7 → Cmaj7 → Fmaj7 → G6, más estática);
  - `musicStyleFor(screen)` es puro: `playing` y `paused` → `game`, el resto → `menu`;
  - `MusicPlayer.setStyle(style)` hace el fundido cruzado entre dos buses y deja de programar el estilo saliente cuando termina el fundido.
- **Recetas de síntesis** (todas normalizadas a pico 0,5 antes de aplicar el volumen de `config`):
  - **Sandía (0,75 s):**
    - golpe senoidal que baja de 75 a 45 Hz y decae en 0,12 s;
    - salpicadura de ruido en paso banda de 1,5 a 5 kHz, con pico a los 0,08 s y caída exponencial hasta los 0,45 s;
    - de 3 a 6 «gotas» cortas (15–30 ms, 2–4,5 kHz) repartidas entre 0,1 y 0,5 s.
  - **Fresa (0,5 s):** «pop» senoidal que baja de 900 a 450 Hz en 40 ms, más ruido de 1 a 4 kHz que decae en 0,3 s.
  - **Cactus (0,4 s):**
    - de 5 a 8 crujidos de 4 a 10 ms en paso banda de 1 a 3,5 kHz, dentro de los primeros 0,18 s;
    - un golpe grave suave (180 Hz, 60 ms).
  - **Campanas (barra completa, estrellas y aviso):**
    - cada nota es una senoide con el armónico 2 al 25 % y el 3 al 8 %;
    - el ataque dura 5 ms y la caída es exponencial;
    - después pasa un paso bajo a 5 kHz.
  - **Notas de cada sonido:**
    - barra completa: arpegio Do5–Mi5–Sol5 (523, 659, 784 Hz) con 80 ms entre notas y una cola de 1,2 s;
    - estrellas: Mi4, Sol4 y Do5 (330, 392 y 523 Hz), 0,9 s cada una;
    - aviso de poco tiempo: La4 → Mi4 (440 → 330 Hz), 1,2 s, con el paso bajo a 3 kHz.
  - **Confeti (1,2 s):** de 14 a 20 destellos de ruido en paso banda de 2 a 5 kHz, de 10 a 25 ms, más densos al principio, sobre un soplo de ruido de 300 Hz a 1,5 kHz que se desvanece. Lleva un paso bajo a 6 kHz, más suave que el original.
- **Panel:** la carpeta «Sonidos» de `src/debug/panel.ts` tiene un botón por cada nombre sintetizado; con las roturas, cada pulsación toca otra variante.

### Hallazgos clave

- `src/render/scene.ts:31-37`: el suelo se crea una sola vez y es el único que pinta la arena.
- `src/render/grass.ts:77-78`: el balanceo. `heightScale` ya lo reduce en la hierba cortada.
- `src/render/blade.ts:37-45`: los brazos comparten geometría y material, así que cambiar de forma es cambiar la geometría y el número de meshes.
- `src/logic/feedback.ts:46-64`: el orden de los eventos es fijo y está probado; `Previous` guarda el estado del frame anterior.
- `src/audio/sounds.ts:47-60`: la carga de los MP3 es el único sitio que conoce los archivos.
- `src/audio/cutLoop.ts:79-99`: el biquad que pasa a `filters.ts`.
- `src/audio/music.ts:39-51`: el planificador con antelación, que se reutiliza para dos buses.
- `src/ui/celebration.ts:60-74`: `play(seed)` ya se limpia sola, así que basta con llamarla más tarde.
- `src/main.ts:458-487`: `playFeedback`, el punto donde se enchufan los eventos nuevos.
- `src/main.ts:117-131`: `applyQuality`, donde se enciende o apaga el mar animado.

## Qué NO hacemos

- Biomas como datos del nivel, ni cambios en el generador, en las semillas o en los snapshots.
- Nubes de cualquier tipo.
- Cambiar el acantilado según el bioma.
- Estrellas con significado: ni umbrales, ni guardado, ni migración de la partida.
- Turbina de 12–14 cuchillas, mejor material de la cuchilla, sombra con silueta, ni estela.
- Sonido de corte por tipo de hierba, sonidos de booster, monedas volando ni trozos de colores al romper.
- Usar, convertir o incluir cualquier archivo del juego original. Solo se usan sus medidas.
- Cambiar `bounce`, `sizeUp`, `tap` o `lose`.
- Cambiar los números de equilibrio, el tiempo, la economía o la calidad automática.

## Enfoque de implementación

Primero la lógica y las funciones puras con TDD, después la integración en el navegador. Cada fase deja `make check test build` en verde.

- **PR A, `feat/world-island`** (fases 1–3): bioma, isla, mar, viento y brillo.
- **PR B, `feat/blade-shapes`** (fase 4): formas de la cuchilla.
- **PR C, `feat/synth-sounds`** (fases 5–7): filtros compartidos, reproductor de sonidos sintetizados, rotura, aviso de poco tiempo y música de menú.
- **PR D, `feat/victory-phases`** (fases 8–9): victoria por fases, limpieza de MP3 y CREDITS, y `plan.md`.

Cada PR sale de `main` después de fusionar el anterior. Comprobación en el navegador: `make build && make preview`, en `http://localhost:4173/siega-total/?debug`, a 390 × 844.

---

## Fase 1: Bioma, isla y suelo con textura

### Resumen
El nivel decide su bioma. El campo se dibuja como una losa con suelo del bioma y acantilado de tierra.

### Cambios necesarios

#### 1. Bioma dominante
**Archivo**: `src/logic/biome.ts` (nuevo)

```ts
/** The grass type with the most cells; ties go to the first in GRASS_TYPE_ORDER, and a field with no grass is green. */
export function dominantGrassType(cells: readonly (GrassType | null)[]): GrassType
```

#### 2. Configuración del mundo
**Archivo**: `src/config.ts`

```ts
world: {
  slabThickness: 1.2,
  seaMargin: 60,
  wind: { direction: { x: 0.8, z: 0.6 }, swayMeters: 0.12, speed: 1.6, waveNumber: 0.35, phaseJitter: 0.6 },
  glow: { scale: 1.5, opacity: 0.55 },
},
```

#### 3. Colores por bioma
**Archivo**: `src/render/biomes.ts` (nuevo)

`BIOME_COLORS: Record<GrassType, { ground: number; glow: number }>`:

| Bioma | Suelo | Brillo |
|---|---|---|
| green | `0xa6d84c` | `0xfff3a8` |
| ice | `0xe4f1f8` | `0xbfefff` |
| wheat | `0xdcb86c` | `0xffd27a` |
| lavender | `0xa3ad8c` | `0xf2b8ff` |
| bramble | `0x6e4c30` | `0xffb36b` |

Más `CLIFF_COLOR = 0xc8783a` y los colores del mar.

#### 4. Texturas generadas
**Archivo**: `src/render/groundTexture.ts` (nuevo)

- `valueNoise(size, cellsPerSide, random): Float32Array`: ruido de valor suavizado, de 0 a 1, que se repite sin costura.
- `groundPixels(size, color, noise, edgeDarkening): Uint8Array`:
  - RGBA, con el color ±6 % según el ruido;
  - se oscurece hasta un 15 % en el 6 % exterior, el borde que da al acantilado.
- `cliffPixels(size, color, random): Uint8Array`: tierra moteada con motas oscuras y claras.

#### 5. Escena con losa
**Archivo**: `src/render/scene.ts`

- Se sustituye el plano de arena por la losa `BoxGeometry` con 6 materiales; el acantilado lleva `RepeatWrapping` según el tamaño.
- Se añade `setBiome(type: GrassType)`, que rehace la `DataTexture` del suelo y libera la anterior.
- Se quita `SAND_MARGIN`.

#### 6. Integración
**Archivo**: `src/main.ts`

`playLevel` llama a `gameScene.setBiome(dominantGrassType(game.level.cells))`.

### Pruebas
- `tests/logic/biome.test.ts`:
  - gana el tipo con más celdas;
  - en un empate gana el primero de `GRASS_TYPE_ORDER`;
  - las celdas `null` no cuentan;
  - un campo sin hierba es `green`.
- `tests/render/groundTexture.test.ts`:
  - el ruido está entre 0 y 1 y es determinista por semilla;
  - se repite sin costura: el borde izquierdo y el derecho difieren lo mismo que dos columnas vecinas;
  - el borde es más oscuro que el centro;
  - el color medio está a menos del 3 % del color del bioma.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La compilación termina: `make build`

---

## Fase 2: Mar animado y viento en ola

### Resumen
Mar con vetas y espuma alrededor de la isla, y hierba que se mece en una dirección con una ola que la recorre.

### Cambios necesarios

#### 1. Mar
**Archivo**: `src/render/sea.ts` (nuevo)

`createSea(scene, width, depth): { update(time), setAnimated(animated) }`. El shader:
- base `0x1fa8f0`;
- vetas `0x7fd6ff`: líneas de `abs(sin)` sobre coordenadas distorsionadas por otra senoide, que se mueven a unos 0,15 m/s;
- espuma `0xeafcff` hasta 0,6 m de la orilla, con una anchura que late con `sin(time · 0,8)`.

#### 2. Viento
**Archivo**: `src/render/windMath.ts` (nuevo)

```ts
/** How far a blade's tip leans downwind, from 0 to config.world.wind.swayMeters, before height scaling. */
export function windLean(rootX: number, rootZ: number, time: number): number
/** The same 0–1 jitter the shader uses for each blade, from its root. */
export function bladePhaseJitter(rootX: number, rootZ: number): number
```

**Archivo**: `src/render/grass.ts`

- Se sustituye el balanceo por `world.xz += windDirection * lean * relativeHeight² * heightScale`.
- El GLSL se genera con las constantes de `config.world.wind`, como ya hacen las demás constantes del shader.
- Se quita `WIND_SWAY_METERS`.

#### 3. Calidad
**Archivo**: `src/main.ts`

- `applyQuality` llama a `sea.setAnimated(next !== 'low')`.
- El bucle llama a `sea.update(elapsedSeconds)`.

### Pruebas
- `tests/render/windMath.test.ts`:
  - la inclinación nunca es negativa (nunca va contra el viento) y nunca pasa de `swayMeters`;
  - dos briznas vecinas en el mismo instante no se inclinan igual;
  - el máximo de la ola avanza en la dirección del viento con el tiempo;
  - el desfase es determinista por raíz.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La compilación termina: `make build`

#### Verificación manual (usuario):
- [ ] La isla, el acantilado y el mar se parecen a la referencia y se ven bien en los 5 biomas (niveles 1, 4, 7, 10 y 19 con `?debug`).
- [ ] El viento se siente suave y relajante, sin mareo.
- [ ] En calidad Baja, el mar quieto no queda raro.

---

## Fase 3: Brillo bajo la cuchilla

### Resumen
Un halo radial suave teñido según el bioma.

### Cambios necesarios

**Archivo**: `src/render/bladeGlow.ts` (nuevo)

- `radialGlowAlpha(size): Uint8Array`: alfa de una sola componente con caída `(1 − r²)²`, 0 en el borde y 1 en el centro.
- `createBladeGlow(scene): { update(blade), setBiome(type) }`:
  - un plano con `MeshBasicMaterial`, mezcla aditiva y `depthWrite: false`, a `y = 0,015`;
  - escala `bladeRadius(size) · config.world.glow.scale`.

**Archivo**: `src/main.ts`: se crea junto a `bladeView`. `playLevel` llama a `setBiome` y el bucle llama a `update`.

### Pruebas
- `tests/render/bladeGlow.test.ts`: el alfa es máximo en el centro, 0 en el borde y en las esquinas, y baja sin saltos de dentro hacia fuera.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La compilación termina: `make build`
- [x] La carga inicial pesa menos de 2 MB comprimidos: `make size`

#### Verificación manual (usuario):
- [ ] La cuchilla destaca sobre la hierba en los 5 biomas sin deslumbrar.

---

## Fase 4: Siete formas de cuchilla

### Resumen
La forma depende del tamaño y cambia al crecer.

### Cambios necesarios

#### 1. Tabla y contornos
**Archivo**: `src/render/bladeShapes.ts` (nuevo)

```ts
export type BladeShape =
  | { kind: 'arms'; arms: number; width: number; teeth: number; hubHole: boolean }
  | { kind: 'disc'; teeth: number };

/** Sizes 1–6 add arms, teeth from 5; size 7 and up is a toothed disc. */
export function bladeShapeFor(size: number): BladeShape
/** One arm from the hub to a pointed tip at radius 1, curving back against the spin, with `teeth` saw teeth on its outer edge. */
export function armOutline(width: number, teeth: number): Vec2[]
/** A disc of radius 1 with `teeth` saw teeth and a hole for the hub. */
export function discOutline(teeth: number): { outer: Vec2[]; hole: Vec2[] }
```

Tabla:
- 1 → `{arms 2, width 1, teeth 0}`
- 2 → 3 brazos
- 3 → 4 brazos
- 4 → `{arms 5, width 1.4, hubHole}`
- 5 → `{arms 6, width 1.2, teeth 3}`
- 6 → `{arms 8, width 1, teeth 3}`
- 7 o más → `{disc, teeth 24}`

#### 2. Vista
**Archivo**: `src/render/blade.ts`

- Se quitan `BLADE_ARM_COUNT` y `createCurvedArmShape`.
- Hay una caché `Map<string, Group>` por forma, construida con `ShapeGeometry` desde los contornos.
- `update` compara la forma con la del frame anterior y cambia el grupo hijo del `spinner`.
- El agujero del buje es un disco oscuro sobre la tapa.

### Pruebas
- `tests/render/bladeShapes.test.ts`:
  - la tabla para los tamaños 1–9: brazos 2, 3, 4, 5, 6 y 8, y disco desde el 7;
  - ningún punto de ningún contorno pasa del radio 1;
  - la punta de cada brazo llega al radio 1 (±0,02);
  - un brazo con `teeth` dientes tiene `teeth` máximos locales de radio en el borde exterior;
  - el disco tiene 24 dientes y su agujero queda dentro del buje.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La compilación termina: `make build`

#### Verificación manual (usuario):
- [ ] Las 7 formas se ven bien girando, y el cambio se nota como premio, también con el booster de tamaño.

---

## Fase 5: Sonidos sintetizados y rotura por obstáculo

### Resumen
Filtros compartidos, reproductor que mezcla MP3 y buffers sintetizados con variantes, y la rotura propia de cada obstáculo.

### Cambios necesarios

#### 1. Filtros compartidos
**Archivo**: `src/audio/filters.ts` (nuevo): `bandPass`, `lowPass` y `highPass` (biquad Butterworth sobre `Float32Array`), sacados de `cutLoop.ts`. `cutLoop.ts` pasa a importarlos.

#### 2. Utilidades de síntesis
**Archivo**: `src/audio/synthesis.ts` (nuevo):
- `bell(sampleRate, frequency, seconds)`: campana con armónicos, ataque de 5 ms y caída exponencial;
- `noiseBurst(sampleRate, seconds, lowHz, highHz, decay, random)`;
- `pitchDrop(sampleRate, fromHz, toHz, seconds)`;
- `mixAt(target, source, offsetSeconds)`;
- `normalizePeak(samples, peak)`;
- `fadeEdges(samples)`.

#### 3. Rotura
**Archivo**: `src/audio/breakSounds.ts` (nuevo): `synthesizeBreak(obstacle, sampleRate, random)` según las recetas de «Decisiones de detalle».

#### 4. Catálogo y reproductor
**Archivo**: `src/audio/synthesizedSounds.ts` (nuevo)

`SYNTHESIZED_SOUNDS: Record<SynthesizedSoundName, (sampleRate, random) => Float32Array>` y `variantsOf(name)`. En esta fase entran las tres roturas; las campanas llegan en las fases 6 y 8.

**Archivo**: `src/audio/sounds.ts`
- Los buffers son `Partial<Record<SoundName, AudioBuffer[]>>`.
- Los nombres sintetizados se generan al crear el reproductor; el resto se descarga como hoy.
- `play(name)` elige una variante al azar y, en las roturas, un `rate` dentro de `1 ± pitchJitter`.

**Archivo**: `src/config.ts`
- `audio.volume` cambia `obstacleCut` por `watermelonBreak`, `strawberryBreak` y `cactusBreak`;
- se añaden `audio.variants: 4` y `audio.pitchJitter: 0.06`.

#### 5. Evento con tipo
**Archivo**: `src/logic/feedback.ts`: `obstacleCut` lleva `obstacle`, con un evento por tipo distinto.

**Archivo**: `src/main.ts`: `playFeedback` toca `${obstacle}Break`.

**Archivo**: `public/sounds/obstacleCut.mp3`: se borra. Se actualiza `CREDITS.md` (Impact Sounds conserva `bounce`).

#### 6. Panel
**Archivo**: `src/debug/panel.ts`: carpeta «Sonidos» con un botón por cada nombre sintetizado.

### Pruebas
- `tests/audio/filters.test.ts`: un paso banda deja pasar su centro y atenúa más de 20 dB una década por debajo y otra por encima.
- `tests/audio/cutLoop.test.ts`: sin cambios; debe seguir en verde tras la extracción.
- `tests/audio/breakSounds.test.ts`, por obstáculo:
  - duración dentro de su receta;
  - pico de la envolvente en la ventana del original (sandía 0,05–0,12 s);
  - la banda dominante es la del original (sandía con energía por debajo de 300 Hz y en 1,5–5 kHz; fresa en 1–4 kHz; cactus en 1–3,5 kHz);
  - las 4 variantes son distintas, y la misma semilla da el mismo sonido.
- `tests/audio/synthesizedSounds.test.ts`, la regla de calma, para **todos** los nombres sintetizados:
  - pico ≤ 0,5;
  - `config.audio.volume[name] · rms ≤ 0.12`;
  - los 2 primeros ms por debajo del 10 % del pico;
  - la primera y la última muestra son 0;
  - menos del 10 % de la energía por encima de 6 kHz.
- `tests/logic/feedback.test.ts`:
  - cortar una sandía y dos fresas en un paso da dos eventos, en el orden de `config.obstacles`;
  - una roca no da ninguno;
  - la ola no da ninguno.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La compilación termina: `make build`
- [x] `obstacleCut.mp3` ya no existe y nadie lo cita: `! grep -rqE "obstacleCut\.mp3|'obstacleCut'\)|obstacleCut:" src public CREDITS.md` (desviación: el `grep` original no puede pasar, porque el evento sigue llamándose `obstacleCut`, como dice el plan, y existe `obstacleCutSize` en `src/logic`)

#### Verificación manual (usuario):
- [ ] Cada rotura se reconoce, suena agradable y no cansa tras 20 seguidas (botones del panel).

---

## Fase 6: Aviso suave de poco tiempo

### Resumen
Reloj ámbar que late y un aviso blando, una sola vez.

### Cambios necesarios
- **`src/config.ts`:** `level.lowTimeSeconds: 10` y `audio.volume.lowTime`.
- **`src/logic/feedback.ts`:**
  - `Previous` gana `timeLeft`;
  - evento `{ kind: 'lowTime' }`, colocado entre `sizeUp` y `winWave` en el orden documentado.
- **`src/audio/chimes.ts`** (nuevo): `synthesizeLowTime(sampleRate)`, que se registra en `SYNTHESIZED_SOUNDS`.
- **`src/ui/hud.ts`:**
  - `lowTime` en el estado que se muestra;
  - `timer.dataset.lowTime` solo se toca cuando cambia.
- **`src/ui/styles.css`:** `--hud-time-low` y la animación `hud-timer-pulse` sobre `.hud-timer[data-low-time='true']`.
- **`src/main.ts`:** `playFeedback` toca `lowTime`.

### Pruebas
- `tests/logic/feedback.test.ts`:
  - al cruzar los 10 s se emite una sola vez;
  - no se repite en los frames siguientes;
  - si el booster sube el reloj por encima de 10 s y vuelve a bajar, se emite otra vez;
  - no se emite en `ready`, `winWave` ni `lost`.
- `tests/ui/hud.test.ts`: `lowTime` es verdadero a 10 s en `playing` y falso a 10,1 s o fuera de `playing`.
- `tests/audio/chimes.test.ts`: dos notas, la segunda más grave (frecuencia dominante en cada mitad); 1,2 s.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La compilación termina: `make build`

#### Verificación manual (usuario):
- [ ] El aviso se nota sin estresar.

---

## Fase 7: Música de menú

### Resumen
Dos estilos del compositor y fundido cruzado entre ellos.

### Cambios necesarios
- **`src/config.ts`:**
  - `audio.music` conserva `volume`, `fadeSeconds` y `reverb`, y añade `crossfadeSeconds: 1.5`;
  - `styles.game` lleva los valores de hoy;
  - `styles.menu` lleva `bpm: 60, swing: 0.12, melodyChance: 0.08` y `levels` con `kick: 0`, escobillas a la mitad y el bajo a un 70 %.
- **`src/audio/lofi.ts`:**
  - `MusicStyle = 'game' | 'menu'`;
  - `LOFI_PROGRESSIONS`;
  - `createLofiComposer(style, random)` y `eighthSeconds(style)`.
- **`src/audio/musicStyle.ts`** (nuevo): `musicStyleFor(screen)`.
- **`src/audio/music.ts`:**
  - un bus por estilo, cada uno con su compositor, `step` y `nextEighth`;
  - `setStyle(style)` lleva el bus nuevo a 1 y el saliente a 0 con `crossfadeSeconds`;
  - el estilo saliente deja de programarse al acabar el fundido.
- **`src/main.ts`:** `updateMusic()` también llama a `musicPlayer.setStyle(musicStyleFor(screen))`.

### Pruebas
- `tests/audio/lofi.test.ts`:
  - las pruebas de hoy, con `'game'`;
  - `menu` no tiene bombo;
  - sus escobillas son más suaves que en `game`;
  - sigue su progresión;
  - su corchea dura `60 / 60 / 2` s;
  - con la misma semilla tiene menos notas de melodía que `game`.
- `tests/audio/musicStyle.test.ts`: `playing` y `paused` → `game`; `home`, `shop`, `settings` y `result` → `menu`.

### Criterios de éxito

#### Verificación automática:
- [x] Los tipos pasan: `make check`
- [x] Todas las pruebas pasan: `make test`
- [x] La compilación termina: `make build`
- [x] La carga inicial pesa menos de 2 MB comprimidos: `make size`

#### Verificación manual (usuario):
- [ ] La música de menú relaja más que la de partida, y el fundido al pulsar Jugar y al ver el resultado no se nota a saltos.

---

## Fase 8: Victoria por fases

### Resumen
«Barra completa», tres estrellas y después el confeti, todo sintetizado.

### Cambios necesarios
- **`src/audio/chimes.ts`:** `synthesizeLevelComplete`, `synthesizeStar(index)` y `synthesizeConfetti`, que se registran como `levelComplete`, `star1..3` y `confetti`.
- **`src/config.ts`:**
  - `audio.volume` cambia `win` y `coins` por los nombres nuevos;
  - `effects.starsDelaySeconds: 0.3` y `effects.starIntervalSeconds: 0.35`.
- **`src/ui/victorySequence.ts`** (nuevo): `victorySteps()` y `createVictorySequence({ onStep })` con `play()` y `cancel()`.
- **`src/ui/icons.ts`:** `starIconSvg`.
- **`src/ui/result.ts`:** en `won`, una fila `.result-stars` con 3 estrellas y `animation-delay` sacado de `victorySteps()`. En `lost` no hay fila.
- **`src/ui/styles.css`:** `result-star-pop` (escala 0 → 1,2 → 1, 0,3 s) y estrella apagada hasta su turno.
- **`src/main.ts`:**
  - `winWave` toca `levelComplete`;
  - `won` lanza la secuencia: `star` toca `star1..3`, y `confetti` toca `confetti` y llama a `celebration.play(seed)`;
  - `showScreen` la cancela al salir de `result`.
- **`public/sounds/win.mp3` y `coins.mp3`:** se borran. En `CREDITS.md` se quita la entrada de RPG Audio, Music Jingles conserva `lose` y se describen los sonidos sintetizados en «Sonido y música propios».

### Pruebas
- `tests/ui/victorySequence.test.ts`:
  - 3 estrellas en orden y separadas por `starIntervalSeconds`;
  - el confeti va después de la última;
  - `cancel()` evita los pasos pendientes (con temporizadores falsos de vitest).
- `tests/audio/chimes.test.ts`:
  - la frecuencia dominante sube de la estrella 1 a la 3;
  - «barra completa» tiene sus 3 notas en orden;
  - el confeti dura 1,2 s y tiene menos agudos que la regla general.
- `tests/ui/result.test.ts`: `won` muestra 3 estrellas con retrasos crecientes; `lost` no muestra ninguna.

### Criterios de éxito

#### Verificación automática:
- [ ] Los tipos pasan: `make check`
- [ ] Todas las pruebas pasan: `make test`
- [ ] La compilación termina: `make build`
- [ ] La carga inicial pesa menos de 2 MB comprimidos: `make size`
- [ ] Ya no quedan los MP3 retirados: `test ! -e public/sounds/win.mp3 && test ! -e public/sounds/coins.mp3`

#### Verificación manual (usuario):
- [ ] La secuencia se siente como un premio tranquilo, sin prisas, y sus sonidos no chocan con la música de menú.

---

## Fase 9: Especificación al día

### Resumen
`plan.md` refleja lo que ha cambiado.

### Cambios necesarios
**Archivo**: `plan.md`
- Contenido (`:88-117`): el bioma es la hierba dominante; la isla tiene suelo por bioma y mar.
- Pantallas y música (`:174-185`): estilos de menú y de partida, con fundido cruzado.
- Efectos (`:233-242`):
  - formas de la cuchilla;
  - brillo;
  - rotura por obstáculo;
  - aviso de poco tiempo;
  - victoria por fases;
  - viento.
- Recursos (`:245-253`): los sonidos de rotura, victoria y aviso se generan en código; quedan 4 MP3 de Kenney.

### Criterios de éxito

#### Verificación automática:
- [ ] `make check test build size` pasa.

---

## Estrategia de pruebas

- **Lógica pura** (`src/logic`):
  - `dominantGrassType`;
  - los eventos `obstacleCut` con tipo y `lowTime`.
- **Render puro** (sin WebGL):
  - las texturas generadas;
  - el viento;
  - el alfa del brillo;
  - la tabla y los contornos de la cuchilla.
- **Audio puro** (sin AudioContext):
  - filtros;
  - recetas de síntesis;
  - la regla de calma para todos los sonidos;
  - el compositor por estilo;
  - `musicStyleFor`.
- **UI:** `victorySteps` y su cancelación, el estado `lowTime` del HUD y las estrellas del resultado.
- **Navegador**, con `?debug`:
  - `window.__siegaFeedback` muestra `watermelonBreak`, `lowTime`, `levelComplete`, `star1..3` y `confetti` en el orden esperado al jugar un nivel;
  - capturas a 390 × 844 de los 5 biomas y de las 7 formas (con el booster de tamaño).

## Rendimiento

- La síntesis al arrancar genera unos 12 buffers cortos, menos de 0,5 M muestras en total. Se espera que tarde menos de 50 ms; si en el móvil tarda más, se aplaza hasta el primer gesto que desbloquea el audio.
- El mar es un solo plano con un shader barato. En calidad Baja su `time` no avanza.
- El brillo es un solo plano. Las formas de la cuchilla se guardan en caché; como mucho hay 7 grupos.
- La carga inicial baja, porque se retiran 3 MP3.

## Notas de migración

- La partida guardada no cambia.
- Los nombres `obstacleCut`, `win` y `coins` desaparecen de `config.audio.volume`. Hay que actualizar el panel y las pruebas que los citen.

## Trabajo futuro

Mejoras del documento original que quedan fuera de este plan, con lo aprendido del código:

| # | Mejora | Idea y referencia del original | Dónde y coste |
|---|---|---|---|
| 6 | Partículas flotando | Polvo y destellos lentos y escasos (`Dust`, `NoiseDust`, `TinySparkles`, `LingeringSparkle`). | Un `InstancedMesh` de planos de cara a la cámara con deriva lenta; apagado en Baja. S–M. |
| 7 | Partículas por bioma | Nieve en hielo (`SnowVfx`) y arena roja en zarza (`RedSandVfx`). | Reutiliza el bioma dominante de este plan y el sistema de la 6. M. |
| 9 | Sonido de corte por hierba | Bucles propios en el original (`icicles_loop`, `spiklet_*`, `lavander_loop`, `prickly_grass_loop`, `sand_loop`). | `cutLoop.ts` tiene sus parámetros como constantes del módulo. Habría que generar un buffer por tipo y hacer un fundido según el tipo cortado (`field.types[index]`, `main.ts:529`). M. |
| 10 | Monedas volando al contador | `coins_flyoutfix` + `item_to_bar`, con un «tic» al llegar. | Una capa DOM desde la posición del «+N» (`hud.ts:206-212`) hasta `.hud-coins`. M. |
| 11 | Trozos de colores al romper | `VfxCactusFruitPoof` y `VfxCoinPoof`. | `burst.spawn` admite un color por llamada; pasarle varios colores por obstáculo (pulpa, corteza, pepitas). S. |
| 12 | Sonidos de booster | `timer_booster_sound`, `Booster_search` y `resize_booster`. | Sintetizarlos con `synthesis.ts`. El handler `onBooster` (`main.ts:138-141`) hoy solo toca `tap`. S–M. |
| 15 | Mejor material de la cuchilla | Buje con relieve y brazos con degradado de rosa a violeta. | Colores por vértice en las `ShapeGeometry` de `bladeShapes.ts`. S–M. |
| 16 | Sombra con la silueta | `saw_shadow`. | Reutilizar los contornos de `bladeShapes.ts` en negro translúcido en lugar del círculo. S. |
| 17 | Estela | `image_3_turbo_saw_info`. | Una cinta por punta con las últimas posiciones. M. |
| 18 | Modo turbo | Sierra violeta y barra de carga, como su «Turbo Saw». | Estado nuevo en `src/logic/game.ts` y HUD. L. |
| — | Turbina (tamaños 8–9) | 12–14 cuchillas dentadas. | Ampliar `bladeShapeFor` más allá del disco. S. |
| — | Nubes | Descartadas, porque el original no las tiene. Si se quisieran, solo sombras sobre el suelo. | M. |
| — | Fuentes OFL | Nunito Black y Poetsen One, desde Google Fonts (nunca del APK). | `--hud-font` ya tiene Nunito como reserva. Revisar el peso en `make size`. S. |

## Referencias

- Documento de mejoras: `/private/tmp/claude-503/-Users-jorge-castro-mordor-personal-siega-total/4a035ecc-ee52-4251-97fd-f6a5f90cdcb4/scratchpad/mejoras-desde-grass-master.md`
- Originales analizados (solo referencia y temporales): `…/scratchpad/out/original/audio/` y la captura de la isla que adjuntó el usuario.
- Especificación: `plan.md:88-117`, `:174-185`, `:233-253`.
- Síntesis y pruebas que sirven de modelo: `src/audio/cutLoop.ts`, `tests/audio/cutLoop.test.ts`.
- Plan anterior de sonido: `thoughts/shared/plans/2026-10-21-siega-total-m5-sonido-efectos-y-tutorial.md`.
