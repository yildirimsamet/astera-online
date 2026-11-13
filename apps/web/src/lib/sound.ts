import { useEffect, useSyncExternalStore } from 'react';
import { z } from 'zod';
import { isAppActive, watchAppActivity } from '../platform/activity.js';
import { SYNTH_CUES, synthesize, type SynthCue } from './synth.js';

/** The game kit's own moments (owner's picks 2026-11-12, Kenney CC0, levelled to the cues above). */
type KitCue = 'rattle' | 'unseal' | 'rankup' | 'tick' | 'charge' | 'refuse' | 'lever' | 'tab';
type FileCue = 'tap' | 'confirm' | 'alert' | 'launch' | 'cargo' | 'weapon' | 'shield' | 'impact' | 'strategic' | 'mining' | KitCue;
export type SoundCue = FileCue | SynthCue;
const CUES: readonly FileCue[] = ['tap', 'confirm', 'alert', 'launch', 'cargo', 'weapon', 'shield', 'impact', 'strategic', 'mining',
  'rattle', 'unseal', 'rankup', 'tick', 'charge', 'refuse', 'lever', 'tab'];
const COOLDOWN: Record<SoundCue, number> = { tap: 55, confirm: 450, alert: 1400, launch: 900, cargo: 650, weapon: 240, shield: 500, impact: 500, strategic: 3000, mining: 1100,
  rattle: 300, unseal: 1200, rankup: 2000, tick: 30, charge: 400, refuse: 350, lever: 250, tab: 80,
  switch: 400, ignite: 1500, weld: 300, warp: 1500, claim: 1200, crate: 600, arc: 300 };
const MIX: Record<SoundCue, number> = { tap: 0.55, confirm: 0.7, alert: 0.7, launch: 0.8, cargo: 0.75, weapon: 0.42, shield: 0.65, impact: 0.75, strategic: 0.9, mining: 0.55,
  rattle: 0.7, unseal: 0.8, rankup: 0.85, tick: 0.5, charge: 0.6, refuse: 0.65, lever: 0.8, tab: 0.55,
  switch: 0.85, ignite: 0.8, weld: 0.5, warp: 0.85, claim: 0.75, crate: 0.8, arc: 0.5 };
const DEFAULT_VOLUME = 0.5;
const MAX_VOICES = 6;
const KEY = 'astera.effects.v1';
interface Preference { enabled: boolean; volume: number }
const preferenceSchema = z.object({ enabled: z.boolean(), volume: z.number().finite().min(0).max(1) });
function initial(): Preference {
  try {
    const parsed = preferenceSchema.safeParse(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
    if (parsed.success) return parsed.data;
  } catch { /* Private/read-only storage keeps the control usable for this session. */ }
  return { enabled: true, volume: DEFAULT_VOLUME };
}
let preference = initial();
const subscribers = new Set<() => void>();
const subscribe = (notify: () => void) => { subscribers.add(notify); return () => { subscribers.delete(notify); }; };
let mixer: SoundMixer | null = null;
export const useEffectsEnabled = () => useSyncExternalStore(subscribe, () => preference.enabled, () => true);
export const useEffectsVolume = () => useSyncExternalStore(subscribe, () => preference.volume, () => DEFAULT_VOLUME);
function save(next: Preference): void {
  preference = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Session still works. */ }
  mixer?.setPreference(next);
  subscribers.forEach((notify) => { notify(); });
}
export function setEffectsEnabled(enabled: boolean): void { save({ ...preference, enabled }); }
export function setEffectsVolume(volume: number): void {
  if (Number.isFinite(volume)) save({ ...preference, volume: Math.min(1, Math.max(0, volume)) });
}
export interface SoundOptions {
  gain?: number; pan?: number; key?: string;
  /** Cut the cue to this length, with a short fade so it does not click. */
  seconds?: number;
}

/** How long a cue waits for the audio to open: long enough for a finger to lift, not long enough to sound late. */
const WAITS_MS = 1_200;
const FADE_SECONDS = 0.06;

/** A cue may fail silently, never delay or reject the action it accompanies. */
/**
 * Marks a control, or the group it sits in, that plays its own sound (the game kit: a tab clicks, a
 * lever throws, a locked press says no). The mixer's own click is for every other button.
 */
export const OWN_SOUND = { 'data-own-sound': '' } as const;

/** Whether the mixer's click sounds for a click on `target`: a live control without a sound of its own. */
export function tapsFor(target: Element): boolean {
  const control = target.closest('button, [role="button"], [role="tab"], summary');
  if (!control || control.hasAttribute('disabled') || control.getAttribute('aria-disabled') === 'true') return false;
  return control.closest('[data-own-sound]') === null;
}

export function playSound(cue: SoundCue, options: SoundOptions = {}): void {
  try { mixer?.play(cue, options); } catch { /* Browser audio failure cannot reject a game action. */ }
}

/**
 * Where a held cue sounds inside its file, in seconds: the loop skips the silence around it. The charge
 * file is 0.47 s and sounds only from 0.115 s to 0.285 s (measured 2026-11-13).
 */
const SUSTAIN: Partial<Record<SoundCue, { from: number; to: number }>> = { charge: { from: 0.115, to: 0.285 } };
/** How much a held cue quickens and rises by the end of its hold. */
const HOLD_RISE = 1.5;
const NOTHING = (): void => undefined;

/**
 * A cue that lasts while a finger is down (owner 2026-11-13): it loops, quickens and rises over
 * `seconds`, and the returned function lets it go with a short fade.
 */
export function holdSound(cue: SoundCue, seconds: number): () => void {
  try { return mixer?.hold(cue, seconds) ?? NOTHING; } catch { return NOTHING; }
}

class SoundMixer {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<SoundCue, AudioBuffer>();
  private voices = new Set<AudioBufferSourceNode>();
  private last = new Map<SoundCue, number>();
  private seen = new Map<string, number>();
  private abort = new AbortController();
  private disposed = false;
  /** The latest cue asked for before the audio opened (a phone opens it only when the finger lifts). */
  private waiting: { cue: SoundCue; options: SoundOptions; at: number } | null = null;

  /** Called synchronously from a real gesture, including the first tap. */
  unlock = (): void => {
    if (this.disposed || !preference.enabled || preference.volume === 0 || !isAppActive() || typeof AudioContext === 'undefined') return;
    if (!this.context) {
      let context: AudioContext | null = null;
      try {
        context = new AudioContext({ latencyHint: 'interactive' });
        const master = context.createGain();
        master.gain.value = preference.volume;
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -12;
        limiter.knee.value = 18;
        limiter.ratio.value = 6;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.18;
        master.connect(limiter).connect(context.destination);
        this.context = context;
        this.master = master;
        for (const cue of CUES) void this.load(cue, context);
        // Drawn on the device: no fetch, ready on the very gesture that unlocked audio.
        for (const cue of SYNTH_CUES) {
          const samples = synthesize(cue, context.sampleRate);
          const buffer = context.createBuffer(1, samples.length, context.sampleRate);
          buffer.copyToChannel(samples, 0);
          this.buffers.set(cue, buffer);
        }
      } catch {
        if (context) void context.close().catch(() => { /* Partially constructed audio graph. */ });
        return;
      }
    }
    if (this.context.state === 'suspended') void this.context.resume().then(this.playWaiting).catch(() => { /* Autoplay/OS policy. */ });
    else this.playWaiting();
  };

  private playWaiting = (): void => {
    const waiting = this.waiting;
    this.waiting = null;
    if (waiting && performance.now() - waiting.at <= WAITS_MS) this.play(waiting.cue, waiting.options);
  };

  private async load(cue: FileCue, context: AudioContext): Promise<void> {
    try {
      const response = await fetch(`/assets/audio/premium/${cue}-v1.mp3`, { signal: this.abort.signal });
      if (!response.ok) return;
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      if (!this.disposed) this.buffers.set(cue, buffer);
    } catch { /* Missing codec, interrupted fetch or teardown is silent and never retried in a loop. */ }
  }

  setPreference(next: Preference): void {
    if (this.master && this.context) this.master.gain.setTargetAtTime(next.volume, this.context.currentTime, 0.025);
    if (!next.enabled || next.volume === 0) this.stop();
    else this.unlock();
  }

  play(cue: SoundCue, options: SoundOptions): void {
    const { gain = 1, pan = 0, key, seconds } = options;
    const context = this.context, master = this.master, buffer = this.buffers.get(cue);
    if (context?.state !== 'running' && cue !== 'tap' && !this.disposed && preference.enabled && preference.volume > 0) {
      this.waiting = { cue, options, at: performance.now() };
      return;
    }
    if (this.disposed || !preference.enabled || preference.volume === 0 || !isAppActive()
      || context?.state !== 'running' || !master || !buffer || !Number.isFinite(gain) || gain <= 0 || !Number.isFinite(pan)) return;
    const now = performance.now();
    if (key && (this.seen.get(key) ?? -Infinity) > now - 60_000) return;
    if (now - (this.last.get(cue) ?? -Infinity) < COOLDOWN[cue]) return;
    if (this.voices.size >= MAX_VOICES) {
      if (cue === 'tap' || cue === 'tick' || cue === 'weapon' || cue === 'mining') return;
      const oldest = this.voices.values().next().value;
      if (oldest) { oldest.stop(); this.voices.delete(oldest); }
    }
    this.last.set(cue, now);
    if (key) {
      this.seen.set(key, now);
      if (this.seen.size > 128) {
        const oldest = this.seen.keys().next().value;
        if (oldest !== undefined) this.seen.delete(oldest);
      }
    }
    const voice = context.createBufferSource();
    const level = context.createGain();
    const panner = context.createStereoPanner();
    voice.buffer = buffer;
    level.gain.value = Math.min(1, gain) * MIX[cue];
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    voice.connect(level).connect(panner).connect(master);
    this.voices.add(voice);
    const release = () => { this.voices.delete(voice); voice.disconnect(); level.disconnect(); panner.disconnect(); };
    voice.onended = release;
    try {
      voice.start();
      if (seconds !== undefined) {
        const end = context.currentTime + seconds;
        level.gain.setValueAtTime(level.gain.value, end - FADE_SECONDS);
        level.gain.linearRampToValueAtTime(0, end);
        voice.stop(end);
      }
    } catch { release(); }
  }

  hold(cue: SoundCue, seconds: number): () => void {
    const context = this.context, master = this.master, buffer = this.buffers.get(cue);
    if (this.disposed || !preference.enabled || preference.volume === 0 || !isAppActive()
      || context?.state !== 'running' || !master || !buffer || !Number.isFinite(seconds) || seconds <= 0) return NOTHING;
    if (this.voices.size >= MAX_VOICES) {
      const oldest = this.voices.values().next().value;
      if (oldest) { oldest.stop(); this.voices.delete(oldest); }
    }
    const span = SUSTAIN[cue] ?? { from: 0, to: buffer.duration };
    const voice = context.createBufferSource();
    const level = context.createGain();
    const now = context.currentTime;
    voice.buffer = buffer;
    voice.loop = true;
    voice.loopStart = span.from;
    voice.loopEnd = span.to;
    voice.playbackRate.setValueAtTime(1, now);
    voice.playbackRate.linearRampToValueAtTime(HOLD_RISE, now + seconds);
    level.gain.value = MIX[cue];
    voice.connect(level).connect(master);
    this.voices.add(voice);
    const release = () => { this.voices.delete(voice); voice.disconnect(); level.disconnect(); };
    voice.onended = release;
    try { voice.start(now, span.from); } catch { release(); return NOTHING; }
    let held = true;
    return () => {
      if (!held) return;
      held = false;
      try {
        const at = context.currentTime;
        level.gain.cancelScheduledValues(at);
        level.gain.setValueAtTime(level.gain.value, at);
        level.gain.linearRampToValueAtTime(0, at + FADE_SECONDS);
        voice.stop(at + FADE_SECONDS);
      } catch { release(); }
    };
  }

  private stop(): void {
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
  }
  visibility = (): void => {
    if (!isAppActive()) {
      this.stop();
      if (this.context?.state === 'running') void this.context.suspend().catch(() => { /* OS already suspended. */ });
    } else if (this.context) this.unlock();
  };
  click = (event: MouseEvent): void => {
    if (event.defaultPrevented || !event.isTrusted || !(event.target instanceof Element)) return;
    if (!tapsFor(event.target)) return;
    this.unlock();
    this.play('tap', {});
  };
  keyboard = (event: KeyboardEvent): void => { if (event.isTrusted && (event.key === 'Enter' || event.key === ' ')) this.unlock(); };
  destroy(): void {
    this.disposed = true;
    this.abort.abort();
    this.stop();
    this.buffers.clear();
    this.master?.disconnect();
    this.master = null;
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => { /* Already closed by the OS. */ });
    this.context = null;
  }
}

/** One mixer for the App lifetime. StrictMode teardown closes all decoders and voices. */
export function useSoundEffects(): void {
  useEffect(() => {
    const controller = new SoundMixer();
    mixer = controller;
    document.addEventListener('pointerdown', controller.unlock, { passive: true });
    document.addEventListener('pointerup', controller.unlock, { passive: true });
    document.addEventListener('keydown', controller.keyboard);
    document.addEventListener('click', controller.click);
    const stopActivity = watchAppActivity(controller.visibility);
    return () => {
      document.removeEventListener('pointerdown', controller.unlock);
      document.removeEventListener('pointerup', controller.unlock);
      document.removeEventListener('keydown', controller.keyboard);
      document.removeEventListener('click', controller.click);
      stopActivity();
      if (mixer === controller) mixer = null;
      controller.destroy();
    };
  }, []);
}
