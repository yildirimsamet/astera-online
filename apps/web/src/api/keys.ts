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
  planets: ['planets'],
  planet: ['planet'],
  planetById: (planetId: string) => ['planet', planetId] as const,
  galaxy: ['galaxy'],
  intel: ['intel'],
  leaderboard: ['leaderboard'],
  clanBadge: ['clan', 'badge'],
  clanHome: ['clan', 'home'],
  clanStrength: ['clan', 'strength'],
  clanDirectory: (search: string) => ['clan', 'directory', search.trim()] as const,
  clanLeaderboard: ['clan', 'leaderboard'],
  clanEvents: ['clan', 'events'],
  clanDepot: ['clan', 'depot'],
  clanAid: ['clan', 'aid'],
  clanChat: ['clan', 'chat'],
  chatMessages: ['chat', 'messages'],
  chatUnread: ['chat', 'unread'],
  chronicle: ['chronicle'],
  notifications: ['notifications'],
  unlocks: ['unlocks'],
  pending: ['pending'],
  traffic: ['traffic'],
  reports: ['reports'],
  rewards: ['rewards'],
  mining: ['mining'],
  miningField: ['mining', 'field'],
  miningStatus: ['mining', 'status'],
  miningStatusById: (planetId: string) => ['mining', 'status', planetId] as const,
} as const;
