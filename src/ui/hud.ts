import type { GrassType } from '../logic/field';
import type { BoosterKind } from '../logic/save';
import { isObstacleType, type LevelDefinition, type TargetKind } from '../logic/levels';
import { GRASS_COLORS } from '../render/grassColors';
import { OBSTACLE_COLORS } from '../render/obstacleColors';
import { texts } from '../texts';
import { formatClock } from './clock';
import { formatCount } from './formatCount';
import { boosterIconSvg, coinIconSvg, pauseIconSvg } from './icons';

/** The size pill hangs this far below the blade's center on screen, clear of the blade itself. */
const SIZE_PILL_OFFSET_PX = 34;
/** «Necesitas más tamaño» floats this far above the blade's center on screen. */
const BLOCKED_NOTICE_OFFSET_PX = 70;
/** «¡Tamaño N!» floats this far above the blade's center on screen, above «Necesitas más tamaño». */
const SIZE_UP_OFFSET_PX = 90;
/** A «+N» starts this far above the blade's center on screen and rises from there. */
const COIN_FLOAT_OFFSET_PX = 40;
/** «+N» elements reused in turn; each lives 0.6 s and one comes out at most every 0.2 s, so they never run out. */
const COIN_FLOAT_COUNT = 6;
const ICON_SPIKES = 5;

export interface HudState {
  timeLeft: number;
  timeTotal: number;
  /** Units left of each target, in the order of the level's targets. */
  remainingByTarget: readonly number[];
  size: number;
  growthFraction: number;
  /** Where the size pill hangs from, in container pixels (the blade on screen). */
  sizeLabelX: number;
  sizeLabelY: number;
  /** Starts «Necesitas más tamaño» above the blade. */
  showBlocked: boolean;
  /** The balance with what this level has earned so far. */
  coins: number;
  /** Starts a «+N» above the blade with these coins. */
  floatCoins: number | null;
  /** The new size in the frame the blade grows, null in the others. */
  sizeUp: number | null;
  /** Uses left of each booster, and whether the game lets it be used now. */
  boosters: Record<BoosterKind, { uses: number; usable: boolean }>;
}

/** What the HUD shows, rounded to what the player can tell apart, so equal displays need no DOM writes. */
export interface HudDisplay {
  clock: string;
  timePercent: number;
  /** Units left of each target, formatted for the card. */
  targetCounts: string[];
  sizeLabel: string;
  growthPercent: number;
  sizeLabelX: number;
  sizeLabelY: number;
  coinsLabel: string;
  /** «¡Tamaño N!» in the frame the blade grows. */
  sizeUpLabel: string | null;
}

export function hudDisplay(state: HudState): HudDisplay {
  return {
    clock: formatClock(state.timeLeft),
    timePercent: toPercent(state.timeLeft / state.timeTotal),
    targetCounts: state.remainingByTarget.map(formatCount),
    sizeLabel: `${texts.hud.size} ${state.size}`,
    growthPercent: toPercent(state.growthFraction),
    sizeLabelX: Math.round(state.sizeLabelX),
    sizeLabelY: Math.round(state.sizeLabelY),
    coinsLabel: formatCount(state.coins),
    sizeUpLabel: state.sizeUp === null ? null : texts.hud.sizeUp.replace('{size}', String(state.sizeUp)),
  };
}

const BOOSTER_ORDER: readonly BoosterKind[] = ['upgrade', 'compass', 'clock'];

export interface BoosterButton {
  kind: BoosterKind;
  usesLabel: string;
  disabled: boolean;
}

/** The round booster buttons at the bottom right, off without uses or when the game does not allow one now. */
export function boosterButtons(state: HudState): BoosterButton[] {
  return BOOSTER_ORDER.map((kind) => {
    const { uses, usable } = state.boosters[kind];
    return { kind, usesLabel: formatCount(uses), disabled: uses <= 0 || !usable };
  });
}

export function levelLabel(levelNumber: number): string {
  return `${texts.hud.level} ${levelNumber}`;
}

function toPercent(fraction: number): number {
  return Math.round(fraction * 100);
}

export interface HudActions {
  onPause(): void;
  onBooster(kind: BoosterKind): void;
}

export interface Hud {
  update(state: HudState): void;
  /** Rebuilds the target card for a new level. */
  showLevel(level: LevelDefinition): void;
}

/**
 * Timer and target card at the top left, coins and the pause button at the top right, the boosters at the bottom right, the size pill that follows the blade,
 * and the blocked notice, «¡Tamaño N!» and the «+N» of the coins above it.
 */
export function createHud(container: HTMLElement, actions: HudActions): Hud {
  const top = element('div', 'hud');
  const timer = element('div', 'hud-timer');
  const clock = element('span', 'hud-timer-text');
  timer.append(clock);
  const card = element('div', 'hud-target');
  const levelName = element('div', 'hud-level');
  const side = element('div', 'hud-side');
  side.append(levelName, card);
  top.append(timer, side);

  const pill = element('div', 'hud-size');
  const pillFill = element('div', 'hud-size-fill');
  const pillText = element('span', 'hud-size-text');
  pill.append(pillFill, pillText);
  const blockedNotice = element('div', 'hud-blocked');
  blockedNotice.textContent = texts.hud.needBiggerSize;
  const sizeUpNotice = element('div', 'hud-size-up');
  const corner = element('div', 'hud-corner');
  const coins = element('div', 'hud-coins');
  coins.innerHTML = coinIconSvg('hud-coins-icon');
  const coinsText = element('span', 'hud-coins-text');
  coins.append(coinsText);
  const pause = element('button', 'hud-pause') as HTMLButtonElement;
  pause.type = 'button';
  pause.setAttribute('aria-label', texts.pause.title);
  pause.innerHTML = pauseIconSvg();
  // The joystick listens on the container; a touch on the button only pauses.
  pause.addEventListener('pointerdown', (event) => event.stopPropagation());
  pause.addEventListener('click', () => actions.onPause());
  corner.append(coins, pause);
  const boosters = element('div', 'hud-boosters');
  const boosterElements = BOOSTER_ORDER.map((kind) => {
    const button = element('button', 'hud-booster') as HTMLButtonElement;
    button.type = 'button';
    button.dataset.kind = kind;
    button.setAttribute('aria-label', texts.boosters[kind]);
    button.innerHTML = boosterIconSvg(kind);
    const uses = element('span', 'hud-booster-uses');
    button.append(uses);
    button.addEventListener('pointerdown', (event) => event.stopPropagation());
    button.addEventListener('click', () => actions.onBooster(kind));
    boosters.append(button);
    return { button, uses };
  });
  const coinFloats = Array.from({ length: COIN_FLOAT_COUNT }, () => element('div', 'hud-float'));
  let nextCoinFloat = 0;
  container.append(top, corner, boosters, pill, blockedNotice, sizeUpNotice, ...coinFloats);

  let counters: HTMLElement[] = [];
  let shown: Partial<HudDisplay> = {};

  function showLevel(level: LevelDefinition): void {
    levelName.textContent = levelLabel(level.number);
    card.replaceChildren();
    counters = level.targets.map((target) => {
      const row = element('div', 'hud-target-row');
      row.innerHTML = targetIconSvg(target);
      const counter = element('span', 'hud-target-count');
      row.append(counter);
      card.append(row);
      return counter;
    });
    shown = {};
  }

  function update(state: HudState): void {
    const display = hudDisplay(state);
    if (display.clock !== shown.clock) clock.textContent = display.clock;
    if (display.timePercent !== shown.timePercent) timer.style.setProperty('--time-percent', `${display.timePercent}%`);
    display.targetCounts.forEach((count, target) => {
      if (count !== shown.targetCounts?.[target] && counters[target]) counters[target].textContent = count;
    });
    if (display.sizeLabel !== shown.sizeLabel) pillText.textContent = display.sizeLabel;
    if (display.growthPercent !== shown.growthPercent) pillFill.style.width = `${display.growthPercent}%`;
    if (display.sizeLabelX !== shown.sizeLabelX || display.sizeLabelY !== shown.sizeLabelY) {
      // The `translate` property, not `transform`: the pulse and the size-up animate `scale`, which would scale a `transform` offset too.
      pill.style.translate = `calc(${display.sizeLabelX}px - 50%) ${display.sizeLabelY + SIZE_PILL_OFFSET_PX}px`;
      blockedNotice.style.transform = `translate(calc(${display.sizeLabelX}px - 50%), ${display.sizeLabelY - BLOCKED_NOTICE_OFFSET_PX}px)`;
      sizeUpNotice.style.translate = `calc(${display.sizeLabelX}px - 50%) ${display.sizeLabelY - SIZE_UP_OFFSET_PX}px`;
    }
    if (state.showBlocked) restartAnimation(blockedNotice, 'visible');
    if (display.sizeUpLabel !== null) {
      sizeUpNotice.textContent = display.sizeUpLabel;
      restartAnimation(sizeUpNotice, 'visible');
      restartAnimation(pill, 'pulse');
    }
    if (display.coinsLabel !== shown.coinsLabel) coinsText.textContent = display.coinsLabel;
    boosterButtons(state).forEach(({ usesLabel, disabled }, index) => {
      const { button, uses } = boosterElements[index]!;
      if (uses.textContent !== usesLabel) uses.textContent = usesLabel;
      if (button.disabled !== disabled) button.disabled = disabled;
    });
    if (state.floatCoins !== null) {
      const float = coinFloats[nextCoinFloat]!;
      nextCoinFloat = (nextCoinFloat + 1) % COIN_FLOAT_COUNT;
      float.textContent = `+${formatCount(state.floatCoins)}`;
      float.style.transform = `translate(calc(${display.sizeLabelX}px - 50%), ${display.sizeLabelY - COIN_FLOAT_OFFSET_PX}px)`;
      restartAnimation(float, 'visible');
    }
    shown = display;
  }

  return { update, showLevel };
}

/** Plays a CSS animation from the start, even if it is still running. */
function restartAnimation(target: HTMLElement, className: string): void {
  target.classList.remove(className);
  void target.offsetWidth;
  target.classList.add(className);
}

function targetIconSvg(target: TargetKind): string {
  return isObstacleType(target) ? pieceIconSvg(target) : tuftIconSvg(target);
}

function element(tag: string, className: string): HTMLElement {
  const created = document.createElement(tag);
  created.className = className;
  return created;
}

/** A small tuft of spikes fanned out from the bottom, colored like the grass type on the field. */
function tuftIconSvg(type: GrassType): string {
  const { base, tip } = GRASS_COLORS[type];
  const gradientId = `tuft-${type}`;
  const spikes = Array.from({ length: ICON_SPIKES }, (_, spike) => {
    const lean = (spike - (ICON_SPIKES - 1) / 2) * 7;
    const height = spike % 2 === 0 ? 6 : 12;
    const baseX = 20 + lean * 0.6;
    return `<polygon points="${baseX - 4},38 ${baseX + 4},38 ${20 + lean * 2},${height}" />`;
  }).join('');
  return `<svg class="hud-target-icon" viewBox="0 0 40 40" aria-hidden="true">
    <defs><linearGradient id="${gradientId}" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="${hexColor(base)}" /><stop offset="1" stop-color="${hexColor(tip)}" />
    </linearGradient></defs>
    <g fill="url(#${gradientId})" stroke="#16324f" stroke-width="2" stroke-linejoin="round">${spikes}</g>
  </svg>`;
}

function hexColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** The piece in its burst color: a watermelon slice, a strawberry or a cactus with two arms. */
function pieceIconSvg(type: keyof typeof OBSTACLE_COLORS): string {
  const color = hexColor(OBSTACLE_COLORS[type]);
  const outline = 'stroke="#16324f" stroke-width="2" stroke-linejoin="round"';
  const shapes: Record<keyof typeof OBSTACLE_COLORS, string> = {
    watermelon: `<path d="M4 14 A16 16 0 0 0 36 14 Z" fill="#2e7d32" ${outline} /><path d="M8 14 A12 12 0 0 0 32 14 Z" fill="${color}" /><circle cx="15" cy="19" r="1.5" fill="#16324f" /><circle cx="25" cy="19" r="1.5" fill="#16324f" /><circle cx="20" cy="23" r="1.5" fill="#16324f" />`,
    strawberry: `<path d="M20 37 C8 28 7 15 13 12 C16 10 24 10 27 12 C33 15 32 28 20 37 Z" fill="${color}" ${outline} /><path d="M13 12 L17 5 L20 10 L23 5 L27 12 Z" fill="#43a047" ${outline} />`,
    cactus: `<path d="M16 37 V9 a4 4 0 0 1 8 0 V37 Z M16 24 H10 V15 a3 3 0 0 1 6 0 Z M24 20 H30 V12 a3 3 0 0 1 6 0 V22 a2 2 0 0 1 -2 2 H24 Z" fill="${color}" ${outline} />`,
  };
  return `<svg class="hud-target-icon" viewBox="0 0 40 40" aria-hidden="true">${shapes[type]}</svg>`;
}
