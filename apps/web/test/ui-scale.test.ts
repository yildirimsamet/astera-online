import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as UiScaleModule from '../src/lib/uiScale.js';

/**
 * THE INTERFACE SIZE (owner 2026-11-17). One multiplier for every size on the page — text,
 * icons, rows, gaps — so the hierarchy between them never changes. It is done the way the
 * browser's own page zoom does it: the layout viewport narrows (`width=318, initial-scale=1.1`
 * on a 350 px phone), so `dvh`, fixed chrome and every canvas stay consistent. CSS `zoom` was
 * measured and rejected: `100dvh` overflowed by the factor and a canvas's two widths parted.
 */

type Module = typeof UiScaleModule;
const load = async (): Promise<Module> => { vi.resetModules(); return import('../src/lib/uiScale.js'); };

const BASE = /content="([^"]+)"/.exec(/<meta\s+name="viewport"\s+content="[^"]+"/.exec(readFileSync('index.html', 'utf8'))?.[0] ?? '')?.[1] ?? '';

function device({ width, height = 760, coarse = true }: { width: number; height?: number; coarse?: boolean }) {
  Object.defineProperty(window.screen, 'width', { configurable: true, value: width });
  Object.defineProperty(window.screen, 'height', { configurable: true, value: height });
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: coarse && query.includes('coarse'), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
}
/** What a browser that honours the meta does: the layout narrows to the device width over the scale. */
const honour = (width: number): void => { window.innerWidth = width; };
const meta = (): string => document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '';

beforeEach(() => {
  document.head.innerHTML = `<meta name="viewport" content="${BASE}">`;
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('the viewport a scale writes', () => {
  it('reads the page’s own viewport line', () => {
    expect(BASE).toContain('width=device-width');
  });

  it('writes the page’s own line, unchanged, at 100 %', async () => {
    const { viewportFor } = await load();
    expect(viewportFor(100, 350)).toBe(BASE);
  });

  it('narrows the layout and states the scale, keeping the notch and the keyboard keys', async () => {
    const { viewportFor } = await load();
    expect(viewportFor(110, 350)).toBe('width=318, initial-scale=1.1, viewport-fit=cover, interactive-widget=resizes-content');
    expect(viewportFor(90, 350)).toBe('width=389, initial-scale=0.9, viewport-fit=cover, interactive-widget=resizes-content');
  });

  it('never locks magnification, at any scale', async () => {
    const { viewportFor, UI_SCALES } = await load();
    for (const scale of UI_SCALES) {
      expect(viewportFor(scale, 412)).not.toMatch(/user-scalable|maximum-scale|minimum-scale/);
    }
  });
});

describe('the sizes a screen allows', () => {
  it('keeps the layout at least 318 px wide on the narrow side', async () => {
    const { scalesFor } = await load();
    expect(scalesFor(350)).toEqual([90, 100, 110]);
    expect(scalesFor(360)).toEqual([90, 100, 110]);
    expect(scalesFor(412)).toEqual([90, 100, 110, 120]);
    expect(scalesFor(430)).toEqual([90, 100, 110, 120, 130]);
  });

  it('always offers 90 and 100 %, even on a screen narrower than the floor', async () => {
    const { scalesFor } = await load();
    expect(scalesFor(300)).toEqual([90, 100]);
  });
});

describe('the size the phone’s own font size suggests', () => {
  it('takes the nearest allowed step, the smaller on a tie', async () => {
    const { scaleFromFontScale } = await load();
    const all = [90, 100, 110, 120, 130] as const;
    expect(scaleFromFontScale(1, all)).toBe(100);
    expect(scaleFromFontScale(0.85, all)).toBe(90);
    expect(scaleFromFontScale(1.15, all)).toBe(110);
    expect(scaleFromFontScale(1.3, all)).toBe(130);
  });

  it('stops at the largest step the screen allows', async () => {
    const { scaleFromFontScale } = await load();
    expect(scaleFromFontScale(2, [90, 100, 110])).toBe(110);
  });

  it('ignores a reading that is not a number', async () => {
    const { scaleFromFontScale } = await load();
    expect(scaleFromFontScale(Number.NaN, [90, 100, 110])).toBe(100);
  });
});

describe('choosing a size on a touch screen', () => {
  it('rewrites the viewport at once and remembers the choice on this device', async () => {
    device({ width: 350 });
    const ui = await load();
    const stop = ui.startUiScale();
    expect(ui.uiScaleSetting()).toMatchObject({ available: true, value: 100, options: [90, 100, 110] });
    ui.setUiScale(110);
    expect(meta()).toBe('width=318, initial-scale=1.1, viewport-fit=cover, interactive-widget=resizes-content');
    expect(localStorage.getItem('astera.uiScale')).toBe('110');
    honour(318);
    vi.advanceTimersByTime(400);
    expect(ui.uiScaleSetting()).toMatchObject({ available: true, value: 110 });
    ui.setUiScale(100);
    expect(meta()).toBe(BASE);
    stop();
  });

  it('applies the remembered size when the game starts', async () => {
    device({ width: 350 });
    localStorage.setItem('astera.uiScale', '90');
    const ui = await load();
    const stop = ui.startUiScale();
    expect(meta()).toContain('initial-scale=0.9');
    stop();
    expect(meta()).toBe(BASE);
  });

  it('brings a remembered size the screen cannot hold down to the largest it can', async () => {
    device({ width: 350 });
    localStorage.setItem('astera.uiScale', '130');
    const ui = await load();
    const stop = ui.startUiScale();
    expect(ui.uiScaleSetting().value).toBe(110);
    expect(meta()).toContain('initial-scale=1.1');
    stop();
  });

  it('ignores a remembered value that is not one of the steps', async () => {
    device({ width: 350 });
    for (const raw of ['abc', '115', '']) {
      localStorage.setItem('astera.uiScale', raw);
      const ui = await load();
      const stop = ui.startUiScale();
      expect(ui.uiScaleSetting().value).toBe(100);
      expect(meta()).toBe(BASE);
      stop();
    }
  });

  it('still works for the session when the store refuses to write', async () => {
    device({ width: 350 });
    const ui = await load();
    const stop = ui.startUiScale();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    ui.setUiScale(110);
    expect(meta()).toContain('initial-scale=1.1');
    stop();
  });

  it('measures the width again when the phone turns', async () => {
    device({ width: 350 });
    const ui = await load();
    const stop = ui.startUiScale();
    ui.setUiScale(110);
    honour(318);
    vi.advanceTimersByTime(400);
    // Landscape: the visual viewport now spans 760 device-independent pixels.
    vi.stubGlobal('visualViewport', { width: 690, scale: 1.1015 });
    window.dispatchEvent(new Event('resize'));
    expect(meta()).toBe('width=691, initial-scale=1.1, viewport-fit=cover, interactive-widget=resizes-content');
    stop();
  });
});

describe('where the size cannot be set', () => {
  it('is not offered and writes nothing on a desktop, whose browser ignores the meta', async () => {
    device({ width: 1280, height: 800, coarse: false });
    localStorage.setItem('astera.uiScale', '110');
    const ui = await load();
    const stop = ui.startUiScale();
    expect(ui.uiScaleSetting().available).toBe(false);
    expect(meta()).toBe(BASE);
    stop();
  });

  it('goes back to the page’s own line and withdraws the setting when the browser does not follow', async () => {
    device({ width: 350 });
    const ui = await load();
    const stop = ui.startUiScale();
    ui.setUiScale(110);
    // innerWidth stays 350: the layout never narrowed, so the picture is now cropped.
    vi.advanceTimersByTime(400);
    expect(meta()).toBe(BASE);
    expect(ui.uiScaleSetting().available).toBe(false);
    stop();
  });

  it('is not offered before the game has started it', async () => {
    device({ width: 350 });
    const ui = await load();
    expect(ui.uiScaleSetting().available).toBe(false);
  });
});

/*
  NOT ON iOS (owner 2026-11-17, players' reports from iPhones, Safari and Chrome alike — both are
  WebKit). A page laid out narrower and shown at a scale other than 1 was drawn blurry at the top,
  left a band under the dock, and every 16 px field fell under 16 on screen, so iOS zoomed in on
  focus and stayed zoomed. On iOS the setting is not offered and a remembered size is not applied:
  the next load puts the page's own line back.
*/
describe('on an iPhone or iPad', () => {
  const ua = (value: string, touchPoints = 5) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(value);
    // jsdom's navigator has no touch points to spy on: give it one.
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, get: () => touchPoints });
  };

  it('is not offered, and a remembered size is not applied', async () => {
    device({ width: 390 });
    ua('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1');
    localStorage.setItem('astera.uiScale', '90');
    const ui = await load();
    const stop = ui.startUiScale();
    expect(ui.uiScaleSetting().available).toBe(false);
    expect(meta()).toBe(BASE);
    stop();
  });

  it('knows an iPad that reports itself as a Mac', async () => {
    device({ width: 820, height: 1180 });
    ua('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15');
    const ui = await load();
    const stop = ui.startUiScale();
    expect(ui.uiScaleSetting().available).toBe(false);
    stop();
  });

  it('is still offered on an Android phone', async () => {
    device({ width: 360 });
    ua('Mozilla/5.0 (Linux; Android 14; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36');
    const ui = await load();
    const stop = ui.startUiScale();
    expect(ui.uiScaleSetting().available).toBe(true);
    stop();
  });
});

describe('a keyboard under a scaled page', () => {
  it('is never taken for a browser that did not follow: only a chosen size is checked', async () => {
    device({ width: 350 });
    const ui = await load();
    const stop = ui.startUiScale();
    ui.setUiScale(110);
    honour(318);
    vi.advanceTimersByTime(400);
    // The keyboard rises: the window resizes, and for a moment the viewport reads oddly.
    vi.stubGlobal('visualViewport', { width: 318, scale: 1 });
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(400);
    expect(ui.uiScaleSetting()).toMatchObject({ available: true, value: 110 });
    expect(meta()).toBe('width=318, initial-scale=1.1, viewport-fit=cover, interactive-widget=resizes-content');
    stop();
  });
});

describe('the phone’s own font size, in the app', () => {
  it('starts from it until the player chooses, and the player’s choice wins after', async () => {
    device({ width: 412 });
    const ui = await load();
    const stop = ui.startUiScale({ systemFontScale: () => Promise.resolve(1.2) });
    await vi.waitFor(() => { expect(ui.uiScaleSetting()).toMatchObject({ value: 120, fromSystem: true }); });
    expect(meta()).toContain('initial-scale=1.2');
    ui.setUiScale(100);
    expect(ui.uiScaleSetting()).toMatchObject({ value: 100, fromSystem: false });
    expect(localStorage.getItem('astera.uiScale')).toBe('100');
    stop();
  });

  it('keeps a remembered choice over the phone’s font size', async () => {
    device({ width: 412 });
    localStorage.setItem('astera.uiScale', '90');
    const ui = await load();
    const stop = ui.startUiScale({ systemFontScale: () => Promise.resolve(1.3) });
    await Promise.resolve();
    await Promise.resolve();
    expect(ui.uiScaleSetting()).toMatchObject({ value: 90, fromSystem: false });
    stop();
  });

  it('is offered in the app without a touch query, and stays at 100 % when the reading fails', async () => {
    device({ width: 350, coarse: false });
    const ui = await load();
    const stop = ui.startUiScale({ systemFontScale: () => Promise.reject(new Error('no bridge')) });
    await Promise.resolve();
    await Promise.resolve();
    expect(ui.uiScaleSetting()).toMatchObject({ available: true, value: 100, fromSystem: false });
    stop();
  });
});

describe('the 3D picture under a scaled page', () => {
  it('scales the resolution ceiling with the page, so a scene costs and looks the same at every size', async () => {
    device({ width: 350 });
    const ui = await load();
    const stop = ui.startUiScale();
    expect(ui.scaledDprCap(1.5)).toBe(1.5);
    ui.setUiScale(90);
    expect(ui.scaledDprCap(1.5)).toBeCloseTo(1.35);
    ui.setUiScale(110);
    expect(ui.scaledDprCap(2)).toBeCloseTo(2.2);
    stop();
  });
});

describe('every canvas on the quality ladder', () => {
  it('takes the scaled ceiling, never the preset’s own', async () => {
    const { readdirSync } = await import('node:fs');
    const files = readdirSync('src', { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.tsx'));
    const raw = files.filter((file) => /preset\.dprCap[}\]]/.test(readFileSync(`src/${file}`, 'utf8')));
    expect(raw).toEqual([]);
  });
});
