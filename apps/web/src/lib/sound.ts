import { useEffect, useSyncExternalStore } from 'react';
import { z } from 'zod';
import { isAppActive, watchAppActivity } from '../platform/activity.js';

export type SoundCue = 'tap' | 'confirm' | 'alert' | 'launch' | 'cargo' | 'weapon' | 'shield' | 'impact' | 'strategic' | 'mining';
const CUES: readonly SoundCue[] = ['tap', 'confirm', 'alert', 'launch', 'cargo', 'weapon', 'shield', 'impact', 'strategic', 'mining'];
const COOLDOWN: Record<SoundCue, number> = { tap: 55, confirm: 450, alert: 1400, launch: 900, cargo: 650, weapon: 240, shield: 500, impact: 500, strategic: 3000, mining: 1100 };
const MIX: Record<SoundCue, number> = { tap: 0.55, confirm: 0.7, alert: 0.7, launch: 0.8, cargo: 0.75, weapon: 0.42, shield: 0.65, impact: 0.75, strategic: 0.9, mining: 0.55 };
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
export interface SoundOptions { gain?: number; pan?: number; key?: string }

/** A cue may fail silently, never delay or reject the action it accompanies. */
export function playSound(cue: SoundCue, options: SoundOptions = {}): void {
  try { mixer?.play(cue, options); } catch { /* Browser audio failure cannot reject a game action. */ }
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
      } catch {
        if (context) void context.close().catch(() => { /* Partially constructed audio graph. */ });
        return;
      }
    }
    if (this.context.state === 'suspended') void this.context.resume().catch(() => { /* Autoplay/OS policy. */ });
  };

  private async load(cue: SoundCue, context: AudioContext): Promise<void> {
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

  play(cue: SoundCue, { gain = 1, pan = 0, key }: SoundOptions): void {
    const context = this.context, master = this.master, buffer = this.buffers.get(cue);
    if (this.disposed || !preference.enabled || preference.volume === 0 || !isAppActive()
      || context?.state !== 'running' || !master || !buffer || !Number.isFinite(gain) || gain <= 0 || !Number.isFinite(pan)) return;
    const now = performance.now();
    if (key && (this.seen.get(key) ?? -Infinity) > now - 60_000) return;
    if (now - (this.last.get(cue) ?? -Infinity) < COOLDOWN[cue]) return;
    if (this.voices.size >= MAX_VOICES) {
      if (cue === 'tap' || cue === 'weapon' || cue === 'mining') return;
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
    try { voice.start(); } catch { release(); }
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
    const control = event.target.closest('button, [role="button"], [role="tab"], summary');
    if (!control || control.hasAttribute('disabled') || control.getAttribute('aria-disabled') === 'true') return;
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
    document.addEventListener('keydown', controller.keyboard);
    document.addEventListener('click', controller.click);
    const stopActivity = watchAppActivity(controller.visibility);
    return () => {
      document.removeEventListener('pointerdown', controller.unlock);
      document.removeEventListener('keydown', controller.keyboard);
      document.removeEventListener('click', controller.click);
      stopActivity();
      if (mixer === controller) mixer = null;
      controller.destroy();
    };
  }, []);
}
