import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MUSIC_VOLUME,
  formatTrackTime,
  MUSIC_TRACKS,
  musicEnabled,
  musicPlayback,
  musicTrack,
  musicVolume,
  nextTrack,
  prevTrack,
  randomTrackIndex,
  selectTrack,
  setMusicEnabled,
  setMusicVolume,
  useAmbientMusic,
} from '../src/lib/music.js';

/**
 * THE SCORE, AND THE FOUR THINGS THAT GO WRONG WITH BACKGROUND AUDIO.
 *
 * None of them are "does it play". They are all lifecycle:
 *
 *   · IT MUST STOP WHEN NOBODY IS LOOKING and start again from the same instant.
 *   · IT MUST SURVIVE AUTOPLAY BEING REFUSED, which every browser does on a cold
 *     tab, and start on the first real gesture instead.
 *   · IT MUST NOT LEAVE A DOWNLOAD RUNNING. React 19 StrictMode mounts twice in
 *     development; a teardown that only calls `pause()` leaves one orphaned media
 *     fetch per mount, for ever.
 *   · IT MUST NOT SHOUT INTO THE CONSOLE. `pause()` rejects a pending `play()`
 *     with `AbortError`, which happens every time a tab is backgrounded during
 *     the load window.
 *
 * jsdom has no media stack at all, so the element is stubbed at the prototype —
 * which is also what lets the test assert on the exact calls the teardown makes.
 */

interface Fake {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
}

let fake: Fake;
let hidden = false;
let rejectPlay: Error | null = null;

const Harness = () => {
  useAmbientMusic();
  return null;
};

const setHidden = (value: boolean): void => {
  hidden = value;
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => {
  setMusicEnabled(true);
  setMusicVolume(DEFAULT_MUSIC_VOLUME);
  // The launch track is random by design, so every test that is not about the
  // randomness has to pin it — otherwise one run in nine asserts a different file.
  selectTrack(0);
  hidden = false;
  rejectPlay = null;
  fake = {
    play: vi.fn(() => (rejectPlay ? Promise.reject(rejectPlay) : Promise.resolve())),
    pause: vi.fn(),
    load: vi.fn(),
  };
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(fake.play);
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(fake.pause);
  vi.spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(fake.load);
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
});

/**
 * UNMOUNT BEFORE THE STUBS COME OFF, and the order is not cosmetic.
 *
 * Vitest unwinds `afterEach` hooks in reverse registration order, so this file's
 * hook runs BEFORE the global `cleanup()` in `test/setup.ts`. Restoring the spies
 * first therefore tears every still-mounted component down against jsdom's real
 * media stack — which does not exist, and prints a "Not implemented" stack for
 * every `pause()` and `load()` the teardown makes. Unmounting here first means the
 * hook under test always releases through the fakes it was given.
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the ambient score', () => {
  it('starts once, does not loop a single track, and holds the volume it was given', () => {
    const created: HTMLAudioElement[] = [];
    const Audio = window.Audio;
    vi.stubGlobal(
      'Audio',
      class extends Audio {
        constructor() {
          super();
          created.push(this);
        }
      },
    );

    render(<Harness />);

    expect(fake.play).toHaveBeenCalledTimes(1);
    const audio = created[0]!;
    // The playlist is the loop now: a looping element would never reach `ended`.
    expect(audio.loop).toBe(false);
    expect(audio.volume).toBeCloseTo(0.35, 5);
    // Never preloaded: the first frame of this app is competing for the same
    // connection as a 1.8 MB bundle.
    expect(audio.preload).toBe('none');
    vi.unstubAllGlobals();
  });

  /**
   * `pause()` KEEPS `currentTime`, which is the whole of "resume where it left
   * off" — so what this asserts is that nothing tries to restart it from the top.
   */
  it('pauses when the tab goes away and resumes when it comes back', () => {
    render(<Harness />);
    expect(fake.play).toHaveBeenCalledTimes(1);

    setHidden(true);
    expect(fake.pause).toHaveBeenCalledTimes(1);

    setHidden(false);
    expect(fake.play).toHaveBeenCalledTimes(2);
    // Two plays and one pause — nothing reloaded the source, so the position held.
    expect(fake.load).not.toHaveBeenCalled();
  });

  it('does not try to play while the tab is already hidden', () => {
    hidden = true;
    render(<Harness />);
    expect(fake.play).not.toHaveBeenCalled();
  });

  /**
   * The expected case on every cold tab, and it must not be treated as a failure.
   */
  it('waits for the first gesture when autoplay is refused', async () => {
    rejectPlay = Object.assign(new Error('blocked'), { name: 'NotAllowedError' });
    render(<Harness />);
    await Promise.resolve();
    await Promise.resolve();

    expect(fake.play).toHaveBeenCalledTimes(1);

    rejectPlay = null;
    window.dispatchEvent(new Event('pointerdown'));
    expect(fake.play).toHaveBeenCalledTimes(2);

    // One gesture, one retry. The listener is gone, so a second tap is not a
    // second `play()` on an element that is already playing.
    window.dispatchEvent(new Event('pointerdown'));
    expect(fake.play).toHaveBeenCalledTimes(2);
  });

  /**
   * A missing file, or a codec the browser will not take. One of those moves to
   * the next track; a whole lap of them stops for good, because retrying nine
   * files on every visibility change is a leak with a schedule.
   */
  it('gives up for good once every file has refused to play', async () => {
    rejectPlay = Object.assign(new Error('nope'), { name: 'NotSupportedError' });
    render(<Harness />);
    for (let i = 0; i < 40; i += 1) await Promise.resolve();
    const attempts = fake.play.mock.calls.length;

    setHidden(true);
    setHidden(false);
    expect(fake.play).toHaveBeenCalledTimes(attempts);
  });

  /**
   * THE LEAK. `pause()` stops the sound and leaves the fetch running and the
   * decoder allocated; clearing the source and re-loading is what frees them.
   */
  it('releases the download and the decoder on unmount', () => {
    const { unmount } = render(<Harness />);
    unmount();

    expect(fake.pause).toHaveBeenCalled();
    expect(fake.load).toHaveBeenCalledTimes(1);
  });

  it('stops listening to anything once unmounted', () => {
    const { unmount } = render(<Harness />);
    const plays = fake.play.mock.calls.length;
    unmount();

    setHidden(true);
    setHidden(false);
    window.dispatchEvent(new Event('pointerdown'));

    expect(fake.play).toHaveBeenCalledTimes(plays);
    // And exactly one pause, from the teardown itself.
    expect(fake.pause).toHaveBeenCalledTimes(1);
  });

  /**
   * Backgrounding a tab between `play()` and the first sample rejects it with
   * `AbortError`. Every rejection is handled, so nothing reaches the console —
   * and the visibility handler is what starts it again, not a retry here.
   */
  it('swallows the rejection a pause causes, without retrying', async () => {
    rejectPlay = Object.assign(new Error('interrupted'), { name: 'AbortError' });
    render(<Harness />);
    await Promise.resolve();
    await Promise.resolve();

    expect(fake.play).toHaveBeenCalledTimes(1);
    // Not dead: the next time the tab is looked at, it tries again.
    rejectPlay = null;
    setHidden(true);
    setHidden(false);
    expect(fake.play).toHaveBeenCalledTimes(2);
  });
});

/**
 * THE SWITCH. Owner instruction: a small speaker in the menu, on or off.
 *
 * What matters is that it is a PAUSE and not a teardown. Rebuilding the element on
 * every toggle would drop `currentTime`, re-download 800 KB, and make turning the
 * music off and on again restart the track from the top — so the effect that owns
 * the element must not depend on the flag, and these tests are what hold that.
 */
describe('the sound switch', () => {
  it('pauses without tearing the element down, and resumes where it was', () => {
    render(<Harness />);
    expect(fake.play).toHaveBeenCalledTimes(1);

    act(() => {
      setMusicEnabled(false);
    });
    expect(fake.pause).toHaveBeenCalledTimes(1);
    // Nothing was released: a reload here would lose the position.
    expect(fake.load).not.toHaveBeenCalled();

    act(() => {
      setMusicEnabled(true);
    });
    expect(fake.play).toHaveBeenCalledTimes(2);
    expect(fake.load).not.toHaveBeenCalled();
  });

  it('does not start on mount when it was left off', () => {
    setMusicEnabled(false);
    render(<Harness />);
    expect(fake.play).not.toHaveBeenCalled();
  });

  /**
   * The visibility handler reads the LIVE flag rather than one captured when the
   * effect ran — otherwise coming back to a tab would start music somebody had
   * switched off.
   */
  it('stays silent when the tab comes back and the switch is off', () => {
    render(<Harness />);
    act(() => {
      setMusicEnabled(false);
    });
    const plays = fake.play.mock.calls.length;

    setHidden(true);
    setHidden(false);
    expect(fake.play).toHaveBeenCalledTimes(plays);
  });

  it('remembers the choice across a reload of the module state', () => {
    setMusicEnabled(false);
    expect(musicEnabled()).toBe(false);
    expect(globalThis.localStorage.getItem('astera.music')).toBe('off');

    setMusicEnabled(true);
    expect(globalThis.localStorage.getItem('astera.music')).toBe('on');
  });

  it('survives a storage that throws, and still switches for this session', () => {
    const spy = vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('storage is disabled');
    });
    expect(() => {
      setMusicEnabled(false);
    }).not.toThrow();
    expect(musicEnabled()).toBe(false);
    spy.mockRestore();
    setMusicEnabled(true);
  });

  it('changes the running element volume without rebuilding or restarting it', () => {
    const created: HTMLAudioElement[] = [];
    const Audio = window.Audio;
    vi.stubGlobal(
      'Audio',
      class extends Audio {
        constructor() {
          super();
          created.push(this);
        }
      },
    );
    render(<Harness />);
    const plays = fake.play.mock.calls.length;

    act(() => {
      setMusicVolume(0.72);
    });

    expect(created[0]!.volume).toBeCloseTo(0.72, 5);
    expect(fake.play).toHaveBeenCalledTimes(plays);
    expect(fake.load).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('clamps and remembers volume, including silence, without changing mute state', () => {
    setMusicEnabled(true);
    setMusicVolume(2);
    expect(musicVolume()).toBe(1);
    expect(musicEnabled()).toBe(true);
    expect(globalThis.localStorage.getItem('astera.music.volume')).toBe('1');

    setMusicVolume(-1);
    expect(musicVolume()).toBe(0);
    expect(musicEnabled()).toBe(true);
  });

  it('ignores malformed persisted volume and survives blocked storage writes', () => {
    const spy = vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('storage is disabled');
    });
    expect(() => { setMusicVolume(0.61); }).not.toThrow();
    expect(musicVolume()).toBeCloseTo(0.61, 5);
    spy.mockRestore();
  });
});

/**
 * THE PLAYLIST. Owner decision: one track was a signature, nine is a soundtrack.
 *
 * What changes with more than one file is not "which mp3 is in the string" — it is
 * that the score now has a POSITION IN A LIST, and every lifecycle rule the block
 * above holds has to keep holding while that position moves:
 *
 *   · A LAUNCH STARTS SOMEWHERE RANDOM, so two sessions do not open on the same
 *     bar. Chosen once per page load, never persisted: a remembered track would
 *     make the ninth visit sound like the eighth.
 *   · SKIPPING IS A DELIBERATE RESTART, and the only place in this file where
 *     tearing the source down is correct. Everything else — volume, the switch,
 *     the tab going away — must still leave `currentTime` alone.
 *   · A TRACK THAT ENDS HANDS OVER. `loop` is off now; the playlist is the loop.
 *   · ONE BAD FILE MUST NOT SILENCE THE GAME. A 404 on track 4 moves to track 5;
 *     only a whole lap of failures gives up, which is what stops a missing folder
 *     from spinning through nine requests on every visibility change, for ever.
 */
describe('the playlist', () => {
  const srcOf = (audio: HTMLAudioElement): string => audio.getAttribute('src') ?? '';

  const withAudio = (): HTMLAudioElement[] => {
    const created: HTMLAudioElement[] = [];
    const Base = window.Audio;
    vi.stubGlobal(
      'Audio',
      class extends Base {
        constructor() {
          super();
          created.push(this);
        }
      },
    );
    return created;
  };

  it('ships every renamed file, numbered, and nothing else', () => {
    expect(MUSIC_TRACKS).toHaveLength(9);
    MUSIC_TRACKS.forEach((track, index) => {
      expect(track).toBe(`/assets/musics/background-musics/${String(index + 1)}.mp3`);
    });
  });

  it('opens on a random track, inside the list', () => {
    const random = vi.spyOn(Math, 'random');
    random.mockReturnValue(0);
    expect(randomTrackIndex()).toBe(0);
    random.mockReturnValue(0.5);
    expect(randomTrackIndex()).toBe(4);
    // The exclusive upper bound a real `Math.random()` never reaches, asserted
    // anyway: an off-by-one here is an index out of the array and a silent tab.
    random.mockReturnValue(0.999999);
    expect(randomTrackIndex()).toBe(8);
    random.mockRestore();
  });

  it('plays the track the store is pointing at', () => {
    const created = withAudio();
    selectTrack(3);
    render(<Harness />);

    expect(srcOf(created[0]!)).toBe(MUSIC_TRACKS[3]);
    // The playlist is the loop, so no single track may loop on its own.
    expect(created[0]!.loop).toBe(false);
    vi.unstubAllGlobals();
  });

  it('moves forward and back, wrapping at both ends', () => {
    selectTrack(0);
    act(() => { prevTrack(); });
    expect(musicTrack()).toBe(8);
    act(() => { nextTrack(); });
    expect(musicTrack()).toBe(0);
    act(() => { nextTrack(); });
    expect(musicTrack()).toBe(1);
  });

  it('swaps the source and starts the new track from the top', () => {
    const created = withAudio();
    selectTrack(0);
    render(<Harness />);
    expect(fake.play).toHaveBeenCalledTimes(1);

    act(() => { nextTrack(); });

    // Same element — a skip must not orphan a decoder — with a new source.
    expect(created).toHaveLength(1);
    expect(srcOf(created[0]!)).toBe(MUSIC_TRACKS[1]);
    expect(fake.play).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it('hands over to the next track when one ends', () => {
    const created = withAudio();
    selectTrack(7);
    render(<Harness />);

    act(() => { created[0]!.dispatchEvent(new Event('ended')); });

    expect(musicTrack()).toBe(8);
    expect(srcOf(created[0]!)).toBe(MUSIC_TRACKS[8]);
    vi.unstubAllGlobals();
  });

  it('skips a file it cannot play instead of going silent', async () => {
    const created = withAudio();
    rejectPlay = Object.assign(new Error('nope'), { name: 'NotSupportedError' });
    selectTrack(2);
    render(<Harness />);
    await Promise.resolve();
    await Promise.resolve();

    expect(musicTrack()).toBe(3);
    expect(srcOf(created[0]!)).toBe(MUSIC_TRACKS[3]);
    vi.unstubAllGlobals();
  });

  it('gives up after a whole failed lap rather than retrying for ever', async () => {
    rejectPlay = Object.assign(new Error('nope'), { name: 'NotSupportedError' });
    selectTrack(0);
    render(<Harness />);
    for (let i = 0; i < 40; i += 1) await Promise.resolve();

    const attempts = fake.play.mock.calls.length;
    expect(attempts).toBeLessThanOrEqual(MUSIC_TRACKS.length);

    setHidden(true);
    setHidden(false);
    expect(fake.play).toHaveBeenCalledTimes(attempts);
  });

  it('changes track while silenced without starting the sound', () => {
    const created = withAudio();
    selectTrack(0);
    setMusicEnabled(false);
    render(<Harness />);
    expect(fake.play).not.toHaveBeenCalled();

    act(() => { nextTrack(); });

    expect(musicTrack()).toBe(1);
    expect(srcOf(created[0]!)).toBe(MUSIC_TRACKS[1]);
    expect(fake.play).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

/**
 * THE READOUT. Owner instruction: the menu shows what is playing, how long it is,
 * and where in it we are — live.
 *
 * ONE SECOND IS THE RESOLUTION, and that is a render budget rather than a display
 * choice. `timeupdate` fires four times a second on every browser; a store that
 * notified on each one would re-render the open menu 240 times a minute to move a
 * clock that only has sixty positions.
 */
describe('the now-playing readout', () => {
  /**
   * THE ONE THING A LIVE CLOCK CAN COST THAT NOTHING ELSE IN THIS FILE CAN.
   *
   * `useAmbientMusic` is called from the app ROOT, above the 3D galaxy. If it
   * subscribes to the whole playback snapshot, then a store that ticks once a
   * second re-renders that entire tree sixty times a minute — to move a readout
   * that is not even on screen unless a settings sheet is open. So the root
   * subscribes to the TRACK NUMBER alone, which changes when a player skips and
   * not when the clock moves.
   */
  it('does not re-render the app root as the clock moves', () => {
    const created: HTMLAudioElement[] = [];
    const Base = window.Audio;
    vi.stubGlobal('Audio', class extends Base {
      constructor() { super(); created.push(this); }
    });
    let renders = 0;
    const Root = () => {
      renders += 1;
      useAmbientMusic();
      return null;
    };
    selectTrack(0);
    render(<Root />);
    const audio = created[0]!;
    const settled = renders;
    const time = vi.spyOn(audio, 'currentTime', 'get').mockReturnValue(1);
    vi.spyOn(audio, 'duration', 'get').mockReturnValue(100);

    for (let second = 1; second <= 5; second += 1) {
      time.mockReturnValue(second);
      act(() => { audio.dispatchEvent(new Event('timeupdate')); });
    }

    // Five seconds of ticks, and the store really did move.
    expect(musicPlayback().position).toBe(5);
    expect(renders).toBe(settled);

    // A skip is a different matter: that one the root has to see.
    act(() => { nextTrack(); });
    expect(renders).toBeGreaterThan(settled);
    vi.unstubAllGlobals();
  });

  it('reports the track, the position and the length', () => {
    const created: HTMLAudioElement[] = [];
    const Base = window.Audio;
    vi.stubGlobal('Audio', class extends Base {
      constructor() { super(); created.push(this); }
    });
    selectTrack(5);
    render(<Harness />);
    const audio = created[0]!;
    vi.spyOn(audio, 'currentTime', 'get').mockReturnValue(61.4);
    vi.spyOn(audio, 'duration', 'get').mockReturnValue(184);

    act(() => { audio.dispatchEvent(new Event('timeupdate')); });

    expect(musicPlayback()).toEqual({ track: 5, position: 61, duration: 184 });
    vi.unstubAllGlobals();
  });

  it('holds a stable snapshot between whole seconds', () => {
    const created: HTMLAudioElement[] = [];
    const Base = window.Audio;
    vi.stubGlobal('Audio', class extends Base {
      constructor() { super(); created.push(this); }
    });
    selectTrack(0);
    render(<Harness />);
    const audio = created[0]!;
    const time = vi.spyOn(audio, 'currentTime', 'get').mockReturnValue(10.1);
    vi.spyOn(audio, 'duration', 'get').mockReturnValue(100);
    act(() => { audio.dispatchEvent(new Event('timeupdate')); });
    const first = musicPlayback();

    time.mockReturnValue(10.9);
    act(() => { audio.dispatchEvent(new Event('timeupdate')); });

    // Same object identity: `useSyncExternalStore` tears on a new one every tick.
    expect(musicPlayback()).toBe(first);
    vi.unstubAllGlobals();
  });

  it('starts a skipped track back at zero before anything has loaded', () => {
    selectTrack(0);
    render(<Harness />);
    act(() => { nextTrack(); });
    expect(musicPlayback()).toEqual({ track: 1, position: 0, duration: 0 });
  });

  it('writes a clock a player can read, and refuses to invent one', () => {
    expect(formatTrackTime(0)).toBe('0:00');
    expect(formatTrackTime(9)).toBe('0:09');
    expect(formatTrackTime(61)).toBe('1:01');
    expect(formatTrackTime(3599)).toBe('59:59');
    // Before metadata arrives the element reports NaN. A dash is honest; "0:00"
    // would be a length, and a wrong one.
    expect(formatTrackTime(Number.NaN)).toBe('–:––');
    expect(formatTrackTime(Number.POSITIVE_INFINITY)).toBe('–:––');
    expect(formatTrackTime(0, { blankAtZero: true })).toBe('–:––');
  });
});
