import { useCallback, useEffect, useLayoutEffect, useSyncExternalStore } from 'react';
import { analyticsRecording, observe } from '../../lib/playerAnalytics/runtime.js';
import { attentionQuiet, emptyAttention, reduceAttention, type AttentionEvent, type AttentionSpec } from './queue.js';

/**
 * THE ONE QUEUE FOR SURFACES THAT OPEN BY THEMSELVES (plan 2026-11-20 §5.5). A module store rather
 * than a context: the live alerts that must stay quiet run above the game shell, the surfaces below it.
 *
 * It writes the measurement for every surface it manages (plan Faz 0): `surface_visible` when one is
 * shown, `surface_closed` with the player's choice when they close it, or `gone` when it went away
 * by itself. A surface therefore needs no telemetry of its own.
 */
let state = emptyAttention();
const listeners = new Set<() => void>();
let handsWatched = false;

function record(name: 'surface_visible' | 'surface_closed', properties: { surface: string; code?: string }): void {
  if (analyticsRecording()) observe(name, properties, 'live');
}

/** `code` names the choice that closed a surface (`act:<choice>` or `dismiss`); used with `release`. */
export function dispatchAttention(event: AttentionEvent, code = 'dismiss'): void {
  const before = state;
  state = reduceAttention(state, event);
  if (state === before) return;
  for (const id of before.shown) {
    if (!state.shown.has(id)) record('surface_closed', { surface: id, code: event.kind === 'release' && event.id === id ? code : 'gone' });
  }
  for (const id of state.shown) if (!before.shown.has(id)) record('surface_visible', { surface: id });
  for (const listener of listeners) listener();
}

/** The player's hand on the game: what a closed window waits for before the next one opens. */
function onHand(): void {
  if (state.awaitingAction) dispatchAttention({ kind: 'interact' });
}

function subscribe(listener: () => void): () => void {
  if (!handsWatched && typeof window !== 'undefined') {
    handsWatched = true;
    window.addEventListener('pointerdown', onHand, true);
    window.addEventListener('keydown', onHand, true);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    // No surface is mounted any more (the game was left): there is no next window to hold back.
    if (listeners.size === 0) state = { ...state, awaitingAction: false };
  };
}

/**
 * Asks for the screen while `want` holds. `shown` says whether it is this surface's turn; the
 * surface calls `release` with the player's choice when they close it.
 */
export function useAttention(id: string, want: boolean, spec: AttentionSpec): { shown: boolean; release: (code: string) => void } {
  const shown = useSyncExternalStore(subscribe, () => state.shown.has(id), () => false);
  const { priority, blocking } = spec;
  // Every request of one commit is in before any is weighed: layout effects run before passive ones.
  useLayoutEffect(() => {
    if (!want) return undefined;
    dispatchAttention({ kind: 'want', id, spec: { priority, blocking }, at: performance.now() });
    return () => { dispatchAttention({ kind: 'drop', id }); };
  }, [id, want, priority, blocking]);
  useEffect(() => { if (want) dispatchAttention({ kind: 'settle' }); }, [id, want, priority, blocking]);
  const release = useCallback((code: string) => { dispatchAttention({ kind: 'release', id }, code); }, [id]);
  return { shown: want && shown, release };
}

/** The player has a page of their own open, or a lesson speaks: nothing new opens over it. `id` names who says so. */
export function useAttentionBusy(id: string, busy: boolean): void {
  useEffect(() => {
    dispatchAttention({ kind: 'busy', id, busy });
    return () => { dispatchAttention({ kind: 'busy', id, busy: false }); };
  }, [id, busy]);
}

/** While a scenario plays, only `allow`ed surfaces may open; pass `null` to lift the lock. */
export function useAttentionLock(allow: readonly string[] | null): void {
  const key = allow === null ? null : allow.join(',');
  useEffect(() => {
    dispatchAttention({ kind: 'lock', allow: key === null ? null : (key ? key.split(',') : []) });
    return () => { dispatchAttention({ kind: 'lock', allow: null }); };
  }, [key]);
}

/** Reactive subscription to whether news is currently held back (blocking window or scenario lock). */
export function useAttentionQuiet(): boolean {
  return useSyncExternalStore(subscribe, () => attentionQuiet(state), () => false);
}

/** Read when news arrives: a window is open or a scenario plays (plan §5.5). */
export const attentionIsQuiet = (): boolean => attentionQuiet(state);

export function resetAttentionForTests(): void {
  state = emptyAttention();
  for (const listener of listeners) listener();
}
