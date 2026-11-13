import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { flashReport } from '../src/flash.js';
import { film, holdTime, pauseSoon, PHONE_FLASH } from '../src/flashFilm.js';

/**
 * THE RECORDER AGAINST FLICKERS WHOSE RATE IS KNOWN (plan §1.5: 4 Hz is caught, 2 Hz passes).
 *
 * Each frame is a fixed step of page time, however long its screenshot took, so a CSS
 * animation and a timer-driven flicker are filmed at their true rate.
 */
let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser.close(); });

const page = async (body: string, script = ''): Promise<Page> => {
  const p = await browser.newPage({ viewport: { width: 350, height: 812 } });
  await holdTime(p);
  await p.setContent(`<!doctype html><style>html,body{margin:0;height:100%;background:#000}${body}</style><body><script>${script}</script></body>`);
  return p;
};

const css = (seconds: number) => `@keyframes f{0%,49.9%{background:#000}50%,100%{background:#fff}}body{animation:f ${String(seconds)}s steps(1) infinite}`;

describe('filming a moment on a held clock', () => {
  it('catches a full-screen CSS flicker at 4 Hz', async () => {
    const report = flashReport(await film(await page(css(0.25)), { seconds: 2 }), PHONE_FLASH);
    expect(report.generalPerSecond).toBe(4);
    expect(report.fails).toBe(true);
  }, 120_000);

  it('passes the same flicker at 2 Hz', async () => {
    const report = flashReport(await film(await page(css(0.5)), { seconds: 2 }), PHONE_FLASH);
    expect(report.generalPerSecond).toBe(2);
    expect(report.fails).toBe(false);
  }, 120_000);

  it('catches a timer-driven flicker at its page-time rate', async () => {
    const p = await page('', 'setInterval(() => { document.body.style.background = document.body.style.background === "white" ? "black" : "white"; }, 125);');
    const report = flashReport(await film(p, { seconds: 2 }), PHONE_FLASH);
    expect(report.generalPerSecond).toBe(4);
  }, 120_000);

  it('holds page time from the first script when asked, for an effect that starts with the page', async () => {
    // White for the first half second of page time after load, then black.
    const glow = 'const start = Date.now(); const tick = () => { document.body.style.background = Date.now() - start < 500 ? "#fff" : "#000"; requestAnimationFrame(tick); }; tick();';
    const opened = async (held: boolean) => {
      const p = await browser.newPage({ viewport: { width: 350, height: 812 } });
      await holdTime(p, { held });
      await p.setContent(`<!doctype html><style>html,body{margin:0;height:100%}</style><body><script>${glow}</script></body>`);
      await p.waitForTimeout(1500);
      return film(p, { seconds: 1 });
    };
    const held = await opened(true);
    expect(held[0]?.cells[0]).toBeGreaterThan(240);
    expect(held.at(-1)?.cells[0]).toBeLessThan(40);
    expect((await opened(false))[0]?.cells[0]).toBeLessThan(40);
  }, 120_000);

  it('hands over the screenshot of every frame, in order, to keep as evidence', async () => {
    const p = await page(css(0.5));
    const kept: number[] = [];
    let png: Buffer = Buffer.alloc(0);
    await film(p, { seconds: 0.1, shot: (shot, frame) => { kept.push(frame); png = shot; } });
    expect(kept).toEqual([0, 1, 2, 3, 4, 5]);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
  }, 120_000);

  it('films a moment from the press that starts it', async () => {
    const p = await page('@keyframes w{from{opacity:1}to{opacity:0}}.w{position:fixed;inset:0;background:#fff;animation:w 1s both}', 'document.addEventListener("click", () => { const d = document.createElement("div"); d.className = "w"; document.body.append(d); });');
    const frames = await film(p, { seconds: 1, act: () => p.mouse.click(10, 10) });
    const brightness = (i: number) => frames[i]?.cells[0] ?? 0;
    expect(brightness(0)).toBeGreaterThan(240);
    expect(brightness(frames.length - 1)).toBeLessThan(40);
  }, 120_000);
});

describe('pausing page time a moment from now', () => {
  it('tries again when a busy machine lets that moment pass before the pause lands', async () => {
    const asked: number[] = [];
    let now = 1000;
    const stub = {
      evaluate: () => Promise.resolve((now += 100)),
      clock: {
        pauseAt: (time: number) => {
          asked.push(time);
          return asked.length === 1 ? Promise.reject(new Error('clock.pauseAt: Error: Cannot fast-forward to the past')) : Promise.resolve();
        },
      },
    };
    await pauseSoon(stub);
    expect(asked).toHaveLength(2);
  });

  it('does not hide any other failure', async () => {
    const stub = { evaluate: () => Promise.resolve(1000), clock: { pauseAt: () => Promise.reject(new Error('Target closed')) } };
    await expect(pauseSoon(stub)).rejects.toThrow('Target closed');
  });
});
