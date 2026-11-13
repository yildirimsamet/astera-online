/**
 * R2 SHEETS: EACH PHONE SCREENSHOT BESIDE ITS THREE SIMULATIONS.
 *
 * Reads <out>/raw/phone/tr/*.png (every scroll part) and writes <out>/vision/<name>.png:
 * normal, protanopia, deuteranopia, tritanopia, side by side at half size.
 */

import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { simulatePixels, VISION_KINDS } from './vision.js';

const LABELS = ['Normal', 'Protanopi', 'Döteranopi', 'Tritanopi'];

export async function visionSheets(out: string): Promise<number> {
  const from = join(out, 'raw', 'phone', 'tr');
  const to = join(out, 'vision');
  await mkdir(to, { recursive: true });
  const shots = (await readdir(from)).filter((f) => f.endsWith('.png') && !f.endsWith('.error.png'));
  for (const file of shots) {
    const { data, info } = await sharp(join(from, file)).removeAlpha().resize({ width: 350 }).raw().toBuffer({ resolveWithObject: true });
    const pixels = Uint8Array.from(data);
    const panels = [pixels, ...VISION_KINDS.map((kind) => simulatePixels(pixels, 3, kind))];
    const label = (text: string) => Buffer.from(`<svg width="${String(info.width)}" height="22"><rect width="100%" height="22" fill="#000" opacity="0.7"/><text x="8" y="16" font-family="sans-serif" font-size="13" fill="#fff">${text}</text></svg>`);
    await sharp({ create: { width: info.width * 4, height: info.height, channels: 3, background: '#000' } })
      .composite(panels.flatMap((panel, i) => [
        { input: Buffer.from(panel), raw: { width: info.width, height: info.height, channels: 3 as const }, left: i * info.width, top: 0 },
        { input: label(LABELS[i] ?? ''), left: i * info.width, top: 0 },
      ]))
      .png({ compressionLevel: 9 })
      .toFile(join(to, file));
  }
  return shots.length;
}
