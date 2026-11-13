/**
 * MEASURING OTHER GAMES FROM PHONE SCREENSHOTS (plan §1.13).
 *
 * Screenshots taken on the owner's S22 at default font and display size. A text line is
 * measured by its ink: the rows of a crop that differ enough from the crop's most common
 * shade. Outlines and drop shadows count as ink, so stroked game text reads a little taller
 * than its glyphs. A button is measured by filling outward from a point inside it.
 */

export interface Raster {
  width: number;
  height: number;
  channels: 3 | 4;
  data: Uint8Array;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Read with adb on 2026-11-11: wm size 1080x2340, wm density 480, font_scale 1.0. */
export const S22 = { width: 1080, height: 2340, density: 3, dpi: { x: 428.625, y: 424.542 } } as const;

/**
 * A length in a screenshot, in dp and mm on the S22. A portrait screenshot's height runs
 * along the panel's long side (y dpi), a landscape one's along its short side (x dpi).
 * `dpr` is the screenshot's pixels per dp: 3 for the phone's own, 2 for our gallery shots,
 * which the S22's Chrome would draw at one dp per CSS px.
 */
export function size(px: number, orientation: 'portrait' | 'landscape', axis: 'vertical' | 'horizontal' = 'vertical', dpr: number = S22.density): { px: number; dp: number; mm: number } {
  const alongLong = (orientation === 'portrait') === (axis === 'vertical');
  const dpi = alongLong ? S22.dpi.y : S22.dpi.x;
  const dp = px / dpr;
  return { px, dp, mm: (dp * S22.density * 25.4) / dpi };
}

/**
 * What part of the em a line inks. Cap height ~0.72 em (digits too), ascender to descender
 * ~0.95 em, capitals with marks above ~0.88 em, x-height ~0.52 em: typical of the sans faces
 * these games use. Checked on our own Archivo text against its real CSS size: within 7 %
 * (2026-11-11). Outlines and shadows push a game's estimate up.
 */
export type InkShape = 'caps' | 'full' | 'accented' | 'lower';
const EM_SHARE: Record<InkShape, number> = { caps: 0.72, full: 0.95, accented: 0.88, lower: 0.52 };

export function inkShape(text: string): InkShape {
  if (/[gjpqyşçğŞÇQ,;()[\]{}|_/]/.test(text)) return 'full';
  if (/[ÜÖİĞÂÎÛÉ]/.test(text)) return 'accented';
  if (/[A-Z0-9bdfhkliıtüöâîû%#&?!]/.test(text)) return 'caps';
  return 'lower';
}

export const emFromInk = (ink: number, shape: InkShape): number => ink / EM_SHARE[shape];

const luma = (r: Raster, i: number) => 0.2126 * (r.data[i] ?? 0) + 0.7152 * (r.data[i + 1] ?? 0) + 0.0722 * (r.data[i + 2] ?? 0);

/**
 * Rows of ink grouped into lines; `contrast` is the luma distance from the background.
 * `joinMarks` keeps a dot or mark that floats clear of its letters (İ, Ü) in their line; only
 * for text that has such marks, since in other boxes a small shape is an icon or a rule.
 */
export function inkLines(r: Raster, box: Box, { contrast = 60, joinMarks = false } = {}): { top: number; bottom: number; height: number }[] {
  const shades = new Map<number, number>();
  for (let y = box.y; y < box.y + box.h; y += 1) {
    for (let x = box.x; x < box.x + box.w; x += 1) {
      const bucket = Math.round(luma(r, (y * r.width + x) * r.channels) / 8);
      shades.set(bucket, (shades.get(bucket) ?? 0) + 1);
    }
  }
  const background = [...shades.entries()].reduce((best, entry) => (entry[1] > best[1] ? entry : best), [0, -1])[0] * 8;
  const lines: { top: number; bottom: number; height: number }[] = [];
  let top: number | null = null;
  for (let y = box.y; y <= box.y + box.h; y += 1) {
    let ink = false;
    for (let x = box.x; y < box.y + box.h && x < box.x + box.w && !ink; x += 1) ink = Math.abs(luma(r, (y * r.width + x) * r.channels) - background) > contrast;
    if (ink && top === null) top = y;
    if (!ink && top !== null) {
      lines.push({ top, bottom: y - 1, height: y - top });
      top = null;
    }
  }
  if (!joinMarks) return lines.filter((line) => line.height >= 3);
  // A small block close above or below a much taller one is its mark.
  const joined: typeof lines = [];
  for (const line of lines) {
    const last = joined.at(-1);
    const tall = last ? Math.max(last.height, line.height) : 0;
    if (last && line.top - last.bottom - 1 <= Math.max(2, 0.3 * tall) && Math.min(last.height, line.height) <= 0.4 * tall) {
      joined[joined.length - 1] = { top: last.top, bottom: line.bottom, height: line.bottom - last.top + 1 };
    } else joined.push(line);
  }
  return joined.filter((line) => line.height >= 3);
}

/** The bounding box of the area reachable from `seed` through colours close to the seed's. */
export function regionAt(r: Raster, seed: { x: number; y: number }, { tolerance = 60 } = {}): Box {
  const at = (x: number, y: number) => (y * r.width + x) * r.channels;
  const s = at(seed.x, seed.y);
  const base = [r.data[s] ?? 0, r.data[s + 1] ?? 0, r.data[s + 2] ?? 0];
  const close = (i: number) => Math.hypot((r.data[i] ?? 0) - (base[0] ?? 0), (r.data[i + 1] ?? 0) - (base[1] ?? 0), (r.data[i + 2] ?? 0) - (base[2] ?? 0)) <= tolerance;
  const seen = new Uint8Array(r.width * r.height);
  const stack = [seed.y * r.width + seed.x];
  seen[seed.y * r.width + seed.x] = 1;
  let [left, right, top, bottom] = [seed.x, seed.x, seed.y, seed.y];
  for (let p = stack.pop(); p !== undefined; p = stack.pop()) {
    const x = p % r.width;
    const y = (p - x) / r.width;
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (nx < 0 || ny < 0 || nx >= r.width || ny >= r.height) continue;
      const n = ny * r.width + nx;
      if (seen[n] || !close(n * r.channels)) continue;
      seen[n] = 1;
      stack.push(n);
    }
  }
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}
