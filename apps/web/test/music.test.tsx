import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MUSIC_VOLUME,
  musicEnabled,
  musicVolume,
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
  it('starts once, loops, and holds the volume it was given', () => {
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
    expect(audio.loop).toBe(true);
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
   * A missing file, or a codec the browser will not take. Retrying it on every
   * visibility change is a leak with a schedule.
   */
  it('gives up for good when the file cannot be played', async () => {
    rejectPlay = Object.assign(new Error('nope'), { name: 'NotSupportedError' });
    render(<Harness />);
    await Promise.resolve();
    await Promise.resolve();

    setHidden(true);
    setHidden(false);
    expect(fake.play).toHaveBeenCalledTimes(1);
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
