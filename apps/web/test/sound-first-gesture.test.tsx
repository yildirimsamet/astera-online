import { act, cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playSound, useSoundEffects } from '../src/lib/sound.js';

/**
 * THE FIRST THING THE PLAYER TOUCHES HAS TO SOUND (owner playtest 2026-11-08). A phone opens audio only
 * when the finger lifts, and the prologue's breaker is thrown while it is still down: the cue waits a
 * moment for the audio to open instead of being lost.
 */
let resumes = true;
const started: { buffer: unknown; stop: ReturnType<typeof vi.fn> }[] = [];
let gain: { value: number; setValueAtTime: ReturnType<typeof vi.fn>; linearRampToValueAtTime: ReturnType<typeof vi.fn> };

class FakeContext {
  state = 'suspended';
  sampleRate = 8000;
  currentTime = 0;
  destination = {};
  private node = () => ({ connect: (next: unknown) => next, disconnect: () => undefined });
  createGain() {
    gain = { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() };
    return { ...this.node(), gain };
  }
  createDynamicsCompressor() {
    const param = { value: 0 };
    return { ...this.node(), threshold: param, knee: param, ratio: param, attack: param, release: param };
  }
  createStereoPanner() { return { ...this.node(), pan: { value: 0 } }; }
  createBuffer() { return { copyToChannel: () => undefined }; }
  createBufferSource() {
    const voice = { ...this.node(), buffer: null as unknown, onended: null, start: vi.fn(() => { started.push(voice); }), stop: vi.fn() };
    return voice;
  }
  decodeAudioData() { return Promise.reject(new Error('no files here')); }
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
