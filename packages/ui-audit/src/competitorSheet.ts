/**
 * RUN A COMPETITOR MEASUREMENT SPEC (plan §1.13, research report §7.1).
 *
 * A spec names screenshots (paths from the repo root) and, on each, the text lines to measure
 * by a box and the buttons to measure from a seed point. The result rows go to the report;
 * a check sheet shows every crop with the rows it measured, for the eye check.
 */

import { join } from 'node:path';
import sharp from 'sharp';
import { emFromInk, inkLines, inkShape, regionAt, size, type InkShape, type Raster } from './competitor.js';

export interface CompetitorScreen {
  game: string;
  screen: string;
  file: string;
  /** Screenshot pixels per dp; 3 (the phone's own) when absent. */
  dpr?: number;
  /** `shape` when the game's face draws a mark unlike the guess (a slash at cap height, say), checked on the crop. */
  items: { label: string; text: string; box: [number, number, number, number]; contrast?: number; shape?: InkShape }[];
  buttons?: { label: string; seed: [number, number]; tolerance?: number }[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const SHAPES = { caps: true, full: true, accented: true, lower: true } as const satisfies Record<InkShape, true>;
const isShape = (v: unknown): v is InkShape => typeof v === 'string' && Object.hasOwn(SHAPES, v);

export const itemShape = (item: { text: string; shape?: InkShape }): InkShape => item.shape ?? inkShape(item.text);

/** Only the accented share counts a mark above the capitals, so only there is a floating mark part of the ink. */
export const joinsMarks = (shape: InkShape): boolean => shape === 'accented';
const isNumbers = (v: unknown, n: number): boolean => Array.isArray(v) && v.length === n && v.every((x) => typeof x === 'number');

export function isScreens(value: unknown): value is CompetitorScreen[] {
  return Array.isArray(value) && value.every((s) => isRecord(s)
    && typeof s.game === 'string' && typeof s.screen === 'string' && typeof s.file === 'string'
    && (s.dpr === undefined || typeof s.dpr === 'number')
    && Array.isArray(s.items) && s.items.every((i) => isRecord(i) && typeof i.label === 'string' && typeof i.text === 'string' && isNumbers(i.box, 4) && (i.shape === undefined || isShape(i.shape)))
    && (s.buttons === undefined || (Array.isArray(s.buttons) && s.buttons.every((b) => isRecord(b) && typeof b.label === 'string' && isNumbers(b.seed, 2)))));
}

export type CompetitorRow =
  | { game: string; screen: string; label: string; text: string; shape: string; inkDp: number; inkMm: number; emDp: number }
  | { game: string; screen: string; label: string; button: { x: number; y: number; w: number; h: number }; wDp: number; hDp: number; wMm: number; hMm: number };

const round = (n: number) => Math.round(n * 10) / 10;

export async function measureScreens(screens: readonly CompetitorScreen[], { root, sheet }: { root: string; sheet: string }): Promise<CompetitorRow[]> {
  const rows: CompetitorRow[] = [];
  const tiles: { input: Buffer; left: number; top: number }[] = [];
  let y = 0;
  const tile = async (path: string, box: { x: number; y: number; w: number; h: number }, svg: (k: number) => string) => {
    const k = Math.min(1, 520 / box.w);
    const crop = await sharp(path).extract({ left: box.x, top: box.y, width: box.w, height: box.h }).resize({ width: Math.round(box.w * k) }).png().toBuffer();
    const h = Math.max(24, Math.round(box.h * k));
    tiles.push({ input: crop, left: 6, top: y }, { input: Buffer.from(`<svg width="760" height="${String(h)}">${svg(k)}</svg>`), left: 0, top: y });
    y += h + 6;
  };
  const label = (text: string) => `<text x="530" y="16" font-size="13" fill="#ff0">${text.replace(/[<&]/g, '')}</text>`;
  for (const s of screens) {
    const path = join(root, s.file);
    const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const raster: Raster = { width: info.width, height: info.height, channels: 3, data: Uint8Array.from(data) };
    const orientation = info.width > info.height ? 'landscape' : 'portrait';
    const dpr = s.dpr ?? 3;
    for (const item of s.items) {
      const [x0, y0, x1, y1] = item.box;
      const shape = itemShape(item);
      const lines = inkLines(raster, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, { contrast: item.contrast ?? 60, joinMarks: joinsMarks(shape) });
      const ink = size(lines.reduce((m, l) => Math.max(m, l.height), 0), orientation, 'vertical', dpr);
      rows.push({ game: s.game, screen: s.screen, label: item.label, text: item.text, shape, inkDp: round(ink.dp), inkMm: Math.round(ink.mm * 100) / 100, emDp: round(emFromInk(ink.dp, shape)) });
      await tile(path, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, (k) => `${lines.map((l) => `<rect x="0" y="${String((l.top - y0) * k)}" width="4" height="${String(l.height * k)}" fill="#f0f"/>`).join('')}${label(`${item.label} ${String(ink.px)}px`)}`);
    }
    for (const b of s.buttons ?? []) {
      const r = regionAt(raster, { x: b.seed[0], y: b.seed[1] }, { tolerance: b.tolerance ?? 60 });
      const w = size(r.w, orientation, 'horizontal', dpr);
      const h = size(r.h, orientation, 'vertical', dpr);
      rows.push({ game: s.game, screen: s.screen, label: b.label, button: r, wDp: round(w.dp), hDp: round(h.dp), wMm: round(w.mm), hMm: round(h.mm) });
      const pad = 10;
      const box = { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), w: 0, h: 0 };
      box.w = Math.min(info.width - box.x, r.w + 2 * pad);
      box.h = Math.min(info.height - box.y, r.h + 2 * pad);
      await tile(path, box, (k) => `<rect x="${String(6 + (r.x - box.x) * k)}" y="${String((r.y - box.y) * k)}" width="${String(r.w * k)}" height="${String(r.h * k)}" fill="none" stroke="#f0f" stroke-width="2"/>${label(`${b.label} ${String(r.w)}x${String(r.h)}`)}`);
    }
  }
  await sharp({ create: { width: 760, height: Math.max(1, y), channels: 3, background: '#222' } }).composite(tiles).png().toFile(sheet);
  return rows;
}
