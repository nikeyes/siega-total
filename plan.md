# Siega Total — Especificación

Oct 20, 2026 · @Jorge

## Resumen y alcance

Siega Total es un juego web 3D de cortar hierba. El jugador mueve una cuchilla giratoria y debe cortar el 100 % de la hierba objetivo antes de que termine el tiempo. Se inspira en la mecánica de "Grass Master" (Google Play), pero no copia su nombre, logo, arte ni capturas.

**Alcance de la v1.0 (fase 1):**

- Solo web, en navegador móvil y de escritorio.
- Publicación en GitHub Pages: `usuario.github.io/siega-total/`.
- Sin anuncios, sin cuentas, sin servidor.
- Solo español.
- 50 niveles curados + modo infinito generado.

**Fuera de alcance de la v1.0:** anuncios, portales de juegos, dominio propio, apps nativas, skins, otros idiomas, guardado en la nube.

**Licencias:** repositorio público, código con licencia MIT. Los recursos CC0 conservan su licencia y aparecen en `CREDITS.md`.

## Plataforma y tecnología

El juego usa TypeScript + Vite + Three.js, sin motor. Godot queda descartado para un objetivo solo web.

| Decisión | Elección | Motivo |
| --- | --- | --- |
| Motor | Three.js (sin Godot) | La exportación web de Godot 4 pesa unos 30–40 MB y necesita cabeceras COOP/COEP para hilos. GitHub Pages no permite cabeceras propias. |
| Lenguaje | TypeScript | Tipos para arrays planos de briznas, estados y datos de nivel. |
| Compilación | Vite | Servidor de desarrollo con recarga instantánea y compilación optimizada. |
| Render | 3D real, `InstancedMesh` | Las briznas con volumen dan la satisfacción del corte. |
| Interfaz | HTML + CSS sobre el canvas, sin framework | Pocos menús; HTML los resuelve con poco código. |
| Hosting | GitHub Pages | Estático, HTTPS, gratis. Sitio de hasta 1 GB. |
| Despliegue | GitHub Actions | Cada push a `main` compila, prueba y publica. |
| Pruebas | Vitest | Pruebas unitarias de la lógica pura en Node. |
| Depuración | `lil-gui` | Solo con `?debug`; excluido de producción. |

**Configuración obligatoria:** en `vite.config.ts`, `base: '/siega-total/'`.

**Objetivo de carga inicial:** menos de 2 MB comprimidos, sonidos incluidos.

## Reglas del juego

El jugador gana al cortar el 100 % de la hierba objetivo antes de que el tiempo llegue a cero.

### Victoria y derrota

1. Cada nivel tiene un tipo de hierba objetivo. El HUD muestra su icono y una barra de progreso.
2. El progreso es briznas objetivo cortadas ÷ total de briznas objetivo.
3. Al llegar al 100 %, el jugador gana. Una onda corta el resto del campo.
4. Si el tiempo llega a cero, el jugador pierde.
5. La hierba no objetivo da monedas y llena la barra de tamaño, pero no cuenta para ganar.

### Progreso por brizna

1. Cada brizna guarda posición, tipo y estado en arrays planos (`Float32Array`, `Uint8Array`).
2. Una cuadrícula espacial agrupa las briznas por celda.
3. En cada frame, el juego consulta solo las celdas que toca la cuchilla.
4. Una brizna dentro del radio y con tamaño mínimo cumplido pasa a "cortada".
5. El estado va al `InstancedMesh` como atributo por instancia. El shader baja la brizna cortada.

### Tamaño de la cuchilla

1. Cada brizna cortada llena la barra de tamaño.
2. Con la barra llena, la cuchilla sube un nivel. El radio aumenta.
3. Cada hierba u obstáculo tiene un tamaño mínimo. Con tamaño menor, la cuchilla rebota y muestra "Necesitas más tamaño".
4. Cada nivel empieza con el tamaño inicial (base + mejora permanente).

### Control

1. El dedo toca la pantalla. Un joystick flotante aparece en ese punto.
2. Si el dedo se aleja más de 10 px, la cuchilla avanza a velocidad máxima en esa dirección.
3. La dirección gira con suavizado de unos 0,1 s.
4. Al soltar, la cuchilla frena en unos 0,15 s.
5. El tamaño no reduce la velocidad.
6. En escritorio, WASD y flechas también mueven la cuchilla.
7. En bordes y obstáculos, la cuchilla se desliza a lo largo de ellos.

### Cámara

1. Perspectiva, campo de visión vertical de 45°, inclinación de \~55°.
2. Orientación fija: el norte del campo siempre arriba.
3. Seguimiento suave con \~0,15 s de retraso.
4. Cada nivel de tamaño aleja la cámara un 12 %, con transición de 0,5 s.
5. En los bordes, la cámara se detiene antes que la cuchilla.

## Contenido y niveles

La v1.0 tiene 5 hierbas, 3 obstáculos y un generador de niveles por semilla.

### Hierbas

Cualquier hierba puede ser la hierba objetivo.

| Tipo | Color | Tamaño mínimo | Altura | Monedas |
| --- | --- | --- | --- | --- |
| Verde | Verde | 1 | Media | 1 |
| Hielo | Blanco azulado | 1 | Media | 1 |
| Trigo | Amarillo | 2 | Alta | 2 |
| Lavanda | Morado | 3 | Alta | 3 |
| Zarza | Verde oscuro | 4 | Muy alta | 4 |

### Obstáculos

| Tipo | Comportamiento |
| --- | --- |
| Roca | Nunca se corta. Bloquea el paso. |
| Cactus | Se corta con tamaño ≥ 4. Antes, bloquea. |
| Fruta (sandía, fresa) | Se corta con tamaño ≥ 2. Da monedas extra y una explosión de color. |

### Generador

1. Una biblioteca de patrones: franjas, tablero de ajedrez, círculos, espiral, camino serpenteante, campo de fútbol, islas. Cada patrón tiene al menos 2 regiones; en los niveles de un solo tipo de hierba, el patrón se dibuja con hierba y arena.
2. Cada patrón tiene parámetros: tamaño, número de tipos, cantidad de obstáculos.
3. Un PRNG con semilla combina patrones. La misma semilla da siempre el mismo nivel.
4. Una curva de dificultad sube los parámetros con el número de nivel.
5. La salida es una cuadrícula de tipos sobre un campo de 22 × 22 m. Las briznas se colocan sobre ella según la calidad activa. Cada brizna pesa `6 500 / briznas` para el crecimiento y las monedas, así que el nivel se juega igual en cualquier calidad.
6. El total de briznas objetivo se calcula para la calidad activa. El contador siempre es exacto.

### Validación de semillas

El generador acepta una semilla solo si el nivel es posible **con el tamaño inicial base, sin mejoras ni boosters**:

- El tamaño alcanzable con la hierba accesible supera el tamaño mínimo de toda la hierba objetivo.
- Toda la hierba objetivo es alcanzable (no queda encerrada por rocas).
- El tiempo estimado de recorrido cabe en el tiempo del nivel.

### Campaña y modo infinito

1. «Copiar campaña» (panel de depuración) preselecciona las 50 semillas en `campaign.ts`: la primera válida que no repite el patrón de los 2 niveles anteriores. Después se curan jugando, con «Otra semilla» y «Copiar semilla».
2. La campaña v1.0 tiene 50 niveles curados.
3. Después del nivel 50, cada nivel se genera de forma determinista con su primera semilla válida.

### Curva de introducción

1. Niveles 1–3: solo verde. Enseñan el movimiento.
2. Niveles 4–6: verde + hielo. Enseñan la hierba objetivo.
3. Nivel 7: aparece el trigo. Enseña "Necesitas más tamaño".
4. Después: lavanda (10), rocas (13), frutas (16), zarza (19) y cactus (22), uno nuevo cada 3 niveles.

## Economía, boosters, pantallas y guardado

Las monedas compran mejoras permanentes y boosters. No hay anuncios ni compras con dinero real.

### Monedas

1. Cada brizna cortada da las monedas de su tipo (tabla de hierbas).
2. Las frutas dan monedas extra.
3. Al ganar, el jugador recibe un bonus según el tiempo sobrante.

### Mejoras permanentes

Cada mejora tiene niveles con precio creciente (valores en `config.ts`).

| Mejora | Efecto por nivel |
| --- | --- |
| Tamaño inicial | La cuchilla empieza con más tamaño |
| Velocidad | Sube la velocidad máxima |
| Tiempo extra | Suma segundos al tiempo de cada nivel |
| Crecimiento | La barra de tamaño se llena más rápido |

### Boosters

| Booster | Efecto | Duración |
| --- | --- | --- |
| Mejora | Cuchilla +1 tamaño al instante | Hasta el final del nivel |
| Brújula | Flecha a la brizna objetivo más cercana | 15 s |
| Reloj | +30 s al contador | Instantáneo |

1. El jugador empieza con 2 usos de cada booster.
2. Compra más con monedas.
3. Usa cualquier booster en cualquier momento de la partida, sin límite por nivel. No se usan durante la onda de victoria, y la Brújula no se usa mientras está activa.
4. **Resaltado gratuito:** con menos de 10 briznas objetivo restantes, brillan solas. No es un booster.

### Pantallas

&#91;embedded content: flujo de pantallas · 7 pantallas\]

Victoria, Derrota y Pausa también vuelven a Inicio. En Derrota, el reloj sigue la partida con el campo tal como estaba; reintentar empieza de cero.

1. Progresión lineal: Jugar abre el siguiente nivel. No hay selector de niveles.
2. Victoria muestra monedas ganadas y bonus. Botón principal: Siguiente. Botón secundario: Tienda.
3. Pausa automática al perder el foco de la pestaña (`visibilitychange`).
4. Primera partida: al pulsar Jugar por primera vez, una mano animada enseña el joystick. Desaparece con el primer movimiento.
5. Ajustes: sonido, música, vibración, calidad, borrar progreso (con confirmación).
6. La música suena salvo en Pausa o con la pestaña oculta, con fundidos al entrar y salir.

### Guardado

Un objeto JSON versionado en `localStorage`:

```ts
interface SaveData {
  version: 4;
  level: number;
  coins: number;
  upgrades: { startSize: number; speed: number; extraTime: number; growth: number };
  boosters: { upgrade: number; compass: number; clock: number };
  settings: { sound: boolean; music: boolean; vibration: boolean; quality: 'auto' | 'high' | 'medium' | 'low' };
  tutorialDone: boolean;
}
```

1. El juego guarda al ganar, al perder, al comprar, al usar un booster y al cambiar un ajuste.
2. No guarda las monedas a mitad de nivel.
3. Una función de migración actualiza versiones antiguas.
4. Si los datos están dañados o `localStorage` falla, el juego usa valores por defecto y sigue.

## Render, rendimiento, efectos y recursos

El objetivo es 60 fps en un móvil de gama media de \~2020, con calidad automática en tres niveles.

### Niveles de calidad

| Nivel | Briznas máx. | Restos en suelo | Sombra | Resolución máx. |
| --- | --- | --- | --- | --- |
| Alto | 10 800 | Persistentes | Falsa, bajo la cuchilla | 2× |
| Medio | 6 500 | Se desvanecen | Falsa, bajo la cuchilla | 1,5× |
| Bajo | 3 200 | Pocos | No | 1× |

1. Cada sesión empieza en Medio.
2. En cada intento mide 3 s de juego, tras 0,5 s de calentamiento.
3. Con menos de 50 fps, el siguiente intento baja un nivel. Con 58 fps o más en 2 intentos seguidos, sube uno, pero nunca a un nivel del que ya bajó.
4. La calidad solo cambia al empezar un intento, nunca a mitad.
5. El jugador puede fijar el nivel en Ajustes.
6. No hay sombras reales en tiempo real.

### Hierba

1. Cada brizna es un triángulo o dos, con degradado de color por tipo.
2. Todas las briznas de un tipo forman un `InstancedMesh`.
3. El vertex shader aplica un balanceo suave por viento y baja la brizna cortada.

### Efectos

| Efecto | Detalle |
| --- | --- |
| Restos | Trozos del color de la hierba salen despedidos y caen al suelo. En Alto se quedan en el suelo; en Medio se desvanecen; en Bajo hay menos. |
| "+N" flotante | Agrupado: un texto cada 0,2 s con la suma del intervalo. |
| Sonido de corte | Brisa continua y suave («shhh» grave) que entra al cortar y se desvanece al parar. Sin pulsos y sin subir de tono, para que no canse. |
| Subida de tamaño | Destello, sonido ascendente, texto "Tamaño N". |
| Obstáculo duro | Rebote, sonido sordo, vibración corta, texto "Necesitas más tamaño". |
| Victoria | Onda que corta el campo restante desde la cuchilla, confeti, lluvia de monedas. |
| Vibración | 10 ms en subida de tamaño y rebote. Solo donde el navegador lo permite (no en iPhone). Desactivable. |

### Recursos

| Recurso | Origen |
| --- | --- |
| Briznas, cuchilla, restos, suelo | Código |
| Obstáculos (cactus, rocas, frutas) | Paquetes CC0 en glTF (Kenney, Quaternius) |
| Iconos de interfaz | Paquetes CC0 (Kenney) |
| Efectos de sonido | Paquetes CC0 (Kenney), en MP3; la brisa del corte se genera en código |
| Música | Lo-fi relajante generada en código mientras suena: piano eléctrico, bajo, bombo y escobillas |

Regla de estilo: colores planos y saturados, sin texturas fotográficas. Fuente redondeada y gruesa con contorno en la interfaz.

## Arquitectura, depuración y pruebas

La lógica del juego no depende de Three.js ni del DOM. El render y la interfaz solo leen el estado.

### Estructura del repositorio

```
siega-total/
├── src/
│   ├── main.ts            # arranque y bucle principal
│   ├── config.ts          # todos los valores de equilibrio
│   ├── texts.ts           # todos los textos visibles
│   ├── campaign.ts        # semillas de los 50 niveles de la campaña
│   ├── logic/             # puro: sin Three.js ni DOM
│   │   ├── field.ts       # briznas, cuadrícula espacial, corte
│   │   ├── blade.ts       # movimiento y tamaño
│   │   ├── collision.ts   # choques con hierba dura, obstáculos y bordes
│   │   ├── game.ts        # tiempo, progreso, victoria/derrota
│   │   ├── generator.ts   # patrones y PRNG (patterns.ts, random.ts, difficulty.ts)
│   │   ├── validation.ts  # validación de semillas
│   │   ├── progression.ts # nivel de cada número: campaña o modo infinito
│   │   ├── campaignPicker.ts # preselección de la campaña
│   │   ├── economy.ts     # monedas (upgrades.ts y boosters.ts: mejoras y boosters)
│   │   ├── quality.ts     # calidad automática
│   │   └── save.ts        # esquema, migración, valores por defecto
│   ├── render/            # Three.js: hierba, cuchilla, restos, cámara
│   ├── ui/                # pantallas HTML + CSS, HUD, joystick
│   ├── audio/             # efectos, brisa del corte y música lo-fi generada
│   └── debug/             # panel lil-gui (solo con ?debug)
├── tests/                 # Vitest sobre src/logic y las partes puras de render/ui/audio
├── public/                # glTF y sonidos CC0
├── CREDITS.md
├── LICENSE                # MIT
└── .github/workflows/deploy.yml
```

### Reglas de código

1. `logic/` no importa nada de `render/`, `ui/`, `audio/`, `debug/` ni `three`.
2. Ningún texto visible fuera de `texts.ts`.
3. Ningún número de equilibrio fuera de `config.ts`.
4. El generador usa solo su PRNG con semilla, nunca `Math.random()`.

### Panel de depuración (`?debug`)

1. Cambia cualquier valor de `config.ts` en vivo.
2. Salta a nivel N y carga una semilla.
3. Da monedas y gana al instante.
4. Muestra FPS y número de briznas.
5. "Copiar config" copia los valores actuales para pegarlos en `config.ts`.
6. La compilación de producción no incluye el panel.

### Pruebas automáticas (Vitest)

- **Generador:** misma semilla = mismo nivel. Todo nivel aceptado es posible con el tamaño base.
- **Corte:** solo corta dentro del radio y con tamaño suficiente. El contador llega exactamente al total.
- **Tamaño:** la barra sube de nivel con el número correcto de briznas.
- **Economía:** precios crecientes correctos. No compra sin monedas.
- **Guardado:** la migración funciona. Datos dañados dan valores por defecto.

### CI y despliegue

En cada push a `main`, GitHub Actions ejecuta `make check`, `make test`, `make build` y `make size` (carga inicial < 2 MB). Si un paso falla, no publica. Si todo pasa, publica en GitHub Pages.

## Hitos

Siete hitos en orden. Cada uno termina con una versión jugable publicada en GitHub Pages.

&#91;embedded content: hitos M0–M6 · criterio de salida de cada uno\]

M1 va primero porque es el mayor riesgo: si cortar no es satisfactorio o no rinde en móvil, el resto no importa. El generador (M3) llega después del nivel fijo (M2): primero se valida la regla, después se automatiza.

### Preguntas abiertas

- Valores concretos de equilibrio (tiempos, precios, radios): se fijan en M2–M6 con el panel de depuración.
- Música: lo-fi generada en código desde la v1.1.
- Fase 2 (anuncios, dominio propio, portales): fuera de esta especificación.

