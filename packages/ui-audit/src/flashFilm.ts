/**
 * FILM A MOMENT FRAME BY FRAME ON A HELD CLOCK (plan §1.5).
 *
 * Page timers and requestAnimationFrame run on Playwright's clock; CSS and Web Animations are
 * frozen through the DevTools timeline and stepped by hand. Every frame is then exactly
 * 1/fps of page time after the last, however long its screenshot took, so a 3D explosion
 * and a CSS flicker are filmed at their true rate on any machine.
 */

import type { Page } from 'playwright';
import sharp from 'sharp';
import { flashAreaThreshold, gridCells, type FlashFrame, type FlashOptions } from './flash.js';

const COLS = 14;
const ROWS = 32;
/** The phone the audit measures on, cut into COLS × ROWS cells of about 25 CSS px. */
const PHONE = { width: 350, height: 812 };

/** Plan §1.5: a phone held at 33 cm, 0.17 mm per CSS px. */
export const PHONE_FLASH: FlashOptions = {
  cellArea: (PHONE.width / COLS) * (PHONE.height / ROWS),
  areaThreshold: flashAreaThreshold({ viewingDistanceMm: 330, mmPerCssPx: 0.17 }),
};

/**
 * Puts the page's timers on a clock the film can hold. Call before the page loads; `held`
 * keeps page time still from the first script, for an effect that starts with the page.
 */
export async function holdTime(page: Page, { held = false }: { held?: boolean } = {}): Promise<void> {
  const now = Date.now();
  await page.clock.install({ time: now });
  if (held) await page.clock.pauseAt(now + 1);
}

async function grab(page: Page, onShot?: (png: Buffer) => void): Promise<Float64Array> {
  const png = await page.screenshot({ scale: 'css' });
  onShot?.(png);
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 3 && info.channels !== 4) throw new Error(`unexpected screenshot channels: ${String(info.channels)}`);
  return gridCells({ width: info.width, height: info.height, channels: info.channels, data }, COLS, ROWS);
}

/** What `pauseSoon` needs of a page. */
export interface Pausable {
  evaluate: (read: () => number) => Promise<number>;
  clock: { pauseAt: (time: number) => Promise<void> };
}

/**
 * Holds page time a moment from now. On a busy machine that moment can pass before the call
 * reaches the page ("Cannot fast-forward to the past"); then it reads the time again.
 */
export async function pauseSoon(page: Pausable): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 10));
      return;
    } catch (error) {
      if (attempt >= 5 || !(error instanceof Error) || !error.message.includes('to the past')) throw error;
    }
  }
}

/**
 * `act` starts the moment once time is held, so its first frame is filmed. `shot` receives
 * the screenshot of each frame, to keep a few as evidence of what was filmed.
 */
export async function film(page: Page, { seconds, fps = 60, act, shot }: { seconds: number; fps?: number; act?: () => Promise<void>; shot?: (png: Buffer, frame: number) => void }): Promise<FlashFrame[]> {
  const devtools = await page.context().newCDPSession(page);
  await devtools.send('Animation.enable');
  await devtools.send('Animation.setPlaybackRate', { playbackRate: 0 });
  await pauseSoon(page);
  try {
    await act?.();
    const frames: FlashFrame[] = [];
    const count = Math.round(seconds * fps);
    for (let i = 0; i < count; i += 1) {
      frames.push({ time: i / fps, cells: await grab(page, shot && ((png) => { shot(png, i); })) });
      const step = Math.round(((i + 1) * 1000) / fps) - Math.round((i * 1000) / fps);
      await page.clock.runFor(step);
      await page.evaluate((ms) => {
        // Each animation keeps its own film time from the frame it was first seen: a frozen
        // timeline can report a start far in the past, and a value read back is not trusted.
        const held = (window.__flashHeld ??= new WeakMap<Animation, number>());
        for (const animation of document.getAnimations()) {
          const seen = held.get(animation);
          const at = seen === undefined ? Math.max(0, Number(animation.currentTime ?? 0) || 0) : seen + ms;
          held.set(animation, at);
          animation.pause();
          animation.currentTime = at;
        }
      }, step);
    }
    return frames;
  } finally {
    await devtools.send('Animation.setPlaybackRate', { playbackRate: 1 }).catch(() => undefined);
    await devtools.detach().catch(() => undefined);
    await page.clock.resume().catch(() => undefined);
  }
}

declare global {
  interface Window {
    __flashHeld?: WeakMap<Animation, number>;
  }
}
