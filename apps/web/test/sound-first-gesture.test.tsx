import { act, cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { holdSound, playSound, useSoundEffects } from '../src/lib/sound.js';

/**
 * THE FIRST THING THE PLAYER TOUCHES HAS TO SOUND (owner playtest 2026-11-08). A phone opens audio only
 * when the finger lifts, and the prologue's breaker is thrown while it is still down: the cue waits a
 * moment for the audio to open instead of being lost.
 */
let resumes = true;
interface Param { value: number; setValueAtTime: ReturnType<typeof vi.fn>; linearRampToValueAtTime: ReturnType<typeof vi.fn>; cancelScheduledValues: ReturnType<typeof vi.fn> }
const param = (): Param => ({ value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() });
interface Voice { buffer: unknown; loop: boolean; loopStart: number; loopEnd: number; playbackRate: Param; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }
const started: Voice[] = [];
let gain: Param;

class FakeContext {
  state = 'suspended';
  sampleRate = 8000;
  currentTime = 0;
  destination = {};
  private node = () => ({ connect: (next: unknown) => next, disconnect: () => undefined });
  createGain() {
    gain = param();
    return { ...this.node(), gain };
  }
  createDynamicsCompressor() {
    const param = { value: 0 };
    return { ...this.node(), threshold: param, knee: param, ratio: param, attack: param, release: param };
  }
  createStereoPanner() { return { ...this.node(), pan: { value: 0 } }; }
  createBuffer() { return { copyToChannel: () => undefined }; }
  createBufferSource() {
    const voice = { ...this.node(), buffer: null as unknown, onended: null, loop: false, loopStart: 0, loopEnd: 0, playbackRate: param(),
      start: vi.fn(() => { started.push(voice); }), stop: vi.fn() };
    return voice;
  }
  decodeAudioData() { return Promise.resolve({ duration: 0.467 }); }
  resume() {
    if (!resumes) return Promise.reject(new Error('not on pointerdown'));
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { return Promise.resolve(); }
}

const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  started.length = 0;
  resumes = true;
  vi.stubGlobal('AudioContext', FakeContext);
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))));
  window.localStorage.clear();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('the first gesture', () => {
  it('plays a cue asked for before the audio opened, as soon as it does', async () => {
    resumes = false;
    renderHook(() => { useSoundEffects(); });
    fireEvent.pointerDown(document.body);
    playSound('switch');
    await settle();
    expect(started).toHaveLength(0);
    resumes = true;
    fireEvent.pointerUp(document.body);
    await settle();
    expect(started).toHaveLength(1);
  });

  it('does not let the tap that follows take its place', async () => {
    renderHook(() => { useSoundEffects(); });
    resumes = false;
    fireEvent.pointerDown(document.body);
    playSound('switch');
    playSound('tap');
    resumes = true;
    fireEvent.pointerUp(document.body);
    await settle();
    expect(started).toHaveLength(1);
    expect(started[0]?.buffer).toBeDefined();
  });

  it('forgets a cue the audio took too long to open for', async () => {
    vi.useFakeTimers({ toFake: ['performance'] });
    renderHook(() => { useSoundEffects(); });
    resumes = false;
    fireEvent.pointerDown(document.body);
    playSound('switch');
    vi.advanceTimersByTime(3000);
    resumes = true;
    fireEvent.pointerUp(document.body);
    await settle();
    expect(started).toHaveLength(0);
  });
});

describe('a cue cut short', () => {
  it('stops at the asked length and fades instead of clicking', async () => {
    renderHook(() => { useSoundEffects(); });
    fireEvent.pointerDown(document.body);
    await settle();
    playSound('weld', { seconds: 1 });
    expect(started[0]?.stop).toHaveBeenCalledWith(1);
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 1);
  });
});

/**
 * THE CHARGE LASTS THE HOLD (owner 2026-11-13). The file is 0.47 s and only 0.115–0.285 s of it sounds,
 * so a 1 s hold went quiet half way. Held, the cue loops the part that sounds, quickens and rises with the
 * dial, and lets go with a short fade the moment it is released.
 */
describe('a cue held down', () => {
  const open = async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(url.includes('/charge-v1.')
      ? new Response(new ArrayBuffer(8)) : new Response(null, { status: 404 }))));
    renderHook(() => { useSoundEffects(); });
    fireEvent.pointerDown(document.body);
    await act(async () => { await new Promise((done) => { setTimeout(done, 0); }); });
  };

  it('loops the part that sounds, from its first note, and rises over the hold', async () => {
    await open();
    holdSound('charge', 1);
    const voice = started[0];
    expect(voice?.loop).toBe(true);
    expect(voice?.loopStart).toBeCloseTo(0.115, 3);
    expect(voice?.loopEnd).toBeCloseTo(0.285, 3);
    expect(voice?.start).toHaveBeenCalledWith(0, voice?.loopStart);
    expect(voice?.playbackRate.linearRampToValueAtTime).toHaveBeenCalledWith(1.5, 1);
    expect(voice?.stop).not.toHaveBeenCalledWith(expect.any(Number));
  });

  it('fades out and stops the moment it is let go, and only once', async () => {
    await open();
    const letGo = holdSound('charge', 1);
    letGo();
    letGo();
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 0.06);
    expect(started[0]?.stop).toHaveBeenCalledOnce();
    expect(started[0]?.stop).toHaveBeenCalledWith(0.06);
  });

  it('is silent and harmless before the audio opens', () => {
    renderHook(() => { useSoundEffects(); });
    const letGo = holdSound('charge', 1);
    expect(() => { letGo(); }).not.toThrow();
    expect(started).toHaveLength(0);
  });
});

