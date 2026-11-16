/** Second the telescope's wave reaches the hidden world. */
export const SCAN_ARRIVES = 0.9;
/** Second the sweep has crossed it and the reticle locks. */
export const SCAN_LOCKS = 2.1;

export interface ScanFrame {
  /** 0..1 how far the wave has come from home to the world; past 1 it runs on and fades. */
  wave: number;
  /** The sweep band's height on the world, +1 top to −1 bottom. */
  sweep: number;
  band: number;
  /** The grid left behind the band. */
  grid: number;
  reticle: number;
  /** Reticle radius in world radii. */
  reticleSize: number;
  /** The owner's colour on the world, once known. */
  reveal: number;
}

const ramp = (t: number, start: number, span: number): number => Math.max(0, Math.min(1, (t - start) / span));
const QUIET: ScanFrame = { wave: 0, sweep: 1, band: 0, grid: 0, reticle: 0, reticleSize: 1.6, reveal: 0 };

/** The telescope looks: a wave leaves home, a band sweeps the world, the reticle locks, the owner shows. */
export function scanFrame(seconds: number): ScanFrame {
  if (!Number.isFinite(seconds) || seconds < 0) return QUIET;
  const t = seconds;
  const sweeping = t > SCAN_ARRIVES && t < SCAN_LOCKS;
  const close = ramp(t, SCAN_ARRIVES, SCAN_LOCKS - SCAN_ARRIVES);
  return {
    wave: t / SCAN_ARRIVES,
    sweep: 1 - 2 * close,
    band: sweeping ? Math.sin(Math.PI * Math.min(1, close * 1.1 + 0.05)) ** 0.3 : 0,
    grid: ramp(t, SCAN_ARRIVES, 0.2) * (1 - ramp(t, SCAN_LOCKS, 0.9)),
    reticle: ramp(t, SCAN_ARRIVES, 0.25) * (1 - ramp(t, SCAN_LOCKS + 1.4, 0.6)),
    reticleSize: 1.6 - 0.3 * close ** 2 - (t >= SCAN_LOCKS ? 0.06 * Math.exp(-(t - SCAN_LOCKS) * 9) : 0),
    reveal: ramp(t, SCAN_LOCKS, 0.35),
  };
}
