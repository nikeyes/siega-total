import GUI from 'lil-gui';
import { config } from '../config';
import { cutAllTargets, remainingTargets, type Game } from '../logic/game';
import { texts } from '../texts';

/** The FPS shown is the average over this window. */
const FPS_WINDOW_SECONDS = 0.5;

/** Settings read only when the level restarts; the panel labels them so. */
const READ_ON_RESTART = new Set(['blade.startSize', 'level.timeSeconds']);
/** Settings that need the field built again, so the panel leaves them out. */
const NOT_TUNABLE = new Set(['level.stripeWidthMeters']);

export interface DebugPanel {
  update(dt: number): void;
}

export interface DebugActions {
  restart(): void;
  /** Shows the given blades as cut on the field. */
  markCut(indices: number[]): void;
}

/** lil-gui panel to tune `config` live, jump to the end of the level and watch the game. */
export function createDebugPanel(game: Game, actions: DebugActions): DebugPanel {
  const gui = new GUI();

  addNumberFolder(gui, 'blade', config.blade);
  addNumberFolder(gui, 'camera', config.camera);
  addNumberFolder(gui, 'level', config.level, (key, value) => {
    if (key === 'timeSeconds') game.level.timeSeconds = value;
  });
  const grassFolder = gui.addFolder('grassTypes');
  for (const [type, settings] of Object.entries(config.grassTypes)) addNumberFolder(grassFolder, type, settings);
  grassFolder.close();

  gui.add({ [texts.debug.win]: () => actions.markCut(cutAllTargets(game).blades) }, texts.debug.win);
  gui.add({ [texts.debug.threeSeconds]: () => (game.timeLeft = 3) }, texts.debug.threeSeconds);
  gui.add({ [texts.debug.restart]: () => actions.restart() }, texts.debug.restart);
  gui.add(
    { [texts.debug.copyConfig]: () => void navigator.clipboard.writeText(JSON.stringify(config, null, 2)) },
    texts.debug.copyConfig,
  );

  const monitor = { fps: 0, bladesCut: '', targetsLeft: 0, status: '' };
  const monitorFolder = gui.addFolder('monitor');
  monitorFolder.add(monitor, 'fps').name(texts.debug.fps).disable().listen();
  monitorFolder.add(monitor, 'bladesCut').name(texts.debug.bladesCut).disable().listen();
  monitorFolder.add(monitor, 'targetsLeft').name(texts.debug.targetsLeft).disable().listen();
  monitorFolder.add(monitor, 'status').name(texts.debug.status).disable().listen();

  let windowSeconds = 0;
  let windowFrames = 0;

  function update(dt: number): void {
    windowSeconds += dt;
    windowFrames++;
    if (windowSeconds >= FPS_WINDOW_SECONDS) {
      monitor.fps = Math.round(windowFrames / windowSeconds);
      windowSeconds = 0;
      windowFrames = 0;
    }
    monitor.bladesCut = `${game.field.cutCount} / ${game.field.bladeCount}`;
    monitor.targetsLeft = remainingTargets(game);
    monitor.status = game.status;
  }

  return { update };
}

/** One numeric control per value of `settings`, in a folder called `name`. */
function addNumberFolder(
  parent: GUI,
  name: string,
  settings: Record<string, number>,
  onChange: (key: string, value: number) => void = () => {},
): void {
  const folder = parent.addFolder(name);
  for (const key of Object.keys(settings)) {
    const path = `${name}.${key}`;
    if (NOT_TUNABLE.has(path)) continue;
    const label = READ_ON_RESTART.has(path) ? `${key} ${texts.debug.onRestart}` : key;
    folder.add(settings, key).name(label).onChange((value: number) => onChange(key, value));
  }
  folder.close();
}
