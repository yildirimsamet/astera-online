export interface JetParticle {
  x: number; y: number; z: number;
  width: number; length: number; age: number; alpha: number; frame: number;
}

/** Continuous flow around one smooth, gently bending centreline, anchored at the mouth.
 * Neighbouring samples share the wave rather than wandering independently.
 * Absolute time and equal spacing avoid catch-up bursts and density beats.
 */
export function jetParticle(index: number, count: number, seconds: number, out: JetParticle): void {
  const age = index === 0 ? 0 : ((seconds * 1.8 + (index - 1) / (count - 1)) % 1 + 1) % 1;
  const taper = Math.sin(Math.PI * (0.08 + age * 0.9));
  const bend = age ** 1.5;
  out.x = age === 0 ? 0 : Math.sin(seconds * 3 - age * 7.2) * .022 * bend;
  out.y = age === 0 ? 0 : Math.sin(seconds * 2.4 - age * 6.2 + 1.1) * .014 * bend;
  out.z = -0.025 - age * 0.7;
  out.width = 0.028 + taper * 0.055;
  out.length = out.width * (2.5 + (index % 4) * 0.35);
  out.age = age;
  out.alpha = (index === 0 ? 1 : Math.min(1, age / 0.04)) * Math.pow(1 - age, 0.55) * 0.68;
  out.frame = index % 9;
}
