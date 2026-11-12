/**
 * AUDIT ONE SURFACE AS IT STANDS IN THE PAGE.
 *
 * Collect in the page, photograph it with the text made transparent (several frames,
 * because the galaxy moves behind translucent plates), then judge in Node with the pure
 * functions. Optionally press every control to see whether it answers.
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import type { Page } from 'playwright';
import sharp from 'sharp';
import { TARGET } from './attributes.js';
import type { RawCollect, RawTarget, RawText, Rgba } from './collector.js';
import { hueFamilies, type HueFamily } from './color.js';
import { textContrast, type TextContrast } from './contrast.js';
import { mergeParts, palette, readingStats } from './merge.js';
import type { TextStats } from './readability.js';
import { hitRegions, rectGap, spacingFailures, type Box, type HitRegion, type HitSample } from './targets.js';

/**
 * immediate: something changes within 100 ms of the touch (a pointerdown handler).
 * active: only a CSS :active rule answers. Chrome shows :active on a held touch through
 * its show-press gesture, so on a phone it can arrive late; emulated touch never sends
 * that gesture, so the state is forced over CDP instead.
 * none: nothing visible answers a press.
 */
export type Feedback = 'immediate' | 'active' | 'none';

export interface AuditedText extends Omit<RawText, 'color' | 'opacity' | 'rects'> {
  box: Box;
  /** The glyphs change the pixels: not hidden under something opaque. */
  rendered: boolean;
  charsPerLine: number;
  contrast: TextContrast | null;
}

export interface AuditedTarget extends Omit<RawTarget, 'icon'> {
  /** Draws a one-colour SVG icon; a text-less target without one is a bare tap area. */
  hasIcon: boolean;
  region: HitRegion | null;
  /** Share of the element's own box a press can reach. */
  coverage: number;
  spacingFail: boolean;
  nearestGap: number | null;
  iconContrast: TextContrast | null;
  /** null: not pressed (disabled, off screen, or the run did not press). */
  feedback: Feedback | null;
}

export interface SurfaceAudit {
  surface: string;
  viewport: RawCollect['viewport'];
  texts: AuditedText[];
  targets: AuditedTarget[];
  /** CSS px² where a press reaches the 3D scene. */
  sceneArea: number;
  stats: TextStats & { atesman: number | null };
  /** Painted colours by value, weighted by area. */
  palette: { rgb: [number, number, number]; weight: number }[];
  hues: HueFamily[];
  spacing: { values: Record<string, number>; offGrid: number; total: number };
  overflow: RawCollect['overflow'];
  motion: { transitions: RawCollect['transitions']; animations: RawCollect['animations'] };
  /** Screens of scrolling it took to see the whole surface. */
  parts: number;
  /** The part limit stopped the scroll before the end. */
  partsCapped: boolean;
}

export interface AuditOptions {
  surface: string;
  /** Background frames for contrast, 400 ms apart. */
  frames?: number;
  gridStep?: number;
  /** Press every control (touch contexts only). */
  feedback?: boolean;
  /** Save the screenshot of the surface as measured. */
  screenshot?: string;
  /** A later scroll part: colours, spacing and motion count only elements not seen before. */
  continued?: boolean;
  /** Targets already pressed in an earlier part. */
  pressed?: ReadonlySet<string>;
}

let bundled: string | null = null;
function collectorSource(): string {
  if (bundled === null) {
    const result = buildSync({ entryPoints: [fileURLToPath(new URL('./collector.ts', import.meta.url))], bundle: true, format: 'iife', target: 'chrome120', write: false });
    const file = result.outputFiles[0];
    if (!file) throw new Error('the collector bundle came out empty');
    bundled = file.text;
  }
  return bundled;
}

interface Image {
  data: Buffer;
  width: number;
  height: number;
}

async function decode(png: Buffer): Promise<Image> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Each device pixel inside the boxes (CSS px), visited once per box. */
function eachPixel(image: Image, boxes: readonly Box[], dpr: number, visit: (index: number) => void): void {
  for (const b of boxes) {
    const x0 = Math.max(0, Math.floor(b.left * dpr));
    const x1 = Math.min(image.width, Math.ceil(b.right * dpr));
    const y0 = Math.max(0, Math.floor(b.top * dpr));
    const y1 = Math.min(image.height, Math.ceil(b.bottom * dpr));
    for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) visit((y * image.width + x) * 4);
  }
}

function crop(image: Image, boxes: readonly Box[], dpr: number): Uint8Array {
  const out: number[] = [];
  eachPixel(image, boxes, dpr, (i) => out.push(image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0, 255));
  return Uint8Array.from(out);
}

/** Share of pixels inside the boxes that differ visibly between two images of one size. */
function changedShare(a: Image, b: Image, boxes: readonly Box[], dpr: number): number {
  let changed = 0;
  let total = 0;
  eachPixel(a, boxes, dpr, (i) => {
    total += 1;
    const delta = Math.abs((a.data[i] ?? 0) - (b.data[i] ?? 0)) + Math.abs((a.data[i + 1] ?? 0) - (b.data[i + 1] ?? 0)) + Math.abs((a.data[i + 2] ?? 0) - (b.data[i + 2] ?? 0));
    if (delta > 36) changed += 1;
  });
  return total === 0 ? 0 : changed / total;
}

/** Contrast of a colour over the boxes in each background frame; the worst frame wins. */
function worstContrast(color: Rgba, opacity: number, boxes: readonly Box[], frames: readonly Image[], dpr: number): TextContrast | null {
  const alpha = color[3] * opacity;
  if (alpha <= 0) return null;
  let worst: TextContrast | null = null;
  for (const frame of frames) {
    const data = crop(frame, boxes, dpr);
    if (data.length === 0) return null;
    const result = textContrast({ rgb: [color[0], color[1], color[2]], alpha }, { data, channels: 4 });
    if (!worst || result.p5 < worst.p5) worst = result;
  }
  return worst;
}

const union = (boxes: readonly Box[]): Box => ({
  left: Math.min(...boxes.map((b) => b.left)),
  top: Math.min(...boxes.map((b) => b.top)),
  right: Math.max(...boxes.map((b) => b.right)),
  bottom: Math.max(...boxes.map((b) => b.bottom)),
});

const clip = (b: Box, viewport: RawCollect['viewport']): Box => ({
  left: Math.max(0, b.left),
  top: Math.max(0, b.top),
  right: Math.min(viewport.width, b.right),
  bottom: Math.min(viewport.height, b.bottom),
});

const area = (b: Box) => Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top);

async function pressFeedback(page: Page, presses: { index: number; at: [number, number]; box: Box }[], viewport: RawCollect['viewport']): Promise<Map<number, Feedback>> {
  const out = new Map<number, Feedback>();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
  await page.evaluate(() => window.__uiAudit?.freeze(true));
  const shot = async (region: { x: number; y: number; width: number; height: number }) => decode(await page.screenshot({ clip: region }));
  try {
    for (const { index, at, box } of presses) {
      const b = clip({ left: box.left - 2, top: box.top - 2, right: box.right + 2, bottom: box.bottom + 2 }, viewport);
      const region = { x: b.left, y: b.top, width: b.right - b.left, height: b.bottom - b.top };
      if (region.width < 1 || region.height < 1) continue;
      const whole: Box[] = [{ left: 0, top: 0, right: region.width, bottom: region.height }];
      const differs = (a: Image, c: Image) => changedShare(a, c, whole, viewport.dpr) > 0.01;

      const before = await shot(region);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at[0], y: at[1] }] });
      await page.waitForTimeout(100);
      const touched = await shot(region);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await page.waitForTimeout(150);
      if (differs(before, touched)) {
        out.set(index, 'immediate');
        continue;
      }

      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `[${TARGET}="${String(index)}"]` });
      if (nodeId === 0) {
        out.set(index, 'none');
        continue;
      }
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['active'] });
      await page.waitForTimeout(250);
      const active = await shot(region);
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
      await page.waitForTimeout(250);
      out.set(index, differs(before, active) ? 'active' : 'none');
    }
  } finally {
    await page.evaluate(() => window.__uiAudit?.freeze(false));
    await cdp.detach();
  }
  return out;
}

export async function auditPage(page: Page, { surface, frames = 3, gridStep = 2, feedback = false, screenshot, continued = false, pressed }: AuditOptions): Promise<SurfaceAudit> {
  if (!(await page.evaluate(() => window.__uiAudit !== undefined))) await page.addScriptTag({ content: collectorSource() });
  const raw = await page.evaluate((options) => {
    const api = window.__uiAudit;
    if (!api) throw new Error('the ui-audit collector is not in the page');
    return api.collect(options);
  }, { gridStep, fresh: !continued });
  const { viewport } = raw;

  const normalPng = await page.screenshot();
  if (screenshot) await writeFile(screenshot, normalPng);
  const normal = await decode(normalPng);
  await page.evaluate(() => window.__uiAudit?.hideText(true));
  const backgrounds: Image[] = [];
  try {
    for (let i = 0; i < frames; i += 1) {
      if (i > 0) await page.waitForTimeout(400);
      backgrounds.push(await decode(await page.screenshot()));
    }
  } finally {
    await page.evaluate(() => window.__uiAudit?.hideText(false));
  }
  const firstBackground = backgrounds[0];
  if (!firstBackground) throw new Error('at least one background frame is needed');

  const texts = raw.texts.map(({ color, opacity, rects, ...text }): AuditedText => {
    const rendered = changedShare(normal, firstBackground, rects, viewport.dpr) > 0.02;
    return {
      ...text,
      box: union(rects),
      rendered,
      charsPerLine: Math.round(text.text.length / Math.max(1, text.lines)),
      contrast: text.gradient || !rendered ? null : worstContrast(color, opacity, rects, backgrounds, viewport.dpr),
    };
  });

  const { step, cols, cells } = raw.grid;
  const samples: HitSample[] = [];
  let sceneCells = 0;
  cells.forEach((cell, i) => {
    if (cell === -2) sceneCells += 1;
    samples.push({ x: (i % cols) * step, y: Math.floor(i / cols) * step, target: cell >= 0 ? String(cell) : null });
  });
  const regions = new Map(hitRegions(samples, step).map((region) => [region.target, region]));
  const failing = new Set(spacingFailures([...regions.values()]));

  const presses = feedback
    ? raw.targets.flatMap((t, index) => {
        const region = regions.get(String(index));
        if (!region || t.disabled || pressed?.has(t.id)) return [];
        return [{ index, at: [(region.box.left + region.box.right) / 2, (region.box.top + region.box.bottom) / 2] as [number, number], box: t.box }];
      })
    : [];
  const answers = presses.length > 0 ? await pressFeedback(page, presses, viewport) : new Map<number, Feedback>();

  const targets = raw.targets.map(({ icon, ...target }, index): AuditedTarget => {
    const region = regions.get(String(index)) ?? null;
    const own = area(clip(target.box, viewport));
    const gaps = region ? [...regions.values()].filter((other) => other !== region).map((other) => rectGap(region.box, other.box)) : [];
    return {
      ...target,
      region,
      coverage: region && own > 0 ? Math.min(1, region.area / own) : 0,
      spacingFail: failing.has(String(index)),
      nearestGap: gaps.length > 0 ? Math.min(...gaps) : null,
      hasIcon: icon !== null,
      iconContrast: icon ? worstContrast(icon.color, icon.opacity, [icon.box], backgrounds, viewport.dpr) : null,
      feedback: answers.get(index) ?? null,
    };
  });

  const colors = palette(raw.colors);
  const spacingTotal = Object.values(raw.spacing).reduce((sum, n) => sum + n, 0);
  const offGrid = Object.entries(raw.spacing).reduce((sum, [value, n]) => sum + (Number(value) % 4 === 0 ? 0 : n), 0);

  return {
    surface,
    viewport,
    texts,
    targets,
    sceneArea: sceneCells * step * step,
    stats: readingStats(texts),
    palette: colors,
    hues: hueFamilies(colors),
    spacing: { values: raw.spacing, offGrid, total: spacingTotal },
    overflow: raw.overflow,
    motion: { transitions: raw.transitions, animations: raw.animations },
    parts: 1,
    partsCapped: false,
  };
}

/**
 * The whole surface: measure what shows, scroll the largest scroller with more below,
 * measure again, until nothing scrolls or `maxParts` is reached. The default reaches the end of
 * every page the game has (2026-11-11: the longest, the legacy reveal on desktop, took 29 parts);
 * a page past it is named in the report as cut short.
 */
export async function auditSurface(page: Page, { maxParts = 40, screenshot, ...options }: Omit<AuditOptions, 'continued' | 'pressed'> & { maxParts?: number }): Promise<SurfaceAudit> {
  const parts: SurfaceAudit[] = [];
  const pressed = new Set<string>();
  const scroll = () => page.evaluate(() => window.__uiAudit?.scrollStep() ?? false);
  for (let part = 0; part < maxParts; part += 1) {
    if (part > 0) {
      if (!(await scroll())) return mergeParts(parts, false);
      await page.waitForTimeout(500);
    }
    const shot = screenshot && part > 0 ? screenshot.replace(/\.png$/, `.p${String(part)}.png`) : screenshot;
    const audit = await auditPage(page, { ...options, ...(shot ? { screenshot: shot } : {}), continued: part > 0, pressed });
    for (const t of audit.targets) if (t.feedback) pressed.add(t.id);
    parts.push(audit);
  }
  return mergeParts(parts, await scroll());
}
