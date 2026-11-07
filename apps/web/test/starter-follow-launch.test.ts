import { describe, expect, it } from 'vitest';
import { followLaunch, ownCraft } from '../src/starter/followLaunch.js';

/** Owner playtest 2026-11-06: in the starter galaxy, whatever leaves the ship takes the camera with it. */
const thread = (id: string | undefined, kind: 'probe' | 'fleet' | 'incoming', leg: 'outbound' | 'return' = 'outbound') => ({ id, kind, leg });
const run = (id: string, status = 'outbound') => ({ id, status });

describe('following what leaves the ship', () => {
  it('learns what is already out on the first look, and follows nothing', () => {
    const first = followLaunch(null, ownCraft([thread('p1', 'probe')], [run('r1')]));
    expect(first.focus).toBeNull();
  });

  it('follows a probe, a fleet or a Prospector the moment it leaves', () => {
    const seen = followLaunch(null, ownCraft([], [])).seen;
    expect(followLaunch(seen, ownCraft([thread('p1', 'probe')], [])).focus).toEqual({ kind: 'thread', key: 'p1' });
    expect(followLaunch(seen, ownCraft([thread('f1', 'fleet')], [])).focus).toEqual({ kind: 'thread', key: 'f1' });
    expect(followLaunch(seen, ownCraft([], [run('r1')])).focus).toEqual({ kind: 'run', id: 'r1' });
  });

  it('does not chase an inbound raid, a craft coming home, or one already followed', () => {
    const seen = followLaunch(null, ownCraft([thread('p1', 'probe')], [])).seen;
    expect(followLaunch(seen, ownCraft([thread(undefined, 'incoming'), thread('p1', 'probe')], [])).focus).toBeNull();
    expect(followLaunch(seen, ownCraft([thread('f2', 'fleet', 'return')], [])).focus).toBeNull();
    expect(followLaunch(seen, ownCraft([], [run('r2', 'done')])).focus).toBeNull();
  });
});
