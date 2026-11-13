/**
 * THE THRESHOLDS THE BASELINE IS READ AGAINST.
 *
 * Stage 1 sets no standard; it counts each candidate threshold from the research report
 * (docs/mobil-ui-ux-arastirmasi-2026-11-11.md) so stage 2 can choose with the cost in view.
 */

import { words } from './readability.js';

export type SizeBucket = '<9' | '9–10' | '10–11' | '11–12' | '12–13' | '13–14' | '≥14';

export function sizeBucket(px: number): SizeBucket {
  if (px < 9) return '<9';
  if (px < 10) return '9–10';
  if (px < 11) return '10–11';
  if (px < 12) return '11–12';
  if (px < 13) return '12–13';
  if (px < 14) return '13–14';
  return '≥14';
}

/** WCAG large text: 24 CSS px, or 18.66 px (14 pt) bold. */
export function isLargeText(t: { renderedSize: number; fontWeight: number }): boolean {
  return t.renderedSize >= 24 || (t.renderedSize >= 18.66 && t.fontWeight >= 700);
}

/** WCAG 1.4.3 on the worst five percent of the background: 4.5:1, or 3:1 for large text; disabled controls are exempt. */
export function contrastVerdict(t: { renderedSize: number; fontWeight: number; contrast: { p5: number } | null; inactive?: boolean }): 'pass' | 'fail' | null {
  if (!t.contrast || t.inactive) return null;
  return t.contrast.p5 >= (isLargeText(t) ? 3 : 4.5) ? 'pass' : 'fail';
}

/** Small capitals over more than two words: the hardest form to read (report §1.3). */
export function shoutedSmall(t: { uppercase: boolean; renderedSize: number; text: string }): boolean {
  return t.uppercase && t.renderedSize <= 12 && words(t.text).length > 2;
}

/** Multi-line text set tighter than 1.3; "normal" is font-dependent and left unjudged. */
export function tightLines(t: { lines: number; lineHeight: number | null }): boolean {
  return t.lines > 1 && t.lineHeight !== null && t.lineHeight < 1.3;
}

/** More than fifty characters a line on a phone. */
/** T4: more characters per line than a phone reads well (50), or than XAG allows anywhere (80). */
export function wideLines(t: { lines: number; charsPerLine: number }, limit: 50 | 80 = 50): boolean {
  return t.lines > 1 && t.charsPerLine > limit;
}

export function thinSmall(t: { fontWeight: number; renderedSize: number }): boolean {
  return t.fontWeight < 400 && t.renderedSize < 16;
}

/** Type sizes on a surface, to the half pixel. */
export function distinctSizes(texts: readonly { renderedSize: number }[]): number {
  return new Set(texts.map((t) => Math.round(t.renderedSize * 2) / 2)).size;
}

export type TargetBand = '<24' | '24–44' | '44–48' | '≥48';

/** WCAG 2.5.8 at 24, Apple at 44, Material at 48, by the target's smaller side. */
export function targetBand(region: { width: number; height: number }): TargetBand {
  const side = Math.min(region.width, region.height);
  if (side < 24) return '<24';
  if (side < 44) return '24–44';
  if (side < 48) return '44–48';
  return '≥48';
}

/** Top or bottom 15 % of the screen, where Hoober measured the least precise touches. */
export function edgeBand(box: { top: number; bottom: number }, viewportHeight: number): 'top' | 'middle' | 'bottom' {
  const centre = (box.top + box.bottom) / 2;
  if (centre < viewportHeight * 0.15) return 'top';
  if (centre > viewportHeight * 0.85) return 'bottom';
  return 'middle';
}

/**
 * Android's system gesture insets, assumed at their defaults: a 24 px back-gesture strip on
 * each side and a 32 px home bar at the bottom. A swipe there belongs to the system.
 */
export function gestureZone(box: { left: number; top: number; right: number; bottom: number }, viewport: { width: number; height: number }): 'left' | 'right' | 'bottom' | null {
  if (box.left < 24) return 'left';
  if (box.right > viewport.width - 24) return 'right';
  if (box.bottom > viewport.height - 32) return 'bottom';
  return null;
}

/** An endless animation cycling more than three times a second (WCAG 2.3.1 territory). */
export function fastBlink(a: { seconds: number; infinite: boolean }): boolean {
  return a.infinite && a.seconds > 0 && a.seconds < 1 / 3;
}

/** Interface transitions past 300 ms read as lag (report §3.3). */
export function slowTransition(seconds: number): boolean {
  return seconds > 0.3;
}
