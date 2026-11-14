# Modo sin tiempo — plan de implementación

## Overview

Un interruptor en la pantalla de inicio permite jugar la campaña sin reloj, pensado para una niña de 4 años: el tiempo no corre, no se puede perder y al ganar se cobra un bonus fijo. Las decisiones salen de un interrogatorio (grill-me) con el usuario el 2026-11-14.

## Current State Analysis

- El tiempo baja en `stepGame` y a 0 la partida pasa a `'lost'` (`src/logic/game.ts`).
- Al ganar, `timeBonus(timeLeft)` paga 50 monedas por segundo sobrante (`src/logic/economy.ts:16`).
- El booster Reloj se puede usar en juego y tras perder (`src/logic/boosters.ts:15`).
- El HUD pinta `formatClock(timeLeft)`, el aro `timeLeft / timeTotal` y `lowTime` (`src/ui/hud.ts:67`).
- El resultado muestra «Bonus de tiempo» (`src/ui/result.ts:32`).
- La partida guardada es `SaveData` v5 en `localStorage` (`src/logic/save.ts`, `src/ui/storage.ts`).
- El inicio tiene ⚙, título, monedas, «Jugar · Nivel N» y «Tienda» (`src/ui/home.ts`).
- `main.ts` crea la partida en `playLevel` (`src/main.ts:341`); «Reintentar» llama a `restart()` → `playLevel(game.level)`.

## Desired End State

- En el inicio, bajo «Jugar», un botón alterna «⏱ Con tiempo» / «∞ Sin tiempo» (el texto dice el modo; sin `aria-pressed`, que contradecía al texto, según la revisión de código).
- La elección se guarda en `SaveData.timed` (v6) y se recupera al volver a abrir el juego; «Borrar progreso» la devuelve a «con tiempo».
- Una partida sin tiempo: el reloj no baja, nunca llega a `'lost'`, el HUD muestra «∞» con el aro lleno y sin aviso, el Reloj sale deshabilitado, y al ganar paga `config.economy.untimedFinishBonus` (1000) como «Bonus por acabar».
- La campaña (nivel, monedas, mejoras) es la misma en los dos modos.

### Key Discoveries:
- Patrón de migración versión a versión en `migrate` (`src/logic/save.ts:58`) y saneado en `sanitize` (`src/logic/save.ts:87`).
- Los interruptores de Ajustes usan `layerButton` + `aria-pressed` (`src/ui/settings.ts:99`).
- `boosterState` en `main.ts:463` ya pasa por `canUseBooster`, así que deshabilitar el Reloj en la lógica basta para el HUD.
- `config` es editable en vivo con `?debug`.

## What We're NOT Doing

- Nada de facilitar más el juego (rocas, cactus, fruta, hierba alta siguen igual).
- No hay progreso separado ni perfiles.
- No se puede cambiar el modo desde pausa ni a mitad de nivel.
- La tienda no cambia (la mejora «Tiempo extra» sigue a la venta).
- El Reloj no se oculta, solo se deshabilita.

## Implementation Approach

TDD por capas, de la lógica pura hacia la UI y al final el cableado en `main.ts` con un e2e. Cada fase deja `make check` y `make test` en verde.

## Phase 1: Partida sin tiempo (HECHA)

### Changes Required:
- `src/config.ts`: `economy.untimedFinishBonus: 1000`.
- `src/logic/game.ts`: `Game.timed` (readonly), 4º parámetro `timed = true` en `createGame`; `stepGame` solo descuenta tiempo si `timed`; al ganar, `bonusCoins` es `untimedFinishBonus` sin tiempo.
- `tests/logic/game.test.ts`: describe «playing without time» (con tiempo por defecto, nunca pierde, el tiempo se queda lleno, bonus fijo).
- BugMagnet encontró que un nivel con `timeSeconds: 0` se perdía al instante sin tiempo: la derrota ahora exige `game.timed` (`src/logic/game.ts`). Añadidos también «tras reiniciar sigue sin tiempo».

### Success Criteria:
- [x] `npx vitest run tests/logic/game.test.ts`

---

## Phase 2: Reloj deshabilitado sin tiempo

### Changes Required:
- `tests/logic/boosters.test.ts`: el Reloj no se puede usar en una partida sin tiempo; Mejora y Brújula sí.
- `src/logic/boosters.ts`: `case 'clock': return game.timed && (inPlay(game) || game.status === 'lost');`

### Success Criteria:
- [x] `make test`
- [x] `make check`

---

## Phase 3: Elección guardada (SaveData v6)

### Changes Required:
- `tests/logic/save.test.ts`: por defecto `timed: true`; una v5 migra con `timed: true` y el resto intacto; un `timed` no booleano vuelve a `true`; se conserva `timed: false`. Actualizar `progressedSave()` a v6 con `timed: false`.
- `src/logic/save.ts`: `version: 6`, `timed: boolean` en `SaveData` y `defaultSave`, paso `5 → 6` en `migrate`, `timed: booleanOr(...)` en `sanitize`.

### Success Criteria:
- [x] `make test`
- [x] `make check`

---

## Phase 4: HUD y resultado

### Changes Required:
- `tests/ui/hud.test.ts`: con `timed: false`, `clock` es `∞`, `timePercent` 100 y `lowTime` false aunque quede poco tiempo.
- `src/ui/hud.ts`: `HudState.timed`; `hudDisplay` usa `texts.hud.noTime` (`∞`), 100 % y sin `lowTime` cuando no hay tiempo.
- `tests/ui/result.test.ts`: con `timed: false` la línea del bonus es «Bonus por acabar».
- `src/ui/result.ts`: `ResultSummary.timed`; `resultLines` elige `texts.result.finishBonus` o `texts.result.timeBonus`.
- `src/texts.ts`: `hud.noTime: '∞'`, `result.finishBonus: 'Bonus por acabar'`, `home.timed: '⏱ Con tiempo'`, `home.untimed: '∞ Sin tiempo'`.

### Success Criteria:
- [x] `make test`
- [x] `make check`

---

## Phase 5: Interruptor en el inicio y cableado

### Changes Required:
- `tests/ui/home.test.ts`: `homeDisplay` da `modeLabel` según `save.timed`.
- `src/ui/home.ts`: `HomeActions.onToggleTimed`; botón secundario entre «Jugar» y «Tienda», pintado en `render`.
- `src/main.ts`: `onToggleTimed` invierte `save.timed`, guarda y repinta; `playLevel` pasa `save.timed` a `createGame`; `hud.update` pasa `timed: game.timed`; `resultOverlay.show` pasa `timed: game.timed`.
- `e2e/game.e2e.ts`: con «∞ Sin tiempo» pulsado, jugar unos segundos deja `timeLeft === timeTotal`, el temporizador muestra «∞», y tras recargar el botón sigue en «Sin tiempo».

### Success Criteria:
- [x] `make check`
- [x] `make test`
- [x] `make build && make size`
- [x] `make e2e`

---

## Deviations

- Fase 1: la derrota también exige `game.timed`, por un nivel de tiempo 0 que BugMagnet encontró.
- Fase 4: el cableado de `main.ts` (`timed` al HUD, al resultado y a `createGame`) se adelantó desde la fase 5 para que `make check` siguiera en verde.
- Fase 4: los textos del inicio se añadieron en la fase 5, junto a su uso.
- El e2e se escribió con la función ya cableada, así que no se vio en rojo.

## Testing Strategy

- Lógica pura con Vitest (game, boosters, save, hud, result, home).
- Un e2e de Playwright para el cableado real y la persistencia tras recargar.

## Migration Notes

v5 → v6 añade `timed: true`, así que nadie ve un cambio al actualizar.

## References

- Patrón de migración: `src/logic/save.ts:58`
- Interruptor con `aria-pressed`: `src/ui/settings.ts:99`
