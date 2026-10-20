import { texts } from '../texts';

/** The FPS shown is the average over this window. */
const FPS_WINDOW_SECONDS = 0.5;

export interface Stats {
  update(dt: number, cutCount: number, bladeCount: number): void;
}

/** A fixed corner counter with FPS and cut blades. */
export function createStats(container: HTMLElement): Stats {
  const panel = document.createElement('div');
  panel.className = 'debug-stats';
  container.appendChild(panel);

  let windowSeconds = 0;
  let windowFrames = 0;
  let fps = 0;

  function update(dt: number, cutCount: number, bladeCount: number): void {
    windowSeconds += dt;
    windowFrames++;
    if (windowSeconds >= FPS_WINDOW_SECONDS) {
      fps = Math.round(windowFrames / windowSeconds);
      windowSeconds = 0;
      windowFrames = 0;
    }
    panel.textContent = `${texts.debug.fps}: ${fps}\n${texts.debug.bladesCut}: ${cutCount} / ${bladeCount}`;
  }

  return { update };
}
