/**
 * EVERY CACHE KEY IN THE CLIENT, AND NOTHING ELSE IN THIS FILE.
 *
 * Split out of `queries.ts` because a second module needs it and must not drag
 * React in to get it: `shardEvents.ts` maps a galaxy-wide event to the reads it
 * moves, and that mapping is pinned against the server's own namespace by a test
 * in `apps/server`. Importing it through the hooks file pulled `context.tsx` — and
 * therefore JSX — into a package that does not compile JSX.
 *
 * A table of constants with no imports has no such problem, and it was never a
 * hooks concern to begin with.
 */
export const keys = {
  servers: ['servers'],
  season: ['season'],
  planet: ['planet'],
  galaxy: ['galaxy'],
  intel: ['intel'],
  leaderboard: ['leaderboard'],
  notifications: ['notifications'],
  unlocks: ['unlocks'],
  pending: ['pending'],
  traffic: ['traffic'],
  reports: ['reports'],
  mining: ['mining'],
} as const;
