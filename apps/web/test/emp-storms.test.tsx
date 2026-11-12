import { readFileSync } from 'node:fs';
import { act, render } from '@testing-library/react';
import { DEATH_STAR } from '@astera/rules';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NUKE_SECONDS } from '../src/galaxy/nukeLayers.js';
import { PLANET_SKIN_BODY_SCALE } from '../src/galaxy/planetSkinAttachments.js';

const failing = vi.hoisted(() => ({ on: false }));
vi.mock('../src/galaxy/EmpStorm.js', () => ({
  EmpStorm: ({ radius }: { radius: number }) => {
    if (failing.on) throw new Error('art did not load');
    return <i data-storm={String(radius)} />;
  },
}));
import { EmpStorms, type EmpWorld } from '../src/galaxy/EmpStorms.js';

const hit = 5_000_000;
const until = new Date(hit + DEATH_STAR.empMinutes * 60_000);
const struck: EmpWorld = { id: 'struck', position: [0, 0, 0], radius: 2, state: { kind: 'EMP', until, hits: 1 } };
const calm: EmpWorld = { id: 'calm', position: [5, 0, 0], radius: 2, state: { kind: 'NORMAL' } };
const mending: EmpWorld = { id: 'mending', position: [9, 0, 0], radius: 2, state: { kind: 'RECOVERY', until } };
const storms = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('[data-storm]')];

beforeEach(() => { vi.useFakeTimers(); failing.on = false; });
afterEach(() => { vi.useRealTimers(); });

/** Owner, 2026-11-12: the EMP storm over a struck world, for its hour. */
describe('the EMP storms of the galaxy', () => {
  it('a world under EMP has its storm; a calm or mending world has none', () => {
    vi.setSystemTime(hit + 60_000);
    const view = render(<EmpStorms nodes={[struck, calm, mending]} />);
    expect(storms(view.container)).toHaveLength(1);
  });

  it('waits for the strike that caused it to finish playing, then takes over from its crater', () => {
    vi.setSystemTime(hit + 2_000);
    const view = render(<EmpStorms nodes={[struck]} />);
    expect(storms(view.container)).toHaveLength(0);
    act(() => { vi.advanceTimersByTime(NUKE_SECONDS * 1000 - 2_000 + 1); });
    expect(storms(view.container)).toHaveLength(1);
  });

  it('lies on the world as drawn', () => {
    vi.setSystemTime(hit + 60_000);
    const view = render(<EmpStorms nodes={[struck]} />);
    expect(Number(storms(view.container)[0]?.dataset.storm)).toBeCloseTo(struck.radius * PLANET_SKIN_BODY_SCALE, 6);
  });

  it('art that fails to load leaves the world as it was, never the galaxy broken', () => {
    vi.setSystemTime(hit + 60_000);
    failing.on = true;
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const view = render(<EmpStorms nodes={[struck, calm]} />);
    expect(storms(view.container)).toHaveLength(0);
    quiet.mockRestore();
  });

  it('is part of the galaxy, beside the ember that tells it from afar', () => {
    expect(readFileSync('src/galaxy/GalaxyCanvas.tsx', 'utf8')).toContain('<EmpStorms nodes={nodes} />');
  });
});
