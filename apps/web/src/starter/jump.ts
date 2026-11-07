import { useSyncExternalStore } from 'react';
import type { VesselHull, VesselLook } from '@astera/rules';
import type { Landing } from '../api/starterSchemas.js';

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
  /** The main galaxy's whole-number positions, already held by this client. */
  sky: readonly number[];
  landing: Landing | null;
  /** Past `REVEAL_SECOND` the session is on the planet and the scene is only fading out. */
  stage: 'flight' | 'reveal';
  start: number;
  /** The scene's zero on `performance.now()`: a remount carries on and does not begin again. */
  origin: number;
  /** Watched again from the card: this one can be skipped. */
  replay?: boolean;
}

/** Outside React so a landing outlives the screen that pressed it, which unmounts at once. */
let jump: Jump | null = null;
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
  jump = { ...next, stage: next.start === 0 && !next.replay ? 'flight' : 'reveal', origin: performance.now() - next.start * 1000 };
  tell();
};
export const revealJump = (): void => { if (jump) { jump = { ...jump, stage: 'reveal' }; tell(); } };
export const endJump = (): void => { jump = null; tell(); };

const subscribe = (listen: () => void) => { listeners.add(listen); return () => { listeners.delete(listen); }; };
export const useJump = (): Jump | null => useSyncExternalStore(subscribe, () => jump);
