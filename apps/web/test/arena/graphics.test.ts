import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Owner 2026-10-22: the arena's resolution kept changing under the player (the frame-rate
 * governor). A choice like the galaxy's — Yüksek, Dengeli, Düşük — plus Otomatik, which is
 * the governor; Dengeli by default. Per device, it survives a reload.
 */
const load = async () => { vi.resetModules(); return import('../../src/arena/graphics.js'); };

describe('arena graphics choice', () => {
  beforeEach(() => { localStorage.clear(); });

  it('starts on Dengeli, and offers the four in order', async () => {
    const g = await load();
    expect(g.arenaGraphics()).toBe('balanced');
    expect(g.ARENA_GRAPHICS).toEqual(['high', 'balanced', 'low', 'auto']);
  });

  it('remembers the choice on this device, and ignores a value it does not know', async () => {
    let g = await load();
    g.setArenaGraphics('low');
    g = await load();
    expect(g.arenaGraphics()).toBe('low');
    localStorage.setItem('astera.arenaGraphics', 'ultra');
    g = await load();
    expect(g.arenaGraphics()).toBe('balanced');
  });

  it('holds a fixed sharpness on every fixed choice; only Otomatik adapts', async () => {
    const g = await load();
    expect(g.graphicsFor('high', 3)).toEqual({ ratio: 2, samples: 4, adaptive: false, light: false });
    expect(g.graphicsFor('balanced', 3)).toEqual({ ratio: 1.5, samples: 4, adaptive: false, light: false });
    expect(g.graphicsFor('low', 3)).toEqual({ ratio: 1, samples: 2, adaptive: false, light: true });
    expect(g.graphicsFor('auto', 3)).toEqual({ ratio: 2, samples: 4, adaptive: true, light: false });
  });

  it('never renders above the screen\'s own pixels', async () => {
    const g = await load();
    expect(g.graphicsFor('high', 1).ratio).toBe(1);
    expect(g.graphicsFor('balanced', 1.25).ratio).toBe(1.25);
    expect(g.graphicsFor('auto', 0).ratio).toBe(1);
  });

  it('tells a listener when the choice changes', async () => {
    const g = await load();
    const heard: string[] = [];
    const stop = g.onArenaGraphics(choice => heard.push(choice));
    g.setArenaGraphics('high'); g.setArenaGraphics('high'); stop(); g.setArenaGraphics('auto');
    expect(heard).toEqual(['high']);
  });
});
