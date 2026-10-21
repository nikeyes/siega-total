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
- Archivos usados: `Audio/impactSoft_heavy_000.ogg` → `public/sounds/bounce.mp3`, `Audio/impactPunch_medium_000.ogg` → `public/sounds/obstacleCut.mp3`

### Kenney: Music Jingles

- Autor: Kenney ([www.kenney.nl](https://www.kenney.nl))
- Paquete: [Music Jingles](https://kenney.nl/assets/music-jingles)
- Licencia: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- Archivos usados: `Audio/Pizzicato jingles/jingles_PIZZI02.ogg` → `public/sounds/win.mp3`, `Audio/Pizzicato jingles/jingles_PIZZI01.ogg` → `public/sounds/lose.mp3`

### Kenney: RPG Audio

- Autor: Kenney ([www.kenney.nl](https://www.kenney.nl))
- Paquete: [RPG Audio](https://kenney.nl/assets/rpg-audio)
- Licencia: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- Archivos usados: `Audio/handleCoins.ogg` → `public/sounds/coins.mp3`

### Sonido propio: brisa del corte

- `public/sounds/cut.mp3` no sale de ningún paquete: es ruido rosa filtrado, generado con `ffmpeg`:
  ```bash
  ffmpeg -f lavfi -i "anoisesrc=d=0.7:c=pink:a=0.5:seed=7" -af "bandpass=f=700:width_type=o:w=1.5,lowpass=f=2500,afade=t=in:curve=qsin:d=0.25,afade=t=out:curve=qsin:st=0.3:d=0.4,volume=13dB" -ac 1 -ar 44100 -b:a 64k public/sounds/cut.mp3
  ```
