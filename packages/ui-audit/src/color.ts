/**
 * HOW MANY COLOURS A SURFACE SPEAKS IN.
 *
 * Hue families are counted in OKLCH, where equal hue steps look equal. Greys and the
 * dark tinted plates the HUD sits on are neutral: a navy at 20 % lightness reads as
 * "dark", not as "blue".
 */

import type { Rgb } from './contrast.js';

export interface Oklch {
  l: number;
  c: number;
  /** Degrees, 0–360. */
  h: number;
}

const linear = (channel: number): number => {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** Björn Ottosson's OKLab, in polar form. */
export function toOklch([red, green, blue]: Rgb): Oklch {
  const r = linear(red);
  const g = linear(green);
  const b = linear(blue);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

/** Grey, near-grey, or a tint too dark to read as a hue. */
export function isNeutral(rgb: Rgb): boolean {
  const { l, c } = toOklch(rgb);
  return c < 0.04 || (l < 0.25 && c < 0.07);
}

export interface HueFamily {
  /** Weighted mean hue, degrees. */
  hue: number;
  weight: number;
  /** Share of all non-neutral weight on the surface. */
  share: number;
}

/** Hues closer than this belong to one family. */
const FAMILY_GAP = 24;

export function hueFamilies(items: readonly { rgb: Rgb; weight: number }[]): HueFamily[] {
  const coloured = items
    .filter((item) => !isNeutral(item.rgb))
    .map((item) => ({ h: toOklch(item.rgb).h, weight: item.weight }))
    .sort((a, b) => a.h - b.h);
  if (coloured.length === 0) return [];

  const groups: { h: number; weight: number }[][] = [];
  for (const item of coloured) {
    const group = groups.at(-1);
    const last = group?.at(-1);
    if (group && last && item.h - last.h <= FAMILY_GAP) group.push(item);
    else groups.push([item]);
  }
  const first = groups[0];
  const lastGroup = groups.at(-1);
  if (groups.length > 1 && first && lastGroup) {
    const seam = (first[0]?.h ?? 0) + 360 - (lastGroup.at(-1)?.h ?? 0);
    if (seam <= FAMILY_GAP) groups[0] = [...(groups.pop() ?? []), ...first];
  }

  const total = coloured.reduce((sum, item) => sum + item.weight, 0);
  return groups
    .map((group) => {
      const weight = group.reduce((sum, item) => sum + item.weight, 0);
      const x = group.reduce((sum, item) => sum + Math.cos((item.h * Math.PI) / 180) * item.weight, 0);
      const y = group.reduce((sum, item) => sum + Math.sin((item.h * Math.PI) / 180) * item.weight, 0);
      const hue = (Math.atan2(y, x) * 180) / Math.PI;
      return { hue: hue < 0 ? hue + 360 : hue, weight, share: weight / total };
    })
    .sort((a, b) => b.share - a.share);
}
