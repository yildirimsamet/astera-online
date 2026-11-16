import type { QueryClient } from '@tanstack/react-query';
import { TRADE } from '@astera/rules';
import { keys } from '../../api/keys.js';
import {
  activeGalaxyEventsSchema, clanBadgeSchema, galaxySchema, miningFieldSchema, notificationsSchema, pendingSchema, piratesSchema,
  trafficSchema, type PlanetView, type SeasonInfo,
} from '../../api/schemas.js';

const MIN = 60_000;
const HOUR = 60 * MIN;

/**
 * THE BUSIEST GALAXY A COMMANDER CAN SEE (owner review, 2026-11-16): every corner, chip, count,
 * card and map mark the galaxy screen can carry, all at once, so the owner can judge how the
 * screen holds when nothing is quiet. `calm` keeps the attack away, so the foot shows the events'
 * card instead. Gallery only — nothing here reaches a server.
 */
export function seedEverything(client: QueryClient, { calm = false }: { calm?: boolean } = {}): void {
  const now = Date.now();
  const at = (minutes: number) => new Date(now + minutes * MIN);
  const updatedAt = now + 24 * HOUR;
  const seed = (key: readonly unknown[], data: unknown) => { client.setQueryData(key, data, { updatedAt }); };

  const home = client.getQueryData<PlanetView>(keys.planetById('trial-home'));
  if (home) {
    seed(keys.planetById('trial-home'), {
      ...home,
      planet: { ...home.planet, signalBoostUntil: at(90), productionBoostUntil: at(50) },
    });
  }
  const season = client.getQueryData<SeasonInfo>(keys.season);
  if (season) seed(keys.season, { ...season, startsAt: at(-600), shieldUntil: at(71 * 60), shieldKind: 'NEWCOMER', onlineToday: 42, players: 28 });

  seed(keys.rewards, { chains: [], claimable: 7 });
  const news = (id: string, kind: string, minutes: number, payload: Record<string, unknown>) => ({ id, kind, payload, refId: null, seen: false, at: at(-minutes) });
  seed(keys.notifications, notificationsSchema.parse({ notifications: [
    news('n-incoming', 'incoming_fleet', 1, { arriveAt: at(9).toISOString(), etaMinutes: 9, targetPlanetName: 'Kestrel' }),
    news('n-raided', 'raided', 35, { grade: 'PARTIAL', lootAlloy: 900, lootCrystal: 240, unitsLost: 3, targetPlanetName: 'Vega', originPlanetId: 'r1', originUsername: 'Vesper', originPlanetName: 'Draco-7' }),
    news('n-probe', 'probe_report', 50, { targetPlanetId: 'r2', targetPlanetName: 'Lyra-3' }),
    news('n-home', 'fleet_returned', 90, { trip: 'raid', ships: 26, lootAlloy: 3_100, lootCrystal: 1_000 }),
  ] }));
  seed(keys.announcements, { announcements: [{
    id: '00000000-0000-4000-8000-000000000001', title: 'Astera Online', bodyHtml: '<p>Astera Online</p>', publishedAt: new Date(now - HOUR), seen: false,
  }] });
  seed(keys.dmUnread, { count: 2 });
  for (const language of ['tr', 'en', 'de', 'es', 'fr', 'ja'] as const) seed(keys.chatUnreadFor(language), { count: 6 });
  seed(keys.clanBadge, clanBadgeSchema.parse({
    available: true, attention: true, attentionCount: 8, clanChatUnread: 5,
    membership: { clanId: 'c1', name: 'Kuzey Yıldızı', tag: 'KZY', role: 'MEMBER', matureAt: new Date(now - 24 * HOUR), mature: true },
  }));

  // Two events at once: a rock shower and a merchant crossing the galaxy.
  seed(keys.galaxyEvents, activeGalaxyEventsSchema.parse({ events: [
    { id: '00000000-0000-4000-8000-0000000000e1', kind: 'ASTEROID_SHOWER', startsAt: at(-60), endsAt: at(30), asteroidSpawnMultiplier: 2 },
    {
      id: '00000000-0000-4000-8000-0000000000e2', kind: 'TRADE_SHIP', startsAt: at(-20), endsAt: at(90), rate: TRADE.rate, appearsAtMinute: 580, expiresAtMinute: 690,
      orbit: { radius: 1_100, period: (2 * Math.PI * 1_100) / TRADE.speed, phase: 0.7, inclination: 0.4, ascendingNode: 1.9, speed: TRADE.speed },
    },
  ] }));

  // An attack coming in, a raid of your own out, and a probe on its way.
  seed(keys.pending, pendingSchema.parse({ pending: [
    ...(calm ? [] : [{ kind: 'incoming', targetName: 'Kestrel', targetPlanetId: 'trial-home', minutesRemaining: 9, arriveAt: at(9), mass: 'MEDIUM' }]),
    { id: 'f1', kind: 'fleet', targetName: 'Draco-7', originPlanetId: undefined, minutesRemaining: 24, arriveAt: at(24), leg: 'outbound', fleet: { DART: 12, CORSAIR: 4 } },
    { id: 'p1', kind: 'probe', targetName: 'Lyra-3', minutesRemaining: 4, arriveAt: at(4), leg: 'outbound' },
  ] }));

  // The galaxy around you: two rival worlds and the eight monuments.
  const galaxy = galaxySchema.parse(client.getQueryData(keys.galaxy));
  const rival = (id: string, name: string, owner: string, x: number, z: number) => ({
    id, name, position: { x, y: 0, z }, owner, intel: 'RESOLVED' as const, kind: 'CAPITAL' as const,
    controller: { kind: 'PLAYER' as const, playerId: `p-${id}`, displayName: owner },
    isOwned: false, isSelf: false, coreLevel: 4, state: { kind: 'NORMAL' as const },
  });
  seed(keys.galaxy, galaxySchema.parse({
    ...galaxy,
    sensors: [{ planetId: 'trial-home', at: { x: 520, y: 0, z: 420 }, telescope: true, identify: 2_400, detect: 4_000 }],
    planets: [...galaxy.planets, rival('r1', 'Draco-7', 'Vesper', -380, 760), rival('r2', 'Lyra-3', 'Halden', 1_480, -120)],
    monuments: [1, 2, 3, 4, 5, 6, 7, 8].map(ordinal => {
      const angle = (ordinal / 8) * Math.PI * 2;
      const near = [{ x: 150, z: 80 }, { x: 930, z: 120 }, { x: 180, z: 760 }][ordinal - 1];
      return {
        id: `m${String(ordinal)}`, ordinal, position: near ? { x: near.x, y: 0, z: near.z } : { x: Math.cos(angle) * 2_600, y: 0, z: Math.sin(angle) * 2_600 },
        difficulty: ordinal % 2 === 0 ? 'HARD' : 'EASY',
        controller: ordinal === 3 ? { kind: 'PLAYER', playerId: 'p-r1', name: 'Vesper' } : { kind: 'NEUTRAL' },
        capacity: 7_000, used: 0, productionPerMinute: 60, emptySince: null,
      };
    }),
  }));

  // Rocks, wrecks, pirates and passing craft on the map.
  // Rock clocks are minutes since the season opened; this season opened ten hours ago.
  const rock = (n: number, radius: number, phase: number) => ({
    id: `everythingRock${String(n)}abcdefg`.slice(0, 22), level: 1 + (n % 3), ore: 4_000, oreRemaining: 3_200, crystalShare: 0.3,
    radius, period: (2 * Math.PI * radius) / 2, phase, inclination: 0.2, ascendingNode: 0.4 * n, speed: 2,
    appearsAt: 560, expiresAt: 900, active: true, isotopeRich: n === 2, deuteriumShare: n === 2 ? 0.2 : null,
  });
  seed(keys.miningField, miningFieldSchema.parse({
    asteroids: [rock(1, 640, 0.3), rock(2, 760, 0.9), rock(3, 1_700, 4.2), rock(4, 700, 1.4)],
    debris: [
      { id: 'd1', planetId: null, at: { x: 760, y: 0, z: 640 }, alloy: 4_100, crystal: 2_000, deuterium: 0, minutesLeft: 140 },
      { id: 'd2', planetId: 'r1', at: { x: -380, y: 0, z: 760 }, alloy: 900, crystal: 300, deuterium: 120, minutesLeft: 60 },
    ],
    nextFieldChangeAt: at(45),
  }));
  const pirateAt = [{ x: 820, y: 0, z: 300 }, { x: 260, y: 0, z: 330 }];
  seed(keys.traffic, trafficSchema.parse({ interceptions: [], contacts: [
    ...pirateAt.map((spot, n) => ({ id: `pc${String(n)}`, kind: 'pirate', level: n + 2, from: spot, to: { ...spot, x: spot.x + 60 }, startAt: at(-5), endAt: at(40) })),
    { id: 'u1', kind: 'unknown', from: { x: -900, y: 0, z: 300 }, to: { x: -600, y: 0, z: 380 }, startAt: at(-3), endAt: at(9), inbound: true },
    { id: 'u2', kind: 'fleet', from: { x: 1_600, y: 0, z: 900 }, to: { x: 1_300, y: 0, z: 1_000 }, startAt: at(-2), endAt: at(12), mass: 'HEAVY' },
  ] }));
  seed(keys.piratesFrom('trial-home'), piratesSchema.parse({ originPlanetId: 'trial-home', pirates: pirateAt.map((spot, n) => ({
    id: `pc${String(n)}`, callsign: `K${String(n)}X${String(n)}`, zone: 'IDENTIFIED', at: spot, expiresInMinutes: 40, reachMinutes: 14 + n * 6, reach: [], level: n + 2,
  })) }));
}
