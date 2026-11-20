/**
 * WHO MAY TAKE THE SCREEN BY ITSELF (plan 2026-11-20 §5.5). Every surface that opens without the
 * player asking — the landing card, the rewards window, the brand quiz, the install card, a week
 * note — asks here first. Measured on 19 November: one minute after landing a player who had not
 * yet given a single order was shown three windows, a card, a strip and up to four toasts.
 *
 * The rules, in order:
 * - one blocking surface at a time, the most important first, then the oldest request;
 * - after the player closes a blocking surface, the next waits for their hand on the game again;
 * - nothing new opens while the player has a page of their own open or a lesson speaks;
 * - a light surface never lies over a blocking one, and only one light surface shows at a time;
 * - while a scenario holds a lock, only its own surfaces get through.
 *
 * Pure: the store (`store.ts`) holds the state and writes the measurement.
 */
export interface AttentionSpec {
  /** Higher goes first. */
  readonly priority: number;
  /** Holds the screen until the player closes it (a window), as opposed to a card or a strip. */
  readonly blocking: boolean;
}

export interface AttentionState {
  readonly wanted: ReadonlyMap<string, AttentionSpec & { readonly since: number }>;
  readonly shown: ReadonlySet<string>;
  /** A blocking surface was just closed by the player: the next one waits for their hand. */
  readonly awaitingAction: boolean;
  /** Who says the player has a page of their own open, or a lesson speaks. */
  readonly busy: ReadonlySet<string>;
  /** While a scenario plays, only these surfaces may show. */
  readonly lock: ReadonlySet<string> | null;
}

export type AttentionEvent =
  /**
   * Asks for the screen. Grants nothing by itself: every surface on a landing asks in the same
   * render, and the order components happen to mount in must not decide which one the player sees.
   */
  | { readonly kind: 'want'; readonly id: string; readonly spec: AttentionSpec; readonly at: number }
  /** Weighs what was asked in this moment. The store sends it once the moment's requests are in. */
  | { readonly kind: 'settle' }
  /** No longer wanted (its condition went away): closes without making the next one wait. */
  | { readonly kind: 'drop'; readonly id: string }
  /** The player closed it. */
  | { readonly kind: 'release'; readonly id: string }
  | { readonly kind: 'interact' }
  | { readonly kind: 'busy'; readonly id: string; readonly busy: boolean }
  | { readonly kind: 'lock'; readonly allow: readonly string[] | null };

export const emptyAttention = (): AttentionState => ({
  wanted: new Map(), shown: new Set(), awaitingAction: false, busy: new Set(), lock: null,
});

const isBlocking = (state: AttentionState, id: string): boolean => state.wanted.get(id)?.blocking === true;

/** Grants what the rules allow now. Never takes back a surface already shown. */
function settle(state: AttentionState): AttentionState {
  if (state.busy.size > 0 || state.awaitingAction) return state;
  const shown = new Set(state.shown);
  const waiting = [...state.wanted.entries()]
    .filter(([id]) => !shown.has(id) && (state.lock === null || state.lock.has(id)))
    .sort(([, a], [, b]) => b.priority - a.priority || a.since - b.since);
  const blockingShown = (): boolean => [...shown].some(id => isBlocking(state, id));
  if (!blockingShown()) {
    const next = waiting.find(([, spec]) => spec.blocking);
    if (next) shown.add(next[0]);
  }
  if (!blockingShown() && ![...shown].some(id => !isBlocking(state, id))) {
    const next = waiting.find(([, spec]) => !spec.blocking);
    if (next) shown.add(next[0]);
  }
  return shown.size === state.shown.size ? state : { ...state, shown };
}

function without(state: AttentionState, id: string): Pick<AttentionState, 'wanted' | 'shown'> {
  const wanted = new Map(state.wanted);
  wanted.delete(id);
  const shown = new Set(state.shown);
  shown.delete(id);
  return { wanted, shown };
}

export function reduceAttention(state: AttentionState, event: AttentionEvent): AttentionState {
  switch (event.kind) {
    case 'want': {
      if (state.wanted.has(event.id)) return state;
      const wanted = new Map(state.wanted);
      wanted.set(event.id, { ...event.spec, since: event.at });
      return { ...state, wanted };
    }
    case 'settle':
      return settle(state);
    case 'drop':
      if (!state.wanted.has(event.id)) return state;
      return settle({ ...state, ...without(state, event.id) });
    case 'release': {
      if (!state.shown.has(event.id)) return state;
      const blocking = isBlocking(state, event.id);
      return settle({ ...state, ...without(state, event.id), awaitingAction: state.awaitingAction || blocking });
    }
    case 'interact':
      return state.awaitingAction ? settle({ ...state, awaitingAction: false }) : state;
    case 'busy': {
      if (state.busy.has(event.id) === event.busy) return state;
      const busy = new Set(state.busy);
      if (event.busy) busy.add(event.id);
      else busy.delete(event.id);
      return settle({ ...state, busy });
    }
    case 'lock':
      return settle({ ...state, lock: event.allow === null ? null : new Set(event.allow) });
  }
}

/** News waits while a window is open or a scenario plays (plan §5.5); threats still speak. */
export const attentionQuiet = (state: AttentionState): boolean =>
  state.lock !== null || [...state.shown].some(id => isBlocking(state, id));
