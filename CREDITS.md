# Créditos

## Recursos CC0

Cada recurso nuevo añade aquí su autor, su paquete y su licencia.

### Kenney: Nature Kit (2.1)

- Autor: Kenney ([www.kenney.nl](https://www.kenney.nl))
- Paquete: [Nature Kit](https://kenney.nl/assets/nature-kit)
- Licencia: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- Archivos usados: `Models/GLTF format/stone_largeA.glb` → `public/models/rock.glb`, `Models/GLTF format/cactus_tall.glb` → `public/models/cactus.glb`

### Kenney: Food Kit (2.0)

- Autor: Kenney ([www.kenney.nl](https://www.kenney.nl))
- Paquete: [Food Kit](https://kenney.nl/assets/food-kit)
- Licencia: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- Archivos usados: `Models/GLB format/watermelon.glb` → `public/models/watermelon.glb`, `Models/GLB format/strawberry.glb` → `public/models/strawberry.glb`, `Models/GLB format/Textures/colormap.png` → `public/models/Textures/colormap.png`

### Kenney: Interface Sounds (1.0)

- Autor: Kenney ([www.kenney.nl](https://www.kenney.nl))
- Paquete: [Interface Sounds](https://kenney.nl/assets/interface-sounds)
- Licencia: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- Archivos usados: `Audio/maximize_006.ogg` → `public/sounds/sizeUp.mp3`, `Audio/click_001.ogg` → `public/sounds/tap.mp3`

### Kenney: Impact Sounds (1.0)

- Autor: Kenney ([www.kenney.nl](https://www.kenney.nl))
- Paquete: [Impact Sounds](https://kenney.nl/assets/impact-sounds)
- Licencia: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- Archivos usados: `Audio/impactSoft_heavy_000.ogg` → `public/sounds/bounce.mp3`

### Kenney: Music Jingles

- Autor: Kenney ([www.kenney.nl](https://www.kenney.nl))
- Paquete: [Music Jingles](https://kenney.nl/assets/music-jingles)
- Licencia: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- Archivos usados: `Audio/Pizzicato jingles/jingles_PIZZI01.ogg` → `public/sounds/lose.mp3`

### Sonido y música propios, generados en código

- **Sonido de corte** (`src/audio/cutLoop.ts` y `src/audio/breeze.ts`): un bucle sintetizado de siseo agudo que va y viene a 7 Hz, con pequeños chasquidos de hierba cortada encima; suena mientras la cuchilla corta.
- **Rotura de obstáculos** (`src/audio/breakSounds.ts` y `src/audio/synthesis.ts`): la sandía, la fresa y el cactus suenan con su propio golpe sintetizado, en cuatro variantes y con el tono algo distinto cada vez; los golpes que aguanta una sandía antes de romperse suenan con un golpe sordo.
- **Aviso de poco tiempo y victoria** (`src/audio/chimes.ts`): campanas sintetizadas para el aviso blando de poco tiempo, el arpegio de «barra completa», las tres estrellas del resultado y el destello del confeti.
- **Música lo-fi** (`src/audio/lofi.ts` y `src/audio/music.ts`): se compone mientras suena, con piano eléctrico, bajo, bombo y escobillas sintetizados, en un estilo para la partida y otro más tranquilo para los menús. No usa ningún archivo.
- Todos forman parte del código del juego, con su misma licencia MIT.
