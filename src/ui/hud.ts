import type { GrassType } from '../logic/field';
import { GRASS_COLORS } from '../render/grassColors';
import { texts } from '../texts';
import { formatClock } from './clock';

/** The size pill hangs this far below the blade's center on screen, clear of the blade itself. */
const SIZE_PILL_OFFSET_PX = 34;
const ICON_SPIKES = 5;

export interface HudState {
  timeLeft: number;
  timeTotal: number;
  /** 1 − targetProgress: the bar starts full and empties as the target is cut. */
  remainingFraction: number;
  size: number;
  growthFraction: number;
  /** Where the size pill hangs from, in container pixels (the blade on screen). */
  sizeLabelX: number;
  sizeLabelY: number;
}

/** What the HUD shows, rounded to what the player can tell apart, so equal displays need no DOM writes. */
export interface HudDisplay {
  clock: string;
  timePercent: number;
  targetPercent: number;
  sizeLabel: string;
  growthPercent: number;
  sizeLabelX: number;
  sizeLabelY: number;
}

export function hudDisplay(state: HudState): HudDisplay {
  return {
    clock: formatClock(state.timeLeft),
    timePercent: toPercent(state.timeLeft / state.timeTotal),
    targetPercent: toPercent(state.remainingFraction),
    sizeLabel: `${texts.hud.size} ${state.size}`,
    growthPercent: toPercent(state.growthFraction),
    sizeLabelX: Math.round(state.sizeLabelX),
    sizeLabelY: Math.round(state.sizeLabelY),
  };
}

function toPercent(fraction: number): number {
  return Math.round(fraction * 100);
}

export interface Hud {
  update(state: HudState): void;
}

/** Timer and target card at the top left, and the size pill that follows the blade. */
export function createHud(container: HTMLElement, target: GrassType): Hud {
  const top = element('div', 'hud');
  const timer = element('div', 'hud-timer');
  const clock = element('span', 'hud-timer-text');
  timer.append(clock);
  const card = element('div', 'hud-target');
  card.innerHTML = tuftIconSvg(target);
  const bar = element('div', 'hud-bar');
  const barFill = element('div', 'hud-bar-fill');
  bar.append(barFill);
  card.append(bar);
  top.append(timer, card);

  const pill = element('div', 'hud-size');
  const pillFill = element('div', 'hud-size-fill');
  const pillText = element('span', 'hud-size-text');
  pill.append(pillFill, pillText);
  container.append(top, pill);

  let shown: Partial<HudDisplay> = {};

  function update(state: HudState): void {
    const display = hudDisplay(state);
    if (display.clock !== shown.clock) clock.textContent = display.clock;
    if (display.timePercent !== shown.timePercent) timer.style.setProperty('--time-percent', `${display.timePercent}%`);
    if (display.targetPercent !== shown.targetPercent) barFill.style.width = `${display.targetPercent}%`;
    if (display.sizeLabel !== shown.sizeLabel) pillText.textContent = display.sizeLabel;
    if (display.growthPercent !== shown.growthPercent) pillFill.style.width = `${display.growthPercent}%`;
    if (display.sizeLabelX !== shown.sizeLabelX || display.sizeLabelY !== shown.sizeLabelY) {
      pill.style.transform = `translate(calc(${display.sizeLabelX}px - 50%), ${display.sizeLabelY + SIZE_PILL_OFFSET_PX}px)`;
    }
    shown = display;
  }

  return { update };
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
