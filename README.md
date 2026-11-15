# Siega Total

Juego web 3D de cortar hierba. Mueve una cuchilla giratoria y corta toda la hierba objetivo antes de que se acabe el tiempo. La cuchilla crece al cortar, y la hierba más alta necesita más tamaño.

**Juega en [nikeyes.github.io/siega-total](https://nikeyes.github.io/siega-total/).**

- 50 niveles de campaña y, después, niveles generados sin fin.
- Monedas, mejoras permanentes y boosters (Mejora, Brújula y Reloj).
- Calidad automática para que vaya fluido en el móvil.
- Sin anuncios, sin cuentas y sin servidor: el progreso se guarda en el navegador.

## Controles

- **Móvil:** arrastra el dedo por la pantalla; la cuchilla va hacia donde arrastras.
- **Escritorio:** WASD o las flechas.

## Desarrollo

Necesita Node 24 o más.

```sh
make install   # instala las dependencias
make dev       # servidor de desarrollo en http://localhost:5173/siega-total/
make check     # tipos
make test      # pruebas (Vitest)
make build     # compilación de producción en dist/
make size      # comprueba que la carga inicial pesa menos de 2 MB comprimidos
```

Con `?debug` en la URL se abre un panel para cambiar valores de `src/config.ts` en vivo, saltar de nivel, ganar al instante y simular fps. El panel no entra en la compilación de producción.

Cada push a `main` compila, prueba y publica en GitHub Pages.

### Curar la campaña

Las semillas de los 50 niveles están en `src/campaign.ts`. Para cambiarlas, abre el juego con `?debug` y usa la carpeta «Nivel» del panel:

- **Ir al nivel** y **Otra semilla** prueban niveles hasta encontrar uno que guste.
- **Copiar semilla** copia la línea del nivel en juego para pegarla en `campaign.ts`.
- **Copiar campaña** vuelve a elegir las 50 semillas y copia el objeto entero.

## Licencia

Código con licencia [MIT](LICENSE). Los modelos y sonidos son CC0; ver [CREDITS.md](CREDITS.md).
