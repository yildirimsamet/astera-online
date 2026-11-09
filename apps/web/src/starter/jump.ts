import { useSyncExternalStore } from 'react';
import type { VesselHull, VesselLook } from '@astera/rules';
import type { Landing } from '../api/starterSchemas.js';
import type { JumpWorld } from './jumpWorld.js';
import type { Weight } from '../lib/haptics.js';
import type { SoundCue } from '../lib/sound.js';

export type BeatId = 'lit' | 'leaving' | 'gap' | 'fall' | 'world';

/** The scene's five moments, in seconds. Plan §3.8. */
export const BEATS: readonly { id: BeatId; from: number; to: number }[] = [
  { id: 'lit', from: 0, to: 5 },
  { id: 'leaving', from: 5, to: 10 },
  { id: 'gap', from: 10, to: 18 },
  { id: 'fall', from: 18, to: 23 },
  { id: 'world', from: 23, to: 25 },
];

export const SCENE_SECONDS = 25;
/**
 * THE JUMP'S LAYER, the one thing over the loading cover (playtest 2026-11-09): the planet loads under
 * the scene's last beats. The galaxy view flying the ship sits here, the scene's words one above.
 */
export const JUMP_LAYER = 1001;
/** When the session moves to the planet underneath: the game loads behind the last beat. */
export const REVEAL_SECOND = 20;
export const fromTheLanding = BEATS.find(beat => beat.id === 'fall')!.from;

export const beatAt = (seconds: number) => BEATS.find(beat => seconds < beat.to) ?? BEATS.at(-1)!;

/** The result is on the server before the first frame. A scene cut short only owes its ending. */
export const sceneStart = (how: 'pressed' | 'cut'): number => (how === 'pressed' ? 0 : fromTheLanding);

export interface Jump {
  shardName: string;
  hull: VesselHull;
  look: VesselLook;
  /** The galaxies it crosses, from what this client holds; nothing to fly through before they are read. */
  world: JumpWorld | null;
  landing: Landing | null;
  /** Past `REVEAL_SECOND` the session is on the planet and the scene is only fading out. */
  stage: 'flight' | 'reveal';
  start: number;
  /** The scene's zero on `performance.now()`: a remount carries on and does not begin again. */
  origin: number;
  /** Watched again from the card: this one can be skipped. */
  replay?: boolean;
  /**
   * Flown in the player's own galaxy view, from where the ship stands (owner, 2026-11-09: "farklı bir
   * animasyon filmi oynuyor gibi"). Only the press: a replay or a cut ending plays over the planet.
   */
  inGame?: boolean;
  /** When, on the scene's clock, the main view drew its first full frame under the still. */
  drawnAt?: number;
}

/**
 * When the camera stands where the main game opens: two seconds after the ship is gone (owner,
 * 2026-11-09: the wait after the flight was too long). Its clock is `JUMP_FLIGHT.gone`, 19.4.
 */
export const CAMERA_SETTLED = 21.6;
/** In the game, the session moves once the camera has settled there. */
const IN_GAME_REVEAL = CAMERA_SETTLED + 0.2;
/** The still of that frame holds at least this long, and gives way over a second. */
const STILL_BEAT = 0.6;
const STILL_FADE = 1;
/** A main view that never says it drew does not keep the still up: its own cover gives up at 7 s. */
const STILL_LONGEST = 8;
const IN_GAME_END = IN_GAME_REVEAL + STILL_LONGEST + STILL_FADE;

/** How long the move waits for a still a slow phone has not taken yet. */
const STILL_WAIT = 1;
/** Whether the session may move now: in the game, only over the still, or a second late without it. */
export const mayReveal = (current: Jump, s: number, hasStill: boolean): boolean => {
  const reveal = revealSecond(current);
  return s >= reveal && (!current.inGame || hasStill || s >= reveal + STILL_WAIT);
};

/** The still over the moving session: held until the main view has drawn, then faded off. */
export function stillFade(s: number, reveal: number, drawnAt: number | null): { opacity: number; done: boolean } {
  const from = Math.max(drawnAt ?? reveal + STILL_LONGEST, reveal + STILL_BEAT);
  const opacity = Math.min(1, Math.max(0, 1 - (s - from) / STILL_FADE));
  return { opacity, done: opacity <= 0 };
}
/** How far the still closes on the world while it waits. */
const STILL_PUSH = 0.07;
/** The still's scale: closing slowly while it waits, back to the game's framing as it fades. */
export function stillScale(s: number, reveal: number, opacity: number): number {
  const k = Math.min(1, Math.max(0, (s - reveal) / 6));
  return 1 + STILL_PUSH * (1 - (1 - k) * (1 - k)) * opacity;
}
export const revealSecond = (current: Jump): number => (current.inGame ? IN_GAME_REVEAL : REVEAL_SECOND);
export const sceneSeconds = (current: Jump): number => (current.inGame ? IN_GAME_END : SCENE_SECONDS);

/** What the scene sounds and feels like, on its own clock. Silent, it would be a picture of leaving. */
export interface SceneCue { at: number; sound: SoundCue; seconds?: number; haptic: Weight }
const SCENE_CUES: readonly SceneCue[] = [
  // The drive catches and roars until the ship moves.
  { at: 0, sound: 'ignite', seconds: 5, haptic: 'rumble' },
  { at: 6, sound: 'launch', haptic: 'commit' },
  // Spooled so its drop lands on the flash where the ship gives itself up.
  { at: 18.6, sound: 'warp', haptic: 'warp' },
  { at: 23, sound: 'claim', haptic: 'commit' },
];

/** Outside React so a landing outlives the screen that pressed it, which unmounts at once. */
let jump: Jump | null = null;
/** Pressed and not yet answered. The server seats the commander before it answers (§5.8). */
let pressed = false;
/** How far into the scene its cues have sounded: once each, whatever remounts. */
let heard = 0;
/** The flight's last frame, held over the planet while the session moves under it. */
let still: string | null = null;
const listeners = new Set<() => void>();
const tell = () => { for (const listen of listeners) listen(); };

const PLAYED_KEY = 'astera:jump-scene-played';

/** Survives a reload of this tab, so a scene cut short owes its ending once and no more. */
export const scenePlayed = (): boolean => {
  try { return window.sessionStorage.getItem(PLAYED_KEY) !== null; } catch { return false; }
};
const markScenePlayed = (): void => {
  try { window.sessionStorage.setItem(PLAYED_KEY, '1'); } catch { /* A repeated ending is harmless. */ }
};

/** The press starts at the top with the game gone; the ending and a replay play over the planet. */
export const startJump = (next: Omit<Jump, 'stage' | 'origin'>): void => {
  markScenePlayed();
  pressed = false;
  heard = next.start - 0.001;
  still = null;
  jump = { ...next, stage: next.start === 0 && !next.replay ? 'flight' : 'reveal', origin: performance.now() - next.start * 1000 };
  tell();
};
export const revealJump = (): void => { if (jump) { jump = { ...jump, stage: 'reveal' }; tell(); } };
export const endJump = (): void => { jump = null; still = null; tell(); };
export const holdJumpStill = (frame: string): void => { still = frame; tell(); };
/** The main view under the still has drawn a full frame. Only after the session moved, and once. */
export const markGameDrawn = (): void => {
  if (jump?.stage !== 'reveal' || jump.drawnAt !== undefined) return;
  jump = { ...jump, drawnAt: (performance.now() - jump.origin) / 1000 };
  tell();
};
export const currentJump = (): Jump | null => jump;

/** The press: from here until the scene reveals, only the scene moves the session (playtest 2026-11-09). */
export const pressJump = (): void => { pressed = true; tell(); };
/** A refused or failed press: the ship is as it was. */
export const releaseJump = (): void => { if (pressed) { pressed = false; tell(); } };

/**
 * WHETHER THE SCENE OWNS THE SESSION. The seat is taken, and announced on the stream, before the press
 * is answered: moving on that word unmounted the screen that starts the scene, and the player saw only
 * its last seven seconds. From the press through the flight nothing moves the session; at the reveal the
 * scene moves it itself, and until it stands on the planet the ship is not drawn under the fade.
 */
export const sceneOwnsSession = (current: Jump | null, isPressed: boolean, onShip: boolean): boolean =>
  isPressed || (current !== null && !current.replay && (current.stage === 'flight' || onShip));
/** Whether the game is hidden under the scene: not while a ship flies in the game itself. */
export const gameCovered = (current: Jump | null, onShip: boolean): boolean =>
  sceneOwnsSession(current, false, onShip) && !(current?.inGame && current.stage === 'flight');
/** For whatever would move the session: not now. The reveal's own move is not held. */
export const jumpHoldsSession = (): boolean => sceneOwnsSession(jump, pressed, false);

/** The cues the scene has reached since it last asked. */
/** A cue missed by more than this (a locked phone, a hidden tab) is past: it is not played late. */
const CUE_LATE = 1.5;
export const takeCues = (seconds: number): readonly SceneCue[] => {
  const due = SCENE_CUES.filter(cue => cue.at > heard && cue.at <= seconds && seconds - cue.at <= CUE_LATE);
  heard = Math.max(heard, seconds);
  return due;
};

const subscribe = (listen: () => void) => { listeners.add(listen); return () => { listeners.delete(listen); }; };
export const useJump = (): Jump | null => useSyncExternalStore(subscribe, () => jump);
export const useJumpPressed = (): boolean => useSyncExternalStore(subscribe, () => pressed);
export const useJumpStill = (): string | null => useSyncExternalStore(subscribe, () => still);
