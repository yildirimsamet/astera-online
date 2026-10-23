import { Profiler, StrictMode } from 'react';
import { act, render } from '@testing-library/react';
import { createSandboxWorld } from '@astera/rules/arena';
import { describe, expect, it, vi } from 'vitest';
import type * as Store from '../../src/arena/store.js';
import type { HudStore } from '../../src/arena/store.js';

const load = vi.hoisted(() => vi.fn(() => new Promise<never>(() => undefined)));
const stores = vi.hoisted((): HudStore[] => []);
vi.mock('../../src/arena/assets/load.js', async original => ({ ...await original<object>(), loadArenaAssets: load }));
vi.mock('../../src/arena/store.js', async original => {
  const actual = await original<typeof Store>();
  return { ...actual, createHudStore: () => { const store = actual.createHudStore(); stores.push(store); return store; } };
});
const { default: Sandbox } = await import('../../src/arena/Sandbox.js');

/**
 * V6g, 2026-10-22: in development React mounts, unmounts and mounts again (StrictMode). Both
 * mounts loaded the whole pack, side by side, and the S22's renderer died holding the two.
 */
describe('the arena pack load', () => {
  it('runs once for a mount React took back before the load began', async () => {
    render(<StrictMode><Sandbox onLeave={() => undefined} /></StrictMode>);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(load).toHaveBeenCalledTimes(1);
  });
});

/**
 * V6g: the page read the whole HUD snapshot, so every 10 Hz update re-rendered the page and
 * everything under it. The page needs the flight's phase; the numbers are the HUD's.
 */
describe('the arena page during a flight', () => {
  it('does not re-render for HUD numbers that change ten times a second', async () => {
    let commits = 0;
    render(<Profiler id="page" onRender={() => { commits++; }}><Sandbox onLeave={() => undefined} /></Profiler>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    const store = stores[stores.length - 1];
    if (!store) throw new Error('no store');
    const world = createSandboxWorld({ bots: 0 });
    const before = commits;
    for (const speed of [40, 80, 120]) {
      world.pilot.s = speed; world.pilot.fuel -= 1;
      act(() => { store.publish(world, 'flight', false, false); });
    }
    expect(commits).toBe(before);
  });
});
