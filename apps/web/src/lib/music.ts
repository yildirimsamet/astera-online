import { useEffect } from 'react';

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
 * Fixed, by owner decision, and there is no control for it.
 *
 * Loud enough to be there, quiet enough to talk over. If this ever becomes
 * adjustable it belongs in the commander sheet with the language, because it is an
 * account preference and not a season one.
 */
const VOLUME = 0.35;

/** The gestures a browser will accept as "the user has interacted with this page". */
const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;

/**
 * Start the score for as long as the component that calls this is mounted.
 *
 * Called ONCE, from the app root, above every early return — a hook that runs on
 * some screens and not others would restart the track on every phase change.
 */
export function useAmbientMusic(): void {
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
      if (disposed || dead || document.hidden) return;
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
    attempt();

    return () => {
      disposed = true;
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
}
