import { render } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { useAppScreen, watchAppHeight } from '../src/lib/appHeight.js';

/*
  Owner phone playtest 2026-11-18 (item 23): in a phone browser the foot of the game sometimes lay under
  the browser's bottom bar, out of reach — the page took the height it would have with the bars hidden.
  The game is sized to the height the page really has on screen, and while a game screen is up the page
  itself never scrolls, so the browser's bars never slide away and back.
*/
const root = document.documentElement;
const appHeight = () => root.style.getPropertyValue('--app-h');

describe('the height the game is drawn in', () => {
  afterEach(() => { root.style.removeProperty('--app-h'); });

  it('is the height the page has on screen, kept as it changes', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 });
    const stop = watchAppHeight();
    expect(appHeight()).toBe('640px');
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 560 });
    window.dispatchEvent(new Event('resize'));
    expect(appHeight()).toBe('560px');
    stop();
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 });
    window.dispatchEvent(new Event('resize'));
    expect(appHeight()).toBe('');
  });
});

describe('a game screen', () => {
  function Screen() { useAppScreen(); return null; }

  it('holds the page still while it is up, until the last one goes', () => {
    const first = render(<Screen />);
    const second = render(<Screen />);
    expect(root.hasAttribute('data-app-screen')).toBe(true);
    first.unmount();
    expect(root.hasAttribute('data-app-screen')).toBe(true);
    second.unmount();
    expect(root.hasAttribute('data-app-screen')).toBe(false);
  });
});

describe('the stylesheets', () => {
  const read = (file: string) => readFileSync(join(import.meta.dirname, '../src', file), 'utf8');

  it('size every full screen from the measured height, never from 100dvh alone', () => {
    expect(read('styles.css')).toMatch(/@utility h-dvh\s*\{\s*height: var\(--app-h, 100dvh\);/);
    expect(read('styles.css')).toMatch(/@utility min-h-dvh\s*\{\s*min-height: var\(--app-h, 100dvh\);/);
    expect(read('styles.css')).toMatch(/html\[data-app-screen\][^{]*\{[^}]*overflow: hidden/);
    for (const file of ['game-ui/game-ui.css', 'onboarding/flightSchool/school.css', 'starter/landingRewards.css', 'styles/chrome.css']) {
      const bare = read(file).replace(/var\(--app-h, 100dvh\)/g, '').match(/100dvh/g) ?? [];
      expect({ file, bare: bare.length }).toEqual({ file, bare: 0 });
    }
  });

  it('size every part of a screen from it too: no other dvh is left outside the galleries', () => {
    const left: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(join(import.meta.dirname, '../src', dir), { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) { if (path !== join('v2', 'gallery')) walk(path); continue; }
        if (!/\.(css|tsx?)$/.test(entry.name)) continue;
        const code = read(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/var\(--app-h, ?100dvh\)/g, '');
        if (/\d+dvh/.test(code)) left.push(path);
      }
    };
    walk('.');
    expect(left).toEqual([]);
  });
});
