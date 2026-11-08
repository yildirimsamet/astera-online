const STARTER_ROUTES: Record<string, string> = {
  '/api/starter/repair': 'module_repair', '/api/starter/build': 'build', '/api/starter/research': 'research',
  '/api/starter/dock': 'dock', '/api/starter/probe': 'probe', '/api/starter/fleet/launch': 'attack',
  '/api/starter/mining/launch': 'mining', '/api/starter/mining/harvest': 'harvest',
  '/api/starter/collect': 'collect', '/api/starter/fuel': 'fuel', '/api/starter/watch': 'watch',
};

/** Stable categories shared by request observation and server provenance; no raw paths are stored. */
export function analyticsCommand(path: string): string | null {
  const planet = /^\/api\/(?:planet|planets\/(?:[a-f0-9-]{36}|:planetId))\/(collect|upgrade|build|instrument|satellite|research|launch|settle|transfer|repair)$/.exec(path);
  if (planet?.[1]) return planet[1];
  if (/^\/api\/planets\/(?:[a-f0-9-]{36}|:planetId)\/(?:death-star|radiation-bombs|interceptor)\/build$/.test(path)) return 'build';
  if (/^\/api\/planets\/(?:[a-f0-9-]{36}|:planetId)\/build-orders\/(?:[a-f0-9-]{36}|:orderId)\/cancel$/.test(path)) return 'cancel_build';
  if (/^\/api\/planets\/(?:[a-f0-9-]{36}|:planetId)\/research-orders\/(?:[a-f0-9-]{36}|:orderId)\/cancel$/.test(path)) return 'cancel_research';
  if (/^\/api\/(?:fleet\/(?:[a-f0-9-]{36}|:missionId)|(?:trade|mining)\/runs\/(?:[a-f0-9-]{36}|:runId)|pirates\/raids\/(?:[a-f0-9-]{36}|:raidId))\/recall$/.test(path)) return 'recall';
  if (/^\/api\/planets\/(?:[a-f0-9-]{36}|:planetId)\/(?:repairs|maintenance)$/.test(path)) return 'repair';
  if (/^\/api\/planet\/build-orders\/(?:[a-f0-9-]{36}|:orderId)\/cancel$/.test(path)) return 'cancel_build';
  if (/^\/api\/planet\/research-orders\/(?:[a-f0-9-]{36}|:orderId)\/cancel$/.test(path)) return 'cancel_research';
  if (/^\/api\/clans\/(?:[a-f0-9-]{36}|:clanId)\/apply$/.test(path)) return 'clan_apply';
  if (/^\/api\/clan\/requests\/(?:[a-f0-9-]{36}|:requestId)\/(?:accept|reject|cancel)$/.test(path)) return 'clan_request';
  const routes: Record<string, string> = {
    '/api/mining/launch': 'mining', '/api/mining/harvest': 'harvest', '/api/trade/launch': 'trade',
    '/api/pirates/launch': 'pirates', '/api/intel/probe': 'probe', '/api/intel/watch': 'watch',
    '/api/pirates/raid': 'pirates', '/api/fleet/launch': 'attack', '/api/fleet/settle': 'settle',
    '/api/fleet/transfer': 'transfer', '/api/intergalactic-convoy/launch': 'intergalactic_convoy',
    '/api/death-star/launch': 'death_star', '/api/radiation-bombs/launch': 'radiation_bomb',
    '/api/unknown-signals/launch': 'unknown_signal', '/api/monuments/launch': 'monument',
    '/api/chat/messages': 'chat', '/api/clan/chat/messages': 'clan_chat',
    '/api/clan/create': 'clan_create', '/api/clan/leave': 'clan_leave', '/api/clan/invite': 'clan_invite',
    '/api/clan/support': 'clan_support', '/api/clan/aid/launch': 'clan_aid', '/api/clan/war/start': 'clan_war',
  };
  if (Object.hasOwn(routes, path)) return routes[path]!;
  if (/^\/api\/monuments\/(?:[a-f0-9-]{36}|:monumentId)\/(?:send|probe)$/.test(path)) return 'monument';
  // The colony ship's own routes. The client also names most of them by the main-game path it asks for.
  if (Object.hasOwn(STARTER_ROUTES, path)) return STARTER_ROUTES[path]!;
  if (/^\/api\/starter\/(?:fleet|mining\/runs)\/(?:[a-f0-9-]{36}|:id)\/recall$/.test(path)) return 'recall';
  if (/^\/api\/starter\/orders\/(?:[a-f0-9-]{36}|:id)\/cancel$/.test(path)) return 'cancel_build';
  if (/^\/api\/unknown-signals\/(?:[a-f0-9-]{36}|:signalId)\/dispatch$/.test(path)) return 'unknown_signal';
  return null;
}

/** These operations project immutable source rows; all other classified actions use a bounded response callback. */
export function analyticsDurableCommand(path: string): boolean {
  const command = analyticsCommand(path);
  return command !== null && ['upgrade', 'build', 'instrument', 'satellite', 'research', 'attack', 'death_star', 'settle', 'transfer', 'mining', 'harvest', 'trade', 'pirates', 'probe', 'module_repair', 'dock'].includes(command)
    || command === 'monument' && path.endsWith('/send');
}
export function analyticsAuth(path: string): 'claim' | 'login' | 'register' | null {
  if (path === '/api/onboarding/claim' || path === '/api/native/onboarding/claim') return 'claim';
  const match = /^\/api\/(?:native\/)?auth\/(login|register)$/.exec(path);
  return match?.[1] === 'login' || match?.[1] === 'register' ? match[1] : null;
}
