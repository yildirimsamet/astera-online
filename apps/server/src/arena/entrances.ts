import { ARENA_TUNING as T, TEAM_CONNECT_SECONDS, nextEntry, type ArenaWorld } from '@astera/rules/arena';

/** A trusted match reserves one gate through its connection window; solo arrivals keep rotating. */
export function groupEntrances(world: ArenaWorld): (teamId: string | null) => number {
  const matches = new Map<string, { gate: number; until: number }>();
  return teamId => {
    // Only arrivals allocate; removing expired leases here keeps the cache bounded over a long room.
    for (const [id, lease] of matches) if (lease.until <= world.tick) matches.delete(id);
    if (teamId === null) return nextEntry(world);
    const existing = matches.get(teamId);
    if (existing) return existing.gate;
    const gate = nextEntry(world);
    matches.set(teamId, { gate, until: world.tick + TEAM_CONNECT_SECONDS * T.tickRate });
    return gate;
  };
}
