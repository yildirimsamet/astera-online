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
}

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
  jump = { ...next, stage: next.start === 0 && !next.replay ? 'flight' : 'reveal', origin: performance.now() - next.start * 1000 };
  tell();
};
export const revealJump = (): void => { if (jump) { jump = { ...jump, stage: 'reveal' }; tell(); } };
export const endJump = (): void => { jump = null; tell(); };

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
/** For whatever would move the session: not now. The reveal's own move is not held. */
export const jumpHoldsSession = (): boolean => sceneOwnsSession(jump, pressed, false);

/** The cues the scene has reached since it last asked. */
export const takeCues = (seconds: number): readonly SceneCue[] => {
  const due = SCENE_CUES.filter(cue => cue.at > heard && cue.at <= seconds);
  heard = Math.max(heard, seconds);
  return due;
};

const subscribe = (listen: () => void) => { listeners.add(listen); return () => { listeners.delete(listen); }; };
export const useJump = (): Jump | null => useSyncExternalStore(subscribe, () => jump);
export const useJumpPressed = (): boolean => useSyncExternalStore(subscribe, () => pressed);
