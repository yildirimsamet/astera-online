/**
 * HOW A SCREEN LOOKS TO PLAYERS WHO SEE COLOUR DIFFERENTLY (criterion R2).
 *
 * Machado, Oliveira & Fernandes (2009) matrices at full severity, applied in linear RGB:
 * about one man in twelve has a red-green deficiency. The output is for the eye; whether a
 * meaning rests on colour alone is judged in stage 4.
 */

type Matrix = readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];

export const VISION = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
} as const satisfies Record<string, Matrix>;

export type VisionKind = keyof typeof VISION;
export const VISION_KINDS: readonly VisionKind[] = ['protanopia', 'deuteranopia', 'tritanopia'];

const TO_LINEAR = Array.from({ length: 256 }, (_, v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

function toByte(linear: number): number {
  const c = Math.min(1, Math.max(0, linear));
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(s * 255);
}

export function simulate(rgb: readonly [number, number, number], kind: VisionKind): [number, number, number] {
  const m = VISION[kind];
  const r = TO_LINEAR[rgb[0]] ?? 0;
  const g = TO_LINEAR[rgb[1]] ?? 0;
  const b = TO_LINEAR[rgb[2]] ?? 0;
  return [toByte(m[0][0] * r + m[0][1] * g + m[0][2] * b), toByte(m[1][0] * r + m[1][1] * g + m[1][2] * b), toByte(m[2][0] * r + m[2][1] * g + m[2][2] * b)];
}

/** Raw pixels (3 or 4 channels) through the simulation; alpha untouched. */
export function simulatePixels(pixels: Uint8Array, channels: 3 | 4, kind: VisionKind): Uint8Array {
  const out = Uint8Array.from(pixels);
  for (let i = 0; i + 2 < out.length; i += channels) {
    const [r, g, b] = simulate([out[i] ?? 0, out[i + 1] ?? 0, out[i + 2] ?? 0], kind);
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
  }
  return out;
}
