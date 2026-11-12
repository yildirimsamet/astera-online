/**
 * CONTRAST AGAINST WHAT IS REALLY BEHIND THE TEXT.
 *
 * Token pairs say a label is 7:1 on its plate; the plate is translucent and the galaxy
 * moves behind it. XAG 102 measures against the worst region of a varied background, so
 * the audit reads every pixel under the glyph box from a screenshot taken with the text
 * made transparent, and blends the text colour over each one.
 */

export type Rgb = readonly [number, number, number];

/** A decoded screenshot region: RGB or RGBA bytes, row after row. */
export interface Pixels {
  data: ArrayLike<number>;
  channels: 3 | 4;
}

const linear = (channel: number): number => {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG 2.x relative luminance. */
export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG 2.x contrast ratio, 1 to 21, order-free. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `fg` at `alpha` over `bg`, blended the way browsers do: in sRGB, not linear light. */
export function composite(fg: Rgb, alpha: number, bg: Rgb): [number, number, number] {
  return [fg[0] * alpha + bg[0] * (1 - alpha), fg[1] * alpha + bg[1] * (1 - alpha), fg[2] * alpha + bg[2] * (1 - alpha)];
}

const apcaY = ([r, g, b]: Rgb): number => {
  const y = 0.2126729 * (r / 255) ** 2.4 + 0.7151522 * (g / 255) ** 2.4 + 0.072175 * (b / 255) ** 2.4;
  return y > 0.022 ? y : y + (0.022 - y) ** 1.414;
};

/** APCA 0.0.98G-4g lightness contrast Lc: positive for dark text on light, negative for light on dark. */
export function apcaContrast(text: Rgb, background: Rgb): number {
  const yt = apcaY(text);
  const yb = apcaY(background);
  if (Math.abs(yb - yt) < 0.0005) return 0;
  if (yb > yt) {
    const s = (yb ** 0.56 - yt ** 0.57) * 1.14;
    return s < 0.1 ? 0 : (s - 0.027) * 100;
  }
  const s = (yb ** 0.65 - yt ** 0.62) * 1.14;
  return s > -0.1 ? 0 : (s + 0.027) * 100;
}

/** Nearest-rank percentile of an ascending list. */
export function percentile(sorted: readonly number[], p: number): number {
  const value = sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
  if (value === undefined) throw new Error('percentile of an empty list');
  return value;
}

export interface TextContrast {
  /** The single worst pixel: a star behind a stroke. */
  min: number;
  /** The worst five percent, the figure a reader meets in practice. */
  p5: number;
  median: number;
  /** |Lc| of the worst five percent. */
  apcaP5: number;
}

/** Contrast of a text colour at `alpha` over every background pixel under it. */
export function textContrast(text: { rgb: Rgb; alpha: number }, background: Pixels): TextContrast {
  const { data, channels } = background;
  const ratios: number[] = [];
  const lightness: number[] = [];
  for (let at = 0; at + 2 < data.length; at += channels) {
    const bg: Rgb = [data[at] ?? 0, data[at + 1] ?? 0, data[at + 2] ?? 0];
    const fg = composite(text.rgb, text.alpha, bg);
    ratios.push(contrastRatio(fg, bg));
    lightness.push(Math.abs(apcaContrast(fg, bg)));
  }
  if (ratios.length === 0) throw new Error('no background pixels under the text');
  ratios.sort((a, b) => a - b);
  lightness.sort((a, b) => a - b);
  return { min: percentile(ratios, 0), p5: percentile(ratios, 0.05), median: percentile(ratios, 0.5), apcaP5: percentile(lightness, 0.05) };
}
