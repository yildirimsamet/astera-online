import { useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * THE SCORE, UNDER EVERYTHING, FOR AS LONG AS THE TAB IS IN FRONT OF SOMEBODY.
 *
 * Owner decision. A playlist of nine, played at the player's saved level, paused
 * whenever the page is not being looked at and resumed from the same instant when
 * it is. The list is the loop; a track running out hands over to the next one.
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

/**
 * THE PLAYLIST. Files under `public/`, so they are served by nginx and never
 * bundled — nine of them, numbered, because a numbered folder is the only naming
 * scheme that cannot drift out of step with this array.
 *
 * ONE TRACK WAS A SIGNATURE; NINE IS A SOUNDTRACK. Owner decision, and the reason
 * is re-engagement rather than variety for its own sake: a player who hears the
 * same eight bars on their fortieth session has been given a reason to reach for
 * the mute, and a muted game is one the player is only looking at.
 */
export const MUSIC_TRACKS: readonly string[] = Array.from(
  { length: 9 },
  (_unused, index) => `/assets/musics/background-musics/${String(index + 1)}.mp3`,
);

/** The original mix remains the default; the player may now tune it per device. */
export const DEFAULT_MUSIC_VOLUME = 0.35;

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
const VOLUME_KEY = 'astera.music.volume';

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

let volume = ((): number => {
  try {
    const raw = store()?.getItem(VOLUME_KEY);
    if (raw === null || raw === undefined || raw.trim() === '') return DEFAULT_MUSIC_VOLUME;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
      ? parsed
      : DEFAULT_MUSIC_VOLUME;
  } catch {
    return DEFAULT_MUSIC_VOLUME;
  }
})();

const listeners = new Set<() => void>();

export const musicEnabled = (): boolean => enabled;
export const musicVolume = (): number => volume;

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

export function setMusicVolume(next: number): void {
  if (!Number.isFinite(next)) return;
  const clamped = Math.max(0, Math.min(1, next));
  if (clamped === volume) return;
  volume = clamped;
  try {
    store()?.setItem(VOLUME_KEY, String(clamped));
  } catch {
    // A read-only store still leaves the slider working for this session.
  }
  for (const notify of listeners) notify();
}

/* ── which one, and where in it ─────────────────────────────────────────────── */

/**
 * WHICH TRACK IS PLAYING AND WHERE IN IT WE ARE — A SEPARATE STORE, DELIBERATELY.
 *
 * It shares nothing with the preference store above, and the separation is the
 * whole point: this one is notified on a clock. Putting a once-a-second tick
 * through the same `listeners` set as the mute switch would re-render the app
 * root — the 3D galaxy included — sixty times a minute to move a readout that is
 * only on screen while a settings sheet is open.
 *
 * NOT PERSISTED. Owner instruction: every launch opens on a random track. A
 * remembered position would make the ninth session sound like the eighth, which
 * is the exact thing nine files were added to stop.
 */
export interface MusicPlayback {
  /** Index into `MUSIC_TRACKS`. */
  readonly track: number;
  /** Whole seconds elapsed. Whole, because the readout has no finer positions. */
  readonly position: number;
  /** Whole seconds total, or 0 while the browser has not read the metadata yet. */
  readonly duration: number;
}

/** The launch track. Uniform over the list; exported so a test can pin the edges. */
export const randomTrackIndex = (): number =>
  Math.min(MUSIC_TRACKS.length - 1, Math.floor(Math.random() * MUSIC_TRACKS.length));

let playback: MusicPlayback = { track: randomTrackIndex(), position: 0, duration: 0 };

const playbackListeners = new Set<() => void>();

/**
 * A NEW OBJECT ONLY WHEN SOMETHING ACTUALLY CHANGED.
 *
 * `useSyncExternalStore` compares snapshots by identity and throws
 * "getSnapshot should be cached" at a store that hands back a fresh object every
 * read. `timeupdate` fires roughly four times a second and three of those four
 * land inside the same whole second, so without this equality check the readout
 * would re-render four times to show the same clock.
 */
const setPlayback = (next: MusicPlayback): void => {
  if (
    next.track === playback.track &&
    next.position === playback.position &&
    next.duration === playback.duration
  ) {
    return;
  }
  playback = next;
  for (const notify of playbackListeners) notify();
};

export const musicPlayback = (): MusicPlayback => playback;
export const musicTrack = (): number => playback.track;

/** Point the score at a track. A no-op when it is already the one playing. */
export function selectTrack(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= MUSIC_TRACKS.length) return;
  if (index === playback.track) return;
  // Position and length belong to the file, so they go with it — otherwise the
  // readout shows the previous track's length against the new one's clock for as
  // long as it takes the browser to read the new metadata.
  setPlayback({ track: index, position: 0, duration: 0 });
}

const step = (delta: number): void => {
  const count = MUSIC_TRACKS.length;
  selectTrack((playback.track + delta + count) % count);
};

/** The two buttons in the menu. They wrap, so neither one is ever a dead end. */
export const nextTrack = (): void => { step(1); };
export const prevTrack = (): void => { step(-1); };

const subscribePlayback = (notify: () => void): (() => void) => {
  playbackListeners.add(notify);
  return () => playbackListeners.delete(notify);
};

const EMPTY_PLAYBACK: MusicPlayback = { track: 0, position: 0, duration: 0 };

/** Subscribe a component to the live readout. Server-rendered as an empty clock. */
export const useMusicPlayback = (): MusicPlayback =>
  useSyncExternalStore(subscribePlayback, musicPlayback, () => EMPTY_PLAYBACK);

/**
 * THE TRACK NUMBER ALONE, AND THIS IS THE ONE THE APP ROOT USES.
 *
 * `useMusicPlayback` hands back the whole snapshot, and the snapshot is a new
 * object every time the clock moves — so a component subscribed to it re-renders
 * once a second. That is correct for a readout somebody is looking at and ruinous
 * for `useAmbientMusic`, which is called above the 3D galaxy: the same tick would
 * re-render that entire tree sixty times a minute to move a clock that is not even
 * on screen unless a settings sheet is open.
 *
 * A NUMBER IS THE FIX, not a memo. `useSyncExternalStore` compares snapshots with
 * `Object.is`, so an unchanged track number means the notification arrives and the
 * render never happens.
 */
export const useMusicTrack = (): number =>
  useSyncExternalStore(subscribePlayback, musicTrack, () => 0);

/**
 * A CLOCK, OR AN HONEST DASH.
 *
 * `HTMLMediaElement.duration` is `NaN` until the metadata lands and `Infinity` on
 * a stream, and rendering either of those as `0:00` states a length — a wrong one.
 * A dash says "not known yet", which is the true thing and costs the same width.
 */
export function formatTrackTime(
  seconds: number,
  options?: { readonly blankAtZero?: boolean },
): string {
  if (!Number.isFinite(seconds) || seconds < 0) return UNKNOWN_TIME;
  if (seconds === 0 && options?.blankAtZero === true) return UNKNOWN_TIME;
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  return `${String(minutes)}:${String(whole % 60).padStart(2, '0')}`;
}

/** En dash and two figure dashes: the same width as `0:00` in the tabular face. */
const UNKNOWN_TIME = '\u2013:\u2013\u2013';

const subscribe = (notify: () => void): (() => void) => {
  listeners.add(notify);
  return () => listeners.delete(notify);
};

/**
 * The same switch, for a listener that is not a component.
 *
 * `lib/h5.ts` needs it: Google selects ad creatives partly on whether the game
 * can play sound, and its guidance is to re-declare the state the moment it
 * changes rather than at the next ad. A `Set` de-duplicates, so a caller that
 * subscribes the same function twice still gets one notification.
 */
export const subscribeMusic = subscribe;

/** Subscribe a component to the switch. Safe to call from anywhere in the tree. */
export const useMusicEnabled = (): boolean =>
  useSyncExternalStore(subscribe, musicEnabled, () => true);

export const useMusicVolume = (): number =>
  useSyncExternalStore(subscribe, musicVolume, () => DEFAULT_MUSIC_VOLUME);

/** The gestures a browser will accept as "the user has interacted with this page". */
const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;

/** The element events that move the readout. Metadata first, then every tick. */
const CLOCK_EVENTS = ['loadedmetadata', 'durationchange', 'timeupdate'] as const;

/**
 * Start the score for as long as the component that calls this is mounted.
 *
 * Called ONCE, from the app root, above every early return — a hook that runs on
 * some screens and not others would restart the track on every phase change.
 */
export function useAmbientMusic(): void {
  const on = useMusicEnabled();
  const level = useMusicVolume();
  const track = useMusicTrack();
  /**
   * The running element's controls, so the switch and the skip buttons can reach
   * them WITHOUT putting `on` or `track` in the setup effect's dependency list.
   *
   * That distinction is the whole reason this ref exists. Re-running the setup
   * effect on every toggle would build a new element each time — which drops
   * `currentTime`, re-downloads a megabyte, and makes turning the music off and on
   * again restart the track from the top. Pausing preserves the position, so the
   * switch is a pause and a resume rather than a teardown.
   */
  const control = useRef<{
    resume: () => void;
    pause: () => void;
    setVolume: (next: number) => void;
    setTrack: (next: number) => void;
  } | null>(null);

  useEffect(() => {
    let disposed = false;
    /**
     * CONSECUTIVE FILES THE BROWSER HAS REFUSED, and the reason this is a count
     * rather than the old boolean.
     *
     * With one track, a refusal meant the score was over. With nine, a 404 on the
     * fourth file must hand over to the fifth — one missing upload is not a reason
     * to silence the game. But moving on unconditionally is a loop: a folder that
     * failed to deploy would spin through nine requests on every visibility
     * change, for ever. So one whole lap of failures, and then it stops.
     */
    let failures = 0;
    let dead = false;
    /** Which source the element is actually holding, so a skip can be detected. */
    let loaded = musicTrack();

    const audio = new Audio();
    audio.src = MUSIC_TRACKS[loaded] ?? '';
    /**
     * NEVER `loop`. The playlist is the loop now, and a looping element never
     * reaches `ended` — which is the event the hand-over is built on.
     */
    audio.loop = false;
    audio.volume = musicVolume();
    /**
     * `none`, not `auto`. The first frame of this app compiles a 3D scene out of a
     * 1.8 MB bundle, and a megabyte of music competing for that phone's connection
     * is the one thing `LoadingScreen` exists to keep honest. `play()` loads it.
     */
    audio.preload = 'none';

    const release = (): void => {
      for (const type of GESTURES) window.removeEventListener(type, onGesture, true);
    };

    /** Push the element's own clock into the store. The element is the truth. */
    const report = (): void => {
      if (disposed) return;
      setPlayback({
        track: musicTrack(),
        position: Math.floor(audio.currentTime),
        duration: Number.isFinite(audio.duration) ? Math.floor(audio.duration) : 0,
      });
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
          // Playing. Nothing is waiting on a gesture, and the lap counter is spent.
          failures = 0;
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
           * sample — the tab went to the background, or a skip replaced the
           * source. Not a failure, and not something to retry: the visibility
           * handler or the skip itself will start it again.
           */
          if (name === 'AbortError') return;
          refuse();
        },
      );
    }

    /** The browser will not take this file. Move along, or stop after a full lap. */
    const refuse = (): void => {
      if (disposed || dead) return;
      failures += 1;
      if (failures >= MUSIC_TRACKS.length) {
        dead = true;
        release();
        return;
      }
      nextTrack();
    };

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
      refuse();
    };

    /** A track running out is a hand-over, not an end. */
    const onEnded = (): void => {
      if (disposed) return;
      nextTrack();
    };

    audio.addEventListener('error', onError);
    audio.addEventListener('ended', onEnded);
    for (const type of CLOCK_EVENTS) audio.addEventListener(type, report);
    document.addEventListener('visibilitychange', onVisibility);
    control.current = {
      resume: attempt,
      pause: () => {
        audio.pause();
      },
      setVolume: (next) => {
        audio.volume = next;
      },
      /**
       * THE SKIP, AND THE ONE PLACE IN THIS FILE WHERE A TEARDOWN IS CORRECT.
       *
       * Everything else — the switch, the volume, the tab going away — holds
       * `currentTime` on purpose. A different track has no position to hold, so
       * the source is replaced and the element starts it from the top. `load()`
       * is what aborts the previous fetch; without it a player tapping through
       * nine tracks leaves nine downloads running.
       */
      setTrack: (next) => {
        if (next === loaded) return;
        loaded = next;
        /**
         * THE LAP COUNTER SURVIVES A SKIP — except a skip that revives the score.
         *
         * Clearing it here unconditionally was a loop with no exit: the
         * auto-advance after a refusal arrives through this very function, so
         * resetting the count meant the ninth failure looked exactly like the
         * first and a missing folder retried for ever. A skip taken while the
         * playlist has already given up is the one that can only have come from
         * the player, and it deserves a fresh lap.
         */
        if (dead) {
          dead = false;
          failures = 0;
        }
        audio.pause();
        audio.src = MUSIC_TRACKS[next] ?? '';
        audio.load();
        attempt();
      },
    };
    attempt();

    return () => {
      disposed = true;
      control.current = null;
      document.removeEventListener('visibilitychange', onVisibility);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ended', onEnded);
      for (const type of CLOCK_EVENTS) audio.removeEventListener(type, report);
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

  /** Volume changes touch the live element only: no restart, seek or download. */
  useEffect(() => {
    control.current?.setVolume(level);
  }, [level]);

  /**
   * The skip. `setTrack` compares against the source the element is holding rather
   * than against a previous render, so a mount is naturally a no-op and the
   * auto-advance on `ended` goes through exactly the same path a button press does.
   */
  useEffect(() => {
    control.current?.setTrack(track);
  }, [track]);
}
