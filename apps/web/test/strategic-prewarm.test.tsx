import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as NukeBlastModule from '../src/galaxy/NukeBlast.js';

const requests = vi.hoisted(() => [] as string[]);
vi.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(vi.fn(), { preload: (url: string) => { requests.push(url); } }),
  useTexture: Object.assign(vi.fn(), { preload: (urls: string | string[]) => { requests.push(...typeof urls === 'string' ? [urls] : urls); } }),
}));
vi.mock('@react-three/fiber', () => ({ useFrame: vi.fn() }));
// The strike that lands mounts early to rehearse itself (S22, 2026-11-13); only its preload is under test here.
vi.mock('../src/galaxy/NukeBlast.js', async (original) => ({ ...await original<typeof NukeBlastModule>(), NukeBlast: () => <i data-blast="nuclear" /> }));
vi.mock('../src/galaxy/EmpStorm.js', () => ({ EmpStormWarmup: () => <i data-storm="warmup" /> }));
import { TimedImpact } from '../src/galaxy/DeathStarImpact.js';
import type { DeathStarImpactEvent } from '../src/galaxy/DeathStarImpact.js';

const future: DeathStarImpactEvent = {
  id: 'known-strike', at: 20_000, position: [0, 0, 0], radius: 1.3, intensity: 1,
};

beforeEach(() => { requests.length = 0; vi.useFakeTimers(); vi.setSystemTime(10_000); });
afterEach(() => { vi.useRealTimers(); });

describe('the first strategic impact', () => {
  it('a strike on a world begins loading the nuclear strike before arrival', () => {
    render(<TimedImpact event={future} />);
    expect(requests).toContain('/assets/vfx/premium-v2/explosion.webp');
    expect(requests).toContain('/assets/vfx/library/sck-smoke-8x8.webp');
    expect(requests).toContain('/assets/vfx/library/white-shock-4x4.webp');
    expect(requests).toContain('/assets/vfx/library/flare-star.webp');
    // The EMP storm takes over from its crater (owner, 2026-11-12).
    expect(requests).toContain('/assets/vfx/library/electric-line-4x4.webp');
    expect(requests).toContain('/assets/vfx/library/lightning-5x5.webp');
    expect(requests).not.toContain('/assets/models/debris/wreck-plate-gd-v3.glb');
  });

  it('a strike on a world also draws, unseen, the EMP storm that will take over from its crater', () => {
    // The first storm of a session froze 84 ms as it took over (S22, 2026-11-13): its art and programs
    // were new to the GPU. Drawn once while the weapon is in flight, the handover only draws.
    const view = render(<TimedImpact event={future} />);
    expect(view.container.querySelector('[data-storm="warmup"]')).not.toBeNull();
  });

  it('a weapon about to be shot down warms the airborne burst instead, drawing nothing early', () => {
    const view = render(<TimedImpact event={{ ...future, kind: 'interception' }} />);
    expect(view.container.children).toHaveLength(0);
    expect(requests).toContain('/assets/vfx/premium-v2/dust.webp');
    expect(requests).toContain('/assets/vfx/premium-v2/burst.webp');
    expect(requests).toContain('/assets/models/debris/wreck-plate-gd-v3.glb');
    expect(requests).not.toContain('/assets/vfx/library/white-shock-4x4.webp');
  });

  it('does not start a second preload when only visibility intensity is refreshed', () => {
    const view = render(<TimedImpact event={future} />);
    const first = [...requests];
    view.rerender(<TimedImpact event={{ ...future, intensity: 0.35 }} />);
    expect(first.length).toBeGreaterThan(0);
    expect(requests).toEqual(first);
  });
});
