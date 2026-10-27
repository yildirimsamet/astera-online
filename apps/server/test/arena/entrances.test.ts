import { describe, expect, it } from 'vitest';
import { TEAM_CONNECT_SECONDS, ARENA_TUNING as T, createSandboxWorld } from '@astera/rules/arena';
import { groupEntrances } from '../../src/arena/entrances.js';

describe('one entrance per confirmed team match', () => {
  it('keeps a delayed teammate with their group while solo pilots and other matches use the next gates', () => {
    const world = createSandboxWorld({ bots: 0 }); const take = groupEntrances(world);
    const a = take('match-a'); const solo = take(null); const b = take('match-b');
    expect(solo).not.toBe(a); expect(b).not.toBe(a); expect(b).not.toBe(solo);
    world.tick += (TEAM_CONNECT_SECONDS - 1) * T.tickRate;
    expect(take('match-a')).toBe(a); expect(take('match-b')).toBe(b);
  });
  it('drops an expired reservation and never advances the global gate cursor for a teammate', () => {
    const world = createSandboxWorld({ bots: 0 }); const take = groupEntrances(world);
    const a = take('match'); const after = world.entryCursor;
    expect(take('match')).toBe(a); expect(world.entryCursor).toBe(after);
    world.tick += TEAM_CONNECT_SECONDS * T.tickRate;
    expect(take('match')).not.toBe(a); expect(world.entryCursor).not.toBe(after);
  });
  it('deals solo entrances in the normal round robin order', () => {
    const world = createSandboxWorld({ bots: 0 }); const take = groupEntrances(world);
    const used = Array.from({ length: world.layout.entries.length }, () => take(null));
    expect(new Set(used).size).toBe(world.layout.entries.length); expect(take(null)).toBe(used[0]);
  });
});
