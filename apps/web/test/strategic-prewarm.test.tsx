import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requests = vi.hoisted(() => [] as string[]);
vi.mock('@react-three/drei', () => ({
  useGLTF: Object.assign(vi.fn(), { preload: (url: string) => { requests.push(url); } }),
  useTexture: Object.assign(vi.fn(), { preload: (urls: string | string[]) => { requests.push(...typeof urls === 'string' ? [urls] : urls); } }),
}));
vi.mock('@react-three/fiber', () => ({ useFrame: vi.fn() }));
import { TimedImpact } from '../src/galaxy/DeathStarImpact.js';
import type { DeathStarImpactEvent } from '../src/galaxy/DeathStarImpact.js';

const future: DeathStarImpactEvent = {
  id: 'known-strike', at: 20_000, position: [0, 0, 0], radius: 1.3, intensity: 1,
};

beforeEach(() => { requests.length = 0; vi.useFakeTimers(); vi.setSystemTime(10_000); });
afterEach(() => { vi.useRealTimers(); });

describe('the first strategic impact', () => {
  it('begins loading its real art before arrival while drawing no premature destruction', () => {
    const view = render(<TimedImpact event={future} />);
    expect(view.container.children).toHaveLength(0);
    expect(requests).toContain('/assets/vfx/premium-v2/explosion.webp');
    expect(requests).toContain('/assets/vfx/premium-v2/dust.webp');
    expect(requests).toContain('/assets/vfx/premium-v2/burst.webp');
    expect(requests).toContain('/assets/models/debris/wreck-plate-gd-v3.glb');
  });

  it('does not start a second preload when only visibility intensity is refreshed', () => {
    const view = render(<TimedImpact event={future} />);
    const first = [...requests];
    view.rerender(<TimedImpact event={{ ...future, intensity: 0.35 }} />);
    expect(first.length).toBeGreaterThan(0);
    expect(requests).toEqual(first);
    expect(view.container.children).toHaveLength(0);
  });
});
