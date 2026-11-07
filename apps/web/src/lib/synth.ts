/**
 * SOUNDS DRAWN FROM CODE (owner 2026-11-06: "Ses bile yok!"). The moments the prologue is made of —
 * a breaker thrown, a furnace catching, a weld, a jump, a ship answering — are synthesized once when
 * audio unlocks: no file to fetch, nothing to wait for, the same sound every time.
 */
export const SYNTH_CUES = ['switch', 'ignite', 'weld', 'warp', 'claim', 'crate', 'arc'] as const;
export type SynthCue = (typeof SYNTH_CUES)[number];

/** The furnace roars as long as the prologue's burn (`BURN_MS`, 6 s) and the torch as long as its patch
 * (`PATCH_MS`, 7 s), each with a breath after. */
const SECONDS: Record<SynthCue, number> = { switch: 0.9, ignite: 6.4, weld: 7.4, warp: 2.1, claim: 1.8, crate: 1.5, arc: 0.9 };

/** Mulberry32: a seeded noise, so a cue is identical on every device and every run. */
function noiseSource(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

/** One-pole low-pass, enough to turn hiss into roar. */
function lowPass(rate: number): (input: number, cutoff: number) => number {
  let last = 0;
  return (input, cutoff) => {
    const a = 1 - Math.exp((-2 * Math.PI * cutoff) / rate);
    last += a * (input - last);
    return last;
  };
}

const decay = (t: number, start: number, tau: number): number => (t < start ? 0 : Math.exp(-(t - start) / tau));
const ramp = (t: number, from: number, to: number): number => Math.min(1, Math.max(0, (t - from) / (to - from)));

function sample(cue: SynthCue, t: number, rate: number, state: { noise: () => number; lp: ReturnType<typeof lowPass>; lp2: ReturnType<typeof lowPass>; phase: number }): number {
  const n = state.noise();
  switch (cue) {
    case 'switch': {
      // The lever's clack, the contact's thunk, a second latch, then current humming through.
      const clack = (n - state.lp(n, 1800)) * decay(t, 0, 0.006) * 0.9;
      const latch = (n - state.lp2(n, 2400)) * decay(t, 0.045, 0.005) * 0.55;
      const drop = 90 - 35 * ramp(t, 0, 0.08);
      state.phase += (2 * Math.PI * drop) / rate;
      const thunk = Math.sin(state.phase) * decay(t, 0, 0.14);
      const buzzEnv = ramp(t, 0.09, 0.12) * decay(t, 0.12, 0.28);
      const saw = ((t * 100) % 1) * 2 - 1;
      const buzz = (saw * 0.6 + Math.sin(2 * Math.PI * 200 * t) * 0.4) * (0.7 + 0.3 * n) * buzzEnv * 0.28;
      return clack + latch + thunk + buzz;
    }
    case 'ignite': {
      // Gas meets the spark: a rising whoosh, then the furnace roars, breathing, until the batch is out.
      const cutoff = 300 + 2200 * ramp(t, 0, 0.5);
      const whoosh = state.lp(n, cutoff) * ramp(t, 0, 0.35) * (t < 0.5 ? 1.6 : 1.6 * decay(t, 0.5, 0.5));
      const burn = ramp(t, 0.3, 0.9) * (t < 5.9 ? 1 : decay(t, 5.9, 0.15)) * (0.8 + 0.2 * Math.sin(2 * Math.PI * 0.9 * t) + 0.08 * Math.sin(2 * Math.PI * 2.3 * t));
      const roar = state.lp2(n, 520 + 160 * Math.sin(2 * Math.PI * 0.35 * t)) * 2.4 * burn;
      const rumble = (Math.sin(2 * Math.PI * 48 * t) + 0.6 * Math.sin(2 * Math.PI * 72 * t)) * burn * 0.32;
      const crackle = Math.abs(n) > 0.996 ? n * 0.55 * burn : 0;
      return whoosh + roar + rumble + crackle;
    }
    case 'arc': {
      // The torch struck: sparse snaps over a mains buzz, gone inside a second.
      const hold = ramp(t, 0, 0.03) * decay(t, 0.6, 0.07);
      const snaps = Math.abs(n) > 0.97 ? n * 0.9 : 0;
      const buzz = Math.sign(Math.sin(2 * Math.PI * 120 * t)) * 0.12;
      return (state.lp(snaps, 5200) * 1.4 + buzz + state.lp2(n, 4000) * 0.25) * hold;
    }
    case 'weld': {
      // A plasma torch: it catches with a pop, then hisses and hums, crackling on the sparks' half-second
      // beat, until the patch holds.
      const on = ramp(t, 0, 0.05) * (t < 6.95 ? 1 : decay(t, 6.95, 0.08));
      const pop = (n - state.lp(n, 3000)) * decay(t, 0, 0.02) * 0.9;
      const hiss = (n - state.lp2(n, 2400)) * 0.5 * (0.85 + 0.15 * Math.sin(2 * Math.PI * 3.1 * t));
      const hum = (Math.sin(2 * Math.PI * 180 * t) * 0.5 + Math.sign(Math.sin(2 * Math.PI * 90 * t)) * 0.08) * 0.35;
      const crackle = Math.abs(n) > 0.95 ? n * 0.8 * decay(t % 0.5, 0, 0.06) : 0;
      return pop + (hiss + hum + crackle) * on;
    }
    case 'warp': {
      // The drive spooling up the scale, the stars streaking, and the drop back into normal space.
      const sweep = 120 * Math.pow(15, Math.min(1, t / 1.4));
      state.phase += (2 * Math.PI * sweep) / rate;
      const climb = ramp(t, 0, 1.3) * (t < 1.45 ? 1 : decay(t, 1.45, 0.04));
      const tone = Math.sin(state.phase) * climb * 0.45;
      const air = (n - state.lp(n, 400 + 3000 * ramp(t, 0, 1.4))) * climb * 0.35;
      const boom = (Math.sin(2 * Math.PI * 46 * t) * 0.9 + state.lp2(n, 300) * 1.2) * decay(t, 1.45, 0.22) * (t >= 1.45 ? 1 : 0);
      return tone + air + boom;
    }
    case 'crate': {
      // A salvage crate: the latch snaps, the seal lets go with a hiss, the lid lands, and what it held rings out.
      const latch = (n - state.lp(n, 2600)) * decay(t, 0, 0.005) * 1.1;
      const hiss = (n - state.lp2(n, 3200)) * ramp(t, 0.02, 0.05) * decay(t, 0.05, 0.18) * 0.55;
      state.phase += (2 * Math.PI * (70 - 25 * ramp(t, 0.12, 0.3))) / rate;
      const lid = Math.sin(state.phase) * decay(t, 0.14, 0.12) * (t >= 0.14 ? 0.9 : 0);
      const notes = [659.25, 830.61, 987.77, 1318.5];
      const chime = notes.reduce((sum, f, i) => {
        const at = 0.3 + i * 0.09;
        return sum + Math.sin(2 * Math.PI * f * (t - at)) * decay(t, at, 0.35) * (t >= at ? 1 : 0) / (1 + i * 0.25);
      }, 0);
      return latch + hiss + lid + chime * 0.32;
    }
    case 'claim': {
      // A ship answering: an open chord that blooms and rings out.
      const env = ramp(t, 0, 0.06) * decay(t, 0.06, 0.55);
      const chord = [110, 164.81, 220, 277.18, 329.63]
        .reduce((sum, f, i) => sum + Math.sin(2 * Math.PI * f * t + i) / (1 + i * 0.35), 0);
      const shimmer = Math.sin(2 * Math.PI * 1318.5 * t) * 0.12 * decay(t, 0.12, 0.35);
      return (chord * 0.28 + shimmer) * env;
    }
  }
}

/** Mono samples, normalized below clipping, faded to silence at the end. */
export function synthesize(cue: SynthCue, rate: number): Float32Array<ArrayBuffer> {
  const length = Math.round(SECONDS[cue] * rate);
  const out = new Float32Array(length);
  const state = { noise: noiseSource(SYNTH_CUES.indexOf(cue) * 7919 + 17), lp: lowPass(rate), lp2: lowPass(rate), phase: 0 };
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const value = sample(cue, i / rate, rate, state);
    out[i] = value;
    peak = Math.max(peak, Math.abs(value));
  }
  const scale = peak > 0 ? 0.9 / peak : 0;
  const fade = Math.round(0.02 * rate);
  for (let i = 0; i < length; i++) {
    const tail = i >= length - fade ? (length - 1 - i) / fade : 1;
    out[i] = (out[i] ?? 0) * scale * tail;
  }
  return out;
}
