import { useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * THE SCORE, UNDER EVERYTHING, FOR AS LONG AS THE TAB IS IN FRONT OF SOMEBODY.
 *
 * Owner decision. One track, looped, at a fixed level, paused whenever the page
 * is not being looked at and resumed from the same instant when it is.
 *
 * FOUR THINGS THIS HAS TO GET RIGHT, and three of them are failure modes rather
 * than features:
 *
 *   1. AUTOPLAY IS BLOCKED, AND THAT IS NOT AN ERROR. Every current browser
 *      refuses `play()` on audible media until the page has been interacted with
 *      — `NotAllowedError`, thrown at load on a cold tab, every time. So the
 *      first attempt is expected to fail: the rejection arms a one-shot listener
 *      on the next real gesture and the music starts from there. On this app that
 *      gesture is almost always the first tap on the front door, which is why
 *      nothing is displayed about it. Anything else the browser objects to
 *      (a missing file, a codec it will not take) simply stops the whole thing;
 *      an app that retries a 404 on every visibility change is a leak with a
 *      schedule.
 *   2. `pause()` PRESERVES `currentTime`, so "resume where it left off" needs no
 *      bookkeeping at all — and deliberately no bookkeeping, because a stored
 *      position and the element's own position are two sources of truth for one
 *      fact and they drift the first time a seek happens.
 *   3. PAUSING A PENDING `play()` REJECTS IT. Backgrounding a tab in the moment
 *      between the call and the first sample produces `AbortError`, and an
 *      unhandled rejection in the console of a live game is indistinguishable
 *      from a real fault. Every rejection is caught here; only `NotAllowedError`
 *      means anything.
 *   4. IT MUST LEAVE NOTHING BEHIND. The element is never in the DOM, so what
 *      leaks is not a node — it is an in-flight media fetch and a decoder. Both
 *      are released by clearing `src` and calling `load()`, and both survive a
 *      component unmount if you only call `pause()`. React 19's StrictMode mounts
 *      twice in development, which is exactly the case that turns a missed
 *      teardown into two tracks playing over each other.
 *
 * `visibilitychange` IS THE WHOLE OF THE PAUSE RULE, and `blur` is deliberately
 * not part of it. The brief is "another tab, or the window in the background",
 * and those are the two things this event fires for. `blur` also fires for
 * clicking an iframe, opening devtools and focusing the address bar — none of
 * which mean the player stopped watching, and all of which would chop the music.
 */

/** The track. A file under `public/`, so it is served by nginx and never bundled. */
const TRACK = '/assets/musics/interstellar-main-theme-bg.mp3';

/**
 * Fixed, by owner decision. There is an ON/OFF, and there is no volume slider:
 * loud enough to be there, quiet enough to talk over.
 */
const VOLUME = 0.35;

/* ── on or off, and it survives a reload ───────────────────────────────────── */

/**
 * THE ONE PREFERENCE THIS FEATURE HAS. Owner instruction.
 *
 * A toggle that forgot itself on every reload would be worse than no toggle: a
 * player who turned the music off has said something about how they want to play,
 * and asking them again tomorrow is not respecting it. Stored per device, which is
 * the right scope — it is about the room you are in, not about the commander.
 *
 * DEFAULT ON. The score is part of the product; the control is there for the
 * person on a bus, not to opt in to the game having sound.
 *
 * A MODULE-LEVEL STORE RATHER THAN CONTEXT, because the two things that need it
 * are at opposite ends of the tree — the audio element lives at the app root and
 * the switch lives inside a sheet four levels down — and threading a provider
 * between them buys nothing. `attempt()` below reads the getter directly, so the
 * playback path is always looking at the live value and never at a captured one.
 */
const ENABLED_KEY = 'astera.music';

const store = (): Storage | null => {
  try {
    // Safari in private browsing throws on ACCESS, not on write, so even a read
    // has to be guarded — see `lib/returning.ts`, which learned the same lesson.
    return globalThis.localStorage;
  } catch {
    return null;
  }
};

let enabled = ((): boolean => {
  try {
    return store()?.getItem(ENABLED_KEY) !== 'off';
  } catch {
    return true;
  }
})();

const listeners = new Set<() => void>();

export const musicEnabled = (): boolean => enabled;

export function setMusicEnabled(next: boolean): void {
  if (next === enabled) return;
  enabled = next;
  try {
    store()?.setItem(ENABLED_KEY, next ? 'on' : 'off');
  } catch {
    // A read-only store still leaves the toggle working for this session.
  }
  for (const notify of listeners) notify();
}

const subscribe = (notify: () => void): (() => void) => {
  listeners.add(notify);
  return () => listeners.delete(notify);
};

/** Subscribe a component to the switch. Safe to call from anywhere in the tree. */
export const useMusicEnabled = (): boolean =>
  useSyncExternalStore(subscribe, musicEnabled, () => true);

/** The gestures a browser will accept as "the user has interacted with this page". */
const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;

/**
 * Start the score for as long as the component that calls this is mounted.
 *
 * Called ONCE, from the app root, above every early return — a hook that runs on
 * some screens and not others would restart the track on every phase change.
 */
export function useAmbientMusic(): void {
  const on = useMusicEnabled();
  /**
   * The running element's two controls, so the switch can reach them WITHOUT
   * putting `on` in the effect below's dependency list.
   *
   * That distinction is the whole reason this ref exists. Re-running the setup
   * effect on every toggle would build a new element each time — which drops
   * `currentTime`, re-downloads 800 KB, and makes turning the music off and on
   * again restart the track from the top. Pausing preserves the position, so the
   * switch is a pause and a resume rather than a teardown.
   */
  const control = useRef<{ resume: () => void; pause: () => void } | null>(null);

  useEffect(() => {
    let disposed = false;
    /** Set when the browser refuses the file outright. Stops every further attempt. */
    let dead = false;

    const audio = new Audio();
    audio.src = TRACK;
    audio.loop = true;
    audio.volume = VOLUME;
    /**
     * `none`, not `auto`. The first frame of this app compiles a 3D scene out of a
     * 1.8 MB bundle, and 800 KB of music competing for that phone's connection is
     * the one thing `LoadingScreen` exists to keep honest. `play()` loads it.
     */
    audio.preload = 'none';

    const release = (): void => {
      for (const type of GESTURES) window.removeEventListener(type, onGesture, true);
    };

    function attempt(): void {
      // `musicEnabled()` and not a captured boolean: this runs from a visibility
      // handler and from a gesture listener, both of which can fire long after the
      // effect closed over anything.
      if (disposed || dead || document.hidden || !musicEnabled()) return;
      /**
       * Older browsers return undefined rather than a promise, and so does jsdom.
       * Treating that as a promise is a TypeError in a `useEffect`, which React
       * turns into a blank screen.
       */
      const started: unknown = audio.play();
      if (!(started instanceof Promise)) return;
      started.then(
        () => {
          // Playing. Nothing is waiting on a gesture any more.
          release();
        },
        (err: unknown) => {
          if (disposed) return;
          const name = err instanceof Error ? err.name : '';
          if (name === 'NotAllowedError') {
            // Expected on a cold tab. Wait for the first real interaction.
            for (const type of GESTURES) {
              window.addEventListener(type, onGesture, { capture: true, passive: true });
            }
            return;
          }
          /**
           * `AbortError` means a `pause()` landed between the call and the first
           * sample — the tab went to the background. Not a failure, and not
           * something to retry: the visibility handler will start it again.
           */
          if (name === 'AbortError') return;
          dead = true;
          release();
        },
      );
    }

    /**
     * The first interaction with the page. Declared as a function rather than a
     * const so it can be named inside `release()` above it, which is what lets
     * every listener be removed by identity from three places.
     */
    function onGesture(): void {
      release();
      attempt();
    }

    const onVisibility = (): void => {
      if (document.hidden) {
        // Keeps `currentTime`, which is the whole of "resume where it left off".
        audio.pause();
      } else {
        attempt();
      }
    };

    /** A file that is not there, or a codec the browser will not take. */
    const onError = (): void => {
      dead = true;
      release();
    };

    audio.addEventListener('error', onError);
    document.addEventListener('visibilitychange', onVisibility);
    control.current = {
      resume: attempt,
      pause: () => {
        audio.pause();
      },
    };
    attempt();

    return () => {
      disposed = true;
      control.current = null;
      document.removeEventListener('visibilitychange', onVisibility);
      audio.removeEventListener('error', onError);
      release();
      audio.pause();
      /**
       * BOTH LINES, AND THE SECOND IS THE ONE THAT ACTUALLY FREES ANYTHING.
       *
       * `pause()` stops the sound and leaves the fetch running and the decoder
       * allocated. Clearing the source and re-loading is what aborts the request
       * and drops the buffer — without it, a StrictMode double-mount in
       * development leaves one orphaned download per mount, for ever.
       */
      audio.removeAttribute('src');
      audio.load();
    };
  }, []);

  /**
   * The switch. A pause and a resume on the element that is already there — never
   * a rebuild, so the track carries on from where it was silenced.
   *
   * IT ACTS ON A CHANGE AND NEVER ON A MOUNT. The setup effect above has already
   * done the right thing for whatever the flag said when it ran: started, or
   * declined to. Firing again here called `play()` a second time on the same
   * element on every mount — harmless in a browser, wrong in the code, and it is
   * what made six of this file's tests count two starts where the design has one.
   */
  const applied = useRef<boolean | null>(null);
  useEffect(() => {
    const previous = applied.current;
    applied.current = on;
    if (previous === null || previous === on) return;
    if (on) control.current?.resume();
    else control.current?.pause();
  }, [on]);
}
