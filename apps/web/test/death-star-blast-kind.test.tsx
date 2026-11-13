import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-three/fiber', () => ({ useFrame: vi.fn() }));
vi.mock('../src/galaxy/StrategicBlast.js', () => ({ prewarmStrategicBlast: vi.fn(), StrategicBlast: () => <i data-blast="airborne" /> }));
vi.mock('../src/galaxy/NukeBlast.js', () => ({ prewarmNukeBlast: vi.fn(), NukeBlast: () => <i data-blast="nuclear" /> }));
vi.mock('../src/galaxy/EmpStorm.js', () => ({ EmpStormWarmup: () => null }));
import { TimedImpact, type DeathStarImpactEvent } from '../src/galaxy/DeathStarImpact.js';

const at = 20_000;
const strike: DeathStarImpactEvent = { id: 'strike', at, position: [0, 0, 0], radius: 1.3, intensity: 1 };
const drawn = (event: DeathStarImpactEvent) => render(<TimedImpact event={event} />).container.querySelector<HTMLElement>('[data-blast]')?.dataset.blast;

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(at + 500); });
afterEach(() => { vi.useRealTimers(); });

/** Owner, 2026-11-12: a Death Star that lands is a nuclear strike on the world; one shot down still bursts in the air. */
describe('which blast a Death Star impact draws', () => {
  it('a strike that lands on the world is the nuclear strike', () => {
    expect(drawn(strike)).toBe('nuclear');
    expect(drawn({ ...strike, id: 'surface', kind: 'surface' })).toBe('nuclear');
  });

  it('a weapon shot down bursts in the air as before', () => {
    expect(drawn({ ...strike, id: 'shot', kind: 'interception' })).toBe('airborne');
  });

  /** S22, 2026-11-13: it rehearses unseen while the weapon flies, so the frame of impact only draws. */
  it('a strike that will land is mounted while the weapon is still in flight; one to be shot down is not', () => {
    vi.setSystemTime(at - 60_000);
    expect(drawn(strike)).toBe('nuclear');
    expect(drawn({ ...strike, id: 'shot', kind: 'interception' })).toBeUndefined();
  });
});
