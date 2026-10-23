import { createBreezeSound } from './audio/breeze';
import { createCutBreeze } from './audio/cutBreeze';
import { createMusicPlayer } from './audio/music';
import { musicStyleFor, type Screen } from './audio/musicStyle';
import { createSoundPlayer, type SoundName } from './audio/sounds';
import { canVibrate, createVibration } from './audio/vibration';
import { campaignSeeds } from './campaign';
import { config } from './config';
import type { DebugPanel, QualityStatus } from './debug/panel';
import { dominantGrassType } from './logic/biome';
import { bladeRadius, growthFraction } from './logic/blade';
import { GRASS_TYPE_ORDER } from './logic/field';
import { clampFocus, createCameraFocus, followBlade } from './logic/camera';
import { buyBooster, canUseBooster, continueWithClock, nearestTarget, useBooster } from './logic/boosters';
import { bankCoins, unbankedCoins } from './logic/economy';
import { createFeedbackTracker, type FeedbackEvent } from './logic/feedback';
import {
  createGame,
  remainingByTarget,
  resetGame,
  shouldHighlightTargets,
  stepGame,
  targetGrassTypes,
  type Game,
} from './logic/game';
import type { LevelDefinition } from './logic/levels';
import { levelFor } from './logic/progression';
import { defaultSave, type BoosterKind } from './logic/save';
import { bonusesFor, buyUpgrade } from './logic/upgrades';
import { createQualityMonitor, nextQualitySetting, qualityForAttempt, type QualityLevel } from './logic/quality';
import { createBurstView, type BurstView } from './render/burst';
import { clippingBlades, clippingOptions } from './render/clippings';
import { createGroundClippings } from './render/groundClippings';
import { GRASS_COLORS } from './render/grassColors';
import { createGroundRing } from './render/groundRing';
import { sizeUpRing } from './render/ringMath';
import { OBSTACLE_COLORS } from './render/obstacleColors';
import { loadObstacleModels, placeholderObstacleModels, type ObstacleModels } from './render/obstacleModels';
import { createObstacleView, type ObstacleView } from './render/obstacles';
import { combineDirections } from './logic/input';
import { createBladeGlow } from './render/bladeGlow';
import { createBladeView } from './render/blade';
import { createCompassView } from './render/compass';
import { createCameraRig, halfVisible } from './render/cameraRig';
import { createGrassView, type GrassView } from './render/grass';
import { createGameScene } from './render/scene';
import { createSea } from './render/sea';
import { countGameStarted } from './stats/visits';
import { createHud } from './ui/hud';
import { createJoystick } from './ui/joystick';
import { createKeyboard } from './ui/keyboard';
import { createBlockedNotice } from './ui/blockedNotice';
import { createCelebration } from './ui/celebration';
import { createVictorySequence } from './ui/victorySequence';
import { createCoinFloats } from './ui/coinFloats';
import { createHomeScreen } from './ui/home';
import { setLayerVisible } from './ui/layer';
import { createPauseScreen } from './ui/pause';
import { createResultOverlay } from './ui/result';
import { createSettingsScreen } from './ui/settings';
import { createShopScreen } from './ui/shop';
import { clearSave, readSave, writeSave } from './ui/storage';
import { createTutorialHint } from './ui/tutorial';
import './ui/styles.css';

/** Longest step the game takes, so coming back to the tab does not make the blade jump. */
const MAX_FRAME_SECONDS = 0.05;
/** Burst pieces thrown when a piece of each kind is cut; a cactus is bigger, so it throws more. */
const BURST_PIECES = { watermelon: 12, strawberry: 12, cactus: 24 } as const;
const SIZE_UP_RING_COLOR = 0xffffff;
const WAVE_RING_COLOR = 0xfff3b0;
const WAVE_RING_OPACITY = 0.8;
/** Entries kept in the ?debug feedback log. */
const FEEDBACK_LOG_LENGTH = 200;

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container');

const debugging = new URLSearchParams(location.search).has('debug');

/** Debug only: every sound and buzz actually sent out, so automated browser checks can read them. */
interface FeedbackLogEntry {
  kind: 'sound' | 'vibration';
  name: string;
  rate?: number;
  at: number;
}
const feedbackLog: FeedbackLogEntry[] = [];
function logFeedback(entry: FeedbackLogEntry): void {
  feedbackLog.push(entry);
  if (feedbackLog.length > FEEDBACK_LOG_LENGTH) feedbackLog.shift();
}
const logSound = (name: SoundName, rate: number) => logFeedback({ kind: 'sound', name, rate, at: performance.now() });
const logVibration = () => logFeedback({ kind: 'vibration', name: 'pulse', at: performance.now() });

const soundPlayer = createSoundPlayer(import.meta.env.BASE_URL + 'sounds/', debugging ? logSound : undefined);
const vibration = createVibration(debugging ? logVibration : undefined);
const breezeSound = createBreezeSound(soundPlayer.context);
const cutBreeze = createCutBreeze();
const musicPlayer = createMusicPlayer(soundPlayer.context);
const feedback = createFeedbackTracker();
// One listener for every button on every screen, so none of them needs its own.
container.addEventListener('click', (event) => {
  if ((event.target as Element).closest('button')) soundPlayer.play('tap');
});

const gameScene = createGameScene(container, config.field.width, config.field.depth);
const sea = createSea(gameScene.scene, config.field.width, config.field.depth);
const burst = createBurstView(gameScene.scene);
const qualityMonitor = createQualityMonitor();
const groundClippings = createGroundClippings(gameScene.scene, config.quality.groundClippings);
/** The quality the current attempt was built with; null until the first one. */
let quality: QualityLevel | null = null;
/** Bits of cut grass, rebuilt when the quality changes. */
let clippings: BurstView | null = null;
const sizeUpRingView = createGroundRing(gameScene.scene, SIZE_UP_RING_COLOR);
const waveRingView = createGroundRing(gameScene.scene, WAVE_RING_COLOR);
/** Seconds since the blade last grew; Infinity when its ring is not showing. */
let sizeUpAge = Infinity;
const blockedNotice = createBlockedNotice();
const coinFloats = createCoinFloats();
const bladeView = createBladeView(gameScene.scene);
const bladeGlow = createBladeGlow(gameScene.scene);

/** Builds the next attempt at `next`: pixel ratio, blade shadow and clippings; the ground and the air are always swept clean. */
function applyQuality(next: QualityLevel): void {
  groundClippings.clear();
  clippings?.clear();
  if (next === quality) return;
  quality = next;
  const settings = config.quality.levels[next];
  gameScene.setMaxPixelRatio(settings.maxPixelRatio);
  bladeView.setShadowVisible(settings.shadow);
  sea.setAnimated(next !== 'low');
  clippings?.dispose();
  clippings = createBurstView(gameScene.scene, {
    ...clippingOptions(next),
    onExpire: settings.clippings === 'persistent' ? groundClippings.place : undefined,
  });
}
const compassView = createCompassView(gameScene.scene);
const cameraRig = createCameraRig();
const joystick = createJoystick(container);
const keyboard = createKeyboard();
const hud = createHud(container, {
  onPause: () => showScreen('paused'),
  onBooster: (kind) => {
    // A used booster is saved at once, so reloading does not give it back.
    if (screen === 'playing' && useBooster(save, game, kind)) writeSave(save);
  },
});
const resultOverlay = createResultOverlay(container, {
  onContinue: () => {
    if (!continueWithClock(save, game)) return;
    writeSave(save);
    showScreen('playing');
  },
  onNext: () => {
    loadLevel(save.level);
    showScreen('playing');
  },
  onRetry: () => {
    restart();
    showScreen('playing');
  },
  onShop: () => openShop('result'),
  onHome: () => {
    // A win moved the saved level on; a defeat plays the same level again.
    if (game.status === 'won') loadLevel(save.level);
    else restart();
    showScreen('home');
  },
});
const homeScreen = createHomeScreen(container, {
  onPlay: () => {
    // Builds the game again, so upgrades bought from the home screen apply to it.
    if (game.level.number === save.level) restart();
    else loadLevel(save.level);
    showScreen('playing');
  },
  onShop: () => openShop('home'),
  onSettings: () => openSettings('home'),
});
const shopScreen = createShopScreen(container, {
  onBuyUpgrade: (kind) => {
    if (!buyUpgrade(save, kind)) return;
    writeSave(save);
    renderSave();
  },
  onBuyBooster: (kind) => {
    if (!buyBooster(save, kind)) return;
    writeSave(save);
    renderSave();
  },
  onBack: () => showScreen(shopReturnsTo),
});
const pauseScreen = createPauseScreen(container, {
  onResume: () => showScreen('playing'),
  onRetry: () => {
    restart();
    showScreen('playing');
  },
  onSettings: () => openSettings('paused'),
  onHome: () => {
    // Leaving drops the coins of this attempt: only the end of a level banks them.
    restart();
    showScreen('home');
  },
});
const settingsScreen = createSettingsScreen(
  container,
  {
    onToggleSound: () => {
      save.settings.sound = !save.settings.sound;
      saveSettings();
    },
    onToggleMusic: () => {
      save.settings.music = !save.settings.music;
      saveSettings();
    },
    onSoundVolume: (position) => {
      save.settings.soundVolume = position;
      saveSettings();
    },
    onMusicVolume: (position) => {
      save.settings.musicVolume = position;
      saveSettings();
    },
    onToggleVibration: () => {
      save.settings.vibration = !save.settings.vibration;
      saveSettings();
    },
    onCycleQuality: () => {
      // Applies from the next attempt, so the level in play never changes under the player.
      save.settings.quality = nextQualitySetting(save.settings.quality);
      saveSettings();
    },
    onClearProgress: clearProgress,
    onBack: () => showScreen(settingsReturnsTo),
  },
  canVibrate(),
);
const tutorialHint = createTutorialHint(container);
// Last in the container, so the confetti falls over the result layer.
const celebration = createCelebration(container);
/** After a win: the result's stars, each with its note, then the confetti and the coin rain. */
const victorySequence = createVictorySequence({
  onStep: (step) => {
    if (step.kind === 'star') {
      soundPlayer.play(`star${step.index}`);
      return;
    }
    soundPlayer.play('confetti');
    celebration.play(game.level.seed);
  },
});

/** What the player sees; the game only steps while it is 'playing' or showing the result. */
let screen: Screen = 'home';
/** The shop's «Volver» goes back to where it was opened from. */
let shopReturnsTo: 'home' | 'result' = 'home';
/** The settings' «Volver» goes back to where they were opened from, so a paused level stays paused. */
let settingsReturnsTo: 'home' | 'paused' = 'home';
const SCREEN_LAYERS: Partial<Record<Screen, HTMLElement>> = {
  home: homeScreen.layer,
  paused: pauseScreen.layer,
  result: resultOverlay.layer,
  shop: shopScreen.layer,
  settings: settingsScreen.layer,
};

function showScreen(next: Screen): void {
  screen = next;
  // The CSS hides the HUD on the screens away from the game.
  container!.dataset.screen = next;
  if (next !== 'result') {
    victorySequence.cancel();
    celebration.clear();
  }
  for (const [name, layer] of Object.entries(SCREEN_LAYERS)) setLayerVisible(layer, name === next);
  renderSave();
  updateMusic();
}

function openShop(from: 'home' | 'result'): void {
  shopReturnsTo = from;
  showScreen('shop');
}

function openSettings(from: 'home' | 'paused'): void {
  settingsReturnsTo = from;
  showScreen('settings');
}

/** Redraws what shows the save: the balance and level on the home screen, the shop rows and the settings. */
function renderSave(): void {
  homeScreen.render(save);
  shopScreen.render(save);
  settingsScreen.render(save, quality!);
}

let save = readSave();
applySettings();

/** Turns sound, music and vibration on or off and sets the volumes, as the save says. */
function applySettings(): void {
  soundPlayer.setEnabled(save.settings.sound);
  soundPlayer.setVolume(save.settings.soundVolume);
  breezeSound.setEnabled(save.settings.sound);
  breezeSound.setVolume(save.settings.soundVolume);
  musicPlayer.setVolume(save.settings.musicVolume);
  vibration.setEnabled(save.settings.vibration);
  updateMusic();
}

/** The music plays unless it is switched off, the game is paused or the tab is hidden; the menus play their calmer style. */
function updateMusic(): void {
  musicPlayer.setStyle(musicStyleFor(screen));
  musicPlayer.setPlaying(save.settings.music && screen !== 'paused' && !document.hidden);
}

/** Keeps a changed setting: saves it, applies it at once and redraws the switches and sliders. */
function saveSettings(): void {
  writeSave(save);
  applySettings();
  renderSave();
}

let game: Game;
let grass: GrassView | null = null;
let obstacleView: ObstacleView | null = null;
/** Shared by every level; the Kenney models replace the stand-ins once they load. */
let obstacleModels: ObstacleModels = placeholderObstacleModels();
const focus = createCameraFocus(0, 0, config.blade.startSize);

/** Swaps in a new level: frees the old views and builds new ones for its grass and obstacles. */
function playLevel(level: LevelDefinition): void {
  grass?.dispose();
  obstacleView?.dispose();
  applyQuality(qualityForAttempt(save.settings.quality, qualityMonitor));
  game = createGame(level, bonusesFor(save.upgrades), config.quality.levels[quality!].bladeCount);
  sizeUpAge = Infinity;
  // Tracked before its first step, so a key held through «Siguiente» or «Reintentar» still gives started.
  feedback.track(game);
  // Until the first move, every new level brings the hand back; the CSS only shows it while playing.
  if (save.tutorialDone) tutorialHint.hide();
  else tutorialHint.show();
  const biome = dominantGrassType(level.cells);
  gameScene.setBiome(biome);
  bladeGlow.setBiome(biome);
  grass = createGrassView(gameScene.scene, game.field, level.seed);
  obstacleView = createObstacleView(gameScene.scene, level.obstacles, obstacleModels, level.seed);
  hud.showLevel(level);
  focusOnBlade();
}

/** Plays level `levelNumber` of the progression. */
function loadLevel(levelNumber: number): void {
  playLevel(levelFor(levelNumber, campaignSeeds));
}

/** Plays the level again from the start, with the upgrades bought since it was created. */
function restart(): void {
  playLevel(game.level);
}

/** Adds what the level earned to the balance and, after a win, moves the saved level on. */
function saveLevelEnd(): void {
  save.coins += bankCoins(game);
  if (game.status === 'won' && game.level.number >= 1) save.level = game.level.number + 1;
  writeSave(save);
}

/** Forgets the saved game and starts over from level 1, on the home screen. */
function clearProgress(): void {
  clearSave();
  save = defaultSave();
  applySettings();
  loadLevel(1);
  showScreen('home');
}

function focusOnBlade(): void {
  const { blade } = game;
  Object.assign(focus, createCameraFocus(blade.x, blade.z, blade.size));
}

loadLevel(save.level);
showScreen('home');

// Hiding the tab mid-level pauses it, so the clock does not run out unseen.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'playing' && game.status === 'playing') showScreen('paused');
  // A hidden tab draws no frames, so the sounds that follow the frames are silenced here.
  if (document.hidden) breezeSound.setBlowing(false);
  updateMusic();
});

loadObstacleModels(import.meta.env.BASE_URL + 'models/').then(
  (loaded) => {
    obstacleModels = loaded;
    // Redraws the current level's obstacles with the real models, keeping the ones already cut hidden.
    obstacleView!.dispose();
    obstacleView = createObstacleView(gameScene.scene, game.level.obstacles, obstacleModels, game.level.seed);
    obstacleView.markCut([...game.obstacles.cut.keys()].filter((index) => game.obstacles.cut[index] === 1));
  },
  (error: unknown) => console.warn('Obstacle models failed to load; keeping the stand-ins.', error),
);

let debugPanel: DebugPanel | null = null;
if (debugging) {
  // Debug only: exposes the current game so automated browser checks can read blade position and cutCount.
  Object.defineProperty(window, '__siega', { get: () => game });
  Object.defineProperty(window, '__siegaFeedback', { value: feedbackLog });
  Object.defineProperty(window, '__siegaQuality', { get: qualityStatus });
  void import('./debug/panel').then(({ createDebugPanel }) => {
    debugPanel = createDebugPanel(() => game, {
      restart: () => {
        restart();
        showScreen('playing');
      },
      markCut: ({ blades, obstacles }) => {
        grass!.markCut(blades, elapsedSeconds);
        obstacleView!.markCut(obstacles);
      },
      playLevel: (level) => {
        playLevel(level);
        showScreen('playing');
      },
      giveCoins: (amount) => {
        save.coins += amount;
        writeSave(save);
        renderSave();
      },
      clearSave: clearProgress,
      resetTutorial: () => {
        save.tutorialDone = false;
        writeSave(save);
      },
      playSound: (name, variant) => soundPlayer.play(name, variant),
    }, qualityStatus);
  });
}

/** Debug only: what the quality is set to, what the current attempt uses and what it measured. */
function qualityStatus(): QualityStatus {
  return {
    setting: save.settings.quality,
    level: quality!,
    measuredFps: qualityMonitor.measuredFps(),
    pixelRatio: gameScene.renderer.getPixelRatio(),
    shadow: config.quality.levels[quality!].shadow,
  };
}

function fitToContainer(): void {
  gameScene.resize();
  cameraRig.setAspect(container!.clientWidth / container!.clientHeight);
}
window.addEventListener('resize', fitToContainer);
fitToContainer();

function boosterState(kind: BoosterKind): { uses: number; usable: boolean } {
  return { uses: save.boosters[kind], usable: screen === 'playing' && canUseBooster(game, kind) };
}

let compassPointsAt: { x: number; z: number } | null = null;
let secondsSinceRetarget = Infinity;

/** While the compass points, the nearest standing target, looked up again every retargetSeconds. */
function compassTarget(dt: number): { x: number; z: number } | null {
  if (game.compassLeft <= 0) {
    secondsSinceRetarget = Infinity;
    return null;
  }
  secondsSinceRetarget += dt;
  if (secondsSinceRetarget >= config.boosters.compass.retargetSeconds) {
    secondsSinceRetarget = 0;
    compassPointsAt = nearestTarget(game, game.blade.x, game.blade.z);
  }
  return compassPointsAt;
}

/** The sound and buzz of each feedback event; the cut zip follows its own rhythm. */
function playFeedback(event: FeedbackEvent): void {
  switch (event.kind) {
    case 'obstacleHit':
      soundPlayer.play('fruitHit');
      break;
    case 'obstacleCut':
      soundPlayer.play(`${event.obstacle}Break`);
      break;
    case 'sizeUp':
      sizeUpAge = 0;
      soundPlayer.play('sizeUp');
      vibration.pulse();
      break;
    case 'lowTime':
      soundPlayer.play('lowTime');
      break;
    case 'winWave':
      soundPlayer.play('levelComplete');
      break;
    case 'won':
      victorySequence.play();
      break;
    case 'lost':
      soundPlayer.play('lose');
      break;
    case 'started':
      countGameStarted();
      if (save.tutorialDone) break;
      tutorialHint.hide();
      save.tutorialDone = true;
      writeSave(save);
      break;
    case 'cut':
      break;
  }
}

let elapsedSeconds = 0;
let previousTimestamp: number | null = null;

gameScene.renderer.setAnimationLoop((timestamp: number) => {
  const realSeconds = previousTimestamp === null ? 0 : (timestamp - previousTimestamp) / 1000;
  previousTimestamp = timestamp;
  const dt = Math.min(realSeconds, MAX_FRAME_SECONDS);
  elapsedSeconds += dt;

  // Only played frames tell how the game runs; menus and the result overlay are cheaper to draw.
  if (screen === 'playing' && game.status === 'playing' && save.settings.quality === 'auto') {
    qualityMonitor.sampleFrame(debugPanel?.simulatedFrameSeconds() ?? realSeconds);
  }

  const { field, blade } = game;
  // Away from the game the scene keeps drawing, but no time passes for the logic.
  const stepping = screen === 'playing' || screen === 'result';
  const direction = screen === 'playing' ? combineDirections(joystick.getDirection(), keyboard.getDirection()) : null;
  const statusBefore = game.status;
  const result = stepGame(game, direction, stepping ? dt : 0);
  // Every frame, stepping or not, so the tracker never misses a change between frames.
  const events = feedback.step(game, result);
  breezeSound.setBlowing(cutBreeze.step(events.some((event) => event.kind === 'cut'), dt) && !document.hidden);
  for (const event of events) playFeedback(event);
  const sizeUpEvent = events.find((event) => event.kind === 'sizeUp');
  const showBlocked = blockedNotice.step(result.blocked, dt);
  const blockedSize = showBlocked ? result.neededSize : null;
  if (showBlocked) {
    soundPlayer.play('bounce');
    vibration.pulse();
  }
  grass!.markCut(result.cutIndices, elapsedSeconds);
  obstacleView!.markCut(result.cutObstacles);
  obstacleView!.markHit(result.hitObstacles, elapsedSeconds);
  for (const index of result.cutObstacles) {
    const { type, x, z } = game.level.obstacles[index]!;
    if (type !== 'rock') burst.spawn(x, z, OBSTACLE_COLORS[type], BURST_PIECES[type]);
  }
  // A hit chips a few pieces off; the break throws the rest.
  for (const index of result.hitObstacles) {
    const { type, x, z } = game.level.obstacles[index]!;
    if (type !== 'rock') burst.spawn(x, z, OBSTACLE_COLORS[type], Math.ceil(BURST_PIECES[type] / 4));
  }
  burst.update(dt);
  // The wave's cuts throw clippings too; the per-frame cap keeps it cheap.
  const { bladesPerClipping, maxClippingsPerFrame } = config.quality.levels[quality!];
  for (const index of clippingBlades(result.cutIndices, bladesPerClipping, maxClippingsPerFrame)) {
    const tip = GRASS_COLORS[GRASS_TYPE_ORDER[field.types[index]!]!].tip;
    clippings!.spawn(field.positionsX[index]!, field.positionsZ[index]!, tip, 1);
  }
  clippings!.update(dt);
  grass!.setHighlight(shouldHighlightTargets(game) ? targetGrassTypes(game) : []);
  if (game.status !== statusBefore && (game.status === 'won' || game.status === 'lost')) {
    saveLevelEnd();
    resultOverlay.show(game.status, { levelCoins: Math.floor(game.levelCoins), bonusCoins: game.bonusCoins }, save);
    showScreen('result');
  }

  followBlade(focus, blade.x, blade.z, blade.size, dt);
  const { halfVisibleX, halfVisibleZ } = halfVisible(focus.distance, cameraRig.camera.aspect);
  // The blade can reach the shore, so the camera follows it there.
  const edgeMargin = bladeRadius(blade.size) + config.camera.edgeMarginMeters + config.field.shoreMeters;
  clampFocus(focus, field.width, field.depth, halfVisibleX, halfVisibleZ, edgeMargin);

  bladeView.update(blade, dt);
  bladeGlow.update(blade);
  sizeUpAge += dt;
  const ring = sizeUpRing(sizeUpAge, bladeRadius(blade.size));
  sizeUpRingView.show(blade.x, blade.z, ring?.radius ?? 0, ring?.opacity ?? 0);
  const wave = game.status === 'winWave' ? game.winWave : null;
  waveRingView.show(wave?.x ?? 0, wave?.z ?? 0, wave?.radius ?? 0, wave ? WAVE_RING_OPACITY : 0);
  compassView.update(blade, compassTarget(dt));
  cameraRig.update(focus);
  grass!.setTime(elapsedSeconds);
  sea.update(elapsedSeconds);
  obstacleView!.update(elapsedSeconds);
  gameScene.renderer.render(gameScene.scene, cameraRig.camera);

  const bladeOnScreen = cameraRig.toScreen(blade.x, 0, blade.z, container.clientWidth, container.clientHeight);
  hud.update({
    playing: game.status === 'playing',
    timeLeft: game.timeLeft,
    timeTotal: game.timeTotal,
    remainingByTarget: remainingByTarget(game),
    size: blade.size,
    growthFraction: growthFraction(blade),
    sizeLabelX: bladeOnScreen.x,
    sizeLabelY: bladeOnScreen.y,
    blockedSize,
    // Banked coins are already in the balance, so only the rest of the level is added on top.
    coins: save.coins + unbankedCoins(game),
    floatCoins: coinFloats.step(result.coins, dt),
    sizeUp: sizeUpEvent?.size ?? null,
    boosters: {
      upgrade: boosterState('upgrade'),
      compass: boosterState('compass'),
      clock: boosterState('clock'),
    },
  });

  debugPanel?.update(realSeconds);
});
