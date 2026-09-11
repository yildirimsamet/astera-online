import { z } from 'zod';
import { ACADEMY_STEPS, REWARD_CHAINS, rewardId, findRewardTier, coreTier, PROSPECTOR, academyFuel, academyLessonFleet, sensorSphere } from '@astera/rules';
import type { RewardsView } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import { academyPlanet, advanceAcademy, beginAcademyOrder, beginAcademyFlight, completeAcademyLesson, type AcademyWorld } from './academyWorld.js';
import { academyPending, academyMining, academyPirates, academyTarget, academyTraffic, academySightWorlds, atLesson, ACADEMY_ROCK, ACADEMY_TARGET_ID } from './academyViews.js';

/** D172. Production screens, private state. There is deliberately no network
 * fallback, even for an unsupported read or a malformed mutation.
 */
export function academyFetch(
  read: () => AcademyWorld,
  write: (next: AcademyWorld) => void,
  now: () => number = serverNow,
): typeof globalThis.fetch {
  return async (input, init) => {
    const request = input instanceof Request ? input : new Request(new URL(String(input), 'https://academy.invalid'), init);
    const path = new URL(request.url).pathname;
    const method = (init?.method ?? request.method).toUpperCase();
    const time = now();
    const old = read();
    const world = advanceAcademy(old, time);
    if (world !== old) write(world);
    const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { 'content-type': 'application/json' },
      // No x-server-time: a private exercise must not adjust the live clock.
    });
    try {
      let route = path;
      const scoped = /^\/api\/planets\/([^/]+)(.*)$/.exec(path);
      if (scoped) {
        if (decodeURIComponent(scoped[1]!) !== world.preview.reserved.id) throw new Error('ACADEMY_ACTION_REFUSED');
        route = `/api/planet${scoped[2] ?? ''}`;
      }
      if (method === 'GET') {
        const planet = academyPlanet(world);
        switch (route) {
          case '/api/planet': return reply(planet);
          case '/api/season': return reply(world.preview.season);
          case '/api/galaxy': return reply({
            ...world.preview.galaxy,
            sensors: [sensorSphere(world.preview.reserved.position, 0, 0, world.preview.reserved.id)],
            planets: [...world.preview.galaxy.planets.map((p) => p.isSelf ? {
              ...p, coreLevel: world.checkpoint.buildings.CORE, coreTier: coreTier(world.checkpoint.buildings.CORE),
              shielded: planet.planet.shield > 0,
            } : p), ...(world.step >= ACADEMY_STEPS.findIndex((s) => s.id === 'raid') ? [{
              id: ACADEMY_TARGET_ID, name: 'Academy II', owner: '', kind: 'NEUTRAL',
              controller: { kind: 'NEUTRAL', tier: 1 }, position: academyTarget(world),
              coreTier: 1, coreLevel: 1, intel: 'RESOLVED', isSelf: false, satellites: [], shielded: false, state: { kind: 'NORMAL' },
            }] : []),
            ...(atLesson(world, 'telescope') && world.sightDemo
              ? academySightWorlds(world).map((spot, i) => ({
                id: spot.id, name: `Vantage ${String(i + 1)}`, owner: '', kind: 'NEUTRAL',
                controller: { kind: 'NEUTRAL', tier: coreTier(spot.coreLevel) },
                position: spot.position,
                coreTier: coreTier(spot.coreLevel), coreLevel: spot.coreLevel,
                intel: 'RESOLVED', isSelf: false, satellites: [], shielded: false, state: { kind: 'NORMAL' },
              }))
              : [])],
          });
          // One statement of the lesson's traffic, `engagement` included — built
          // inline here until D183, which is how it came to be missing the field
          // that turns the pirate to face the wing shooting at it.
          case '/api/galaxy/traffic': return reply({ contacts: academyTraffic(world, time) });
          case '/api/session/pending': return reply({ pending: academyPending(world, time) });
          case '/api/rewards': return reply(academyRewards(world));
          case '/api/reports': return reply({ reports: world.reports, rivals: [] });
          case '/api/notifications': return reply({ notifications: world.reports.filter((r) => {
            // The report exercise reveals only its own signal. Showing the old
            // pirate beside the world raid let the wrong report satisfy the lesson.
            const id = ACADEMY_STEPS[world.step]?.id;
            return id === 'raidReport' ? r.missionId === 'academy-raid'
              : id === 'pirateReport' ? r.pirateRaidId === 'academy-pirate' : true;
          }).map((r) => ({
            id: `${r.id}-signal`, kind: 'raid_result', refId: r.pirateRaidId ?? r.missionId,
            seen: world.seenSignals.includes(`${r.id}-signal`), at: r.at, payload: { grade: r.grade, targetPlanetName: r.opponentPlanet,
              ...(r.pirate ? { targetKind: 'PIRATE', pirateLevel: 1, pirateCallsign: 'AC-01', capturedHull: 'WARDEN' } : {}),
              lootAlloy: r.lootAlloy, lootCrystal: r.lootCrystal, lootDeuterium: r.lootDeuterium,
              unitsLost: Object.values(r.yourLosses).reduce((sum, count) => sum + count, 0),
              shipsHome: Object.values(r.yourFleet).reduce((sum, count) => sum + count, 0)
                - Object.values(r.yourLosses).reduce((sum, count) => sum + count, 0) + (r.pirate ? 1 : 0) },
          })) });
          case '/api/intel': return reply({ watching: [], radarLog: [], probeReports: [], probeCost: { alloy: 50, crystal: 50, deuterium: 0 } });
          case '/api/mining': case '/api/mining/field': case '/api/mining/status': return reply(academyMining(world, time));
          case '/api/pirates': return reply(academyPirates(world));
          case '/api/galaxy/events': return reply({ events: [] });
          case '/api/clan/badge': return reply({ available: false, membership: null, attention: false, attentionCount: 0, clanChatUnread: 0 });
          case '/api/session/unlocks': return reply({ unlocked: [] });
          case '/api/leaderboard': return reply({ ladder: [], you: null });
        }
      }
      if (method === 'POST' && route === '/api/notifications/seen') {
        const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : await request.json();
        const { ids } = z.object({ ids: z.array(z.string()).optional() }).strict().parse(body);
        const fresh = world.reports.map((r) => `${r.id}-signal`)
          .filter((id) => !world.seenSignals.includes(id) && (!ids || ids.includes(id)));
        if (fresh.length) write({ ...world, seenSignals: [...world.seenSignals, ...fresh] });
        return reply({ marked: fresh.length });
      }
      if (method === 'POST' && ['/api/rewards/claim', '/api/planet/upgrade', '/api/planet/instrument', '/api/planet/build', '/api/pirates/raid', '/api/fleet/launch', '/api/mining/launch'].includes(route)) {
        const raw = init?.body;
        const body: unknown = typeof raw === 'string' ? JSON.parse(raw) : await request.json();
        const step = ACADEMY_STEPS[world.step];
        if (!step) throw new Error('ACADEMY_ACTION_REFUSED');
        if (['/api/pirates/raid', '/api/fleet/launch', '/api/mining/launch'].includes(route)) {
          const input = z.object({ originPlanetId: z.string().optional(), targetPlanetId: z.string().optional(), pirateId: z.string().optional(),
            asteroidId: z.string().optional(), craft: z.number().optional(), fleet: z.record(z.number()).optional() }).strict().parse(body);
          const kind = route === '/api/pirates/raid' ? 'pirate' : route === '/api/mining/launch' ? 'mine' : 'raid';
          if (input.originPlanetId && input.originPlanetId !== world.preview.reserved.id) throw new Error('ACADEMY_ACTION_REFUSED');
          // ONE STATEMENT OF WHAT A LESSON SENDS, read here and by the picker.
          // These were two hand-written lists and they drifted: the sheet offered
          // three Darts and this refused anything but two, which reached the
          // player as a commit button that did nothing.
          const expected = kind === 'mine' ? {} : academyLessonFleet(kind);
          if (!atLesson(world, kind) || (kind === 'mine' ? input.asteroidId !== ACADEMY_ROCK || input.craft !== 1
            : kind === 'pirate' ? input.pirateId !== 'academy-pirate' : input.targetPlanetId !== ACADEMY_TARGET_ID)) throw new Error('ACADEMY_ACTION_REFUSED');
          if (kind !== 'mine' && (!input.fleet || Object.keys(input.fleet).some((id) => (input.fleet?.[id] ?? 0) !== (Object.entries(expected).find(([key]) => key === id)?.[1] ?? 0))
            || Object.entries(expected).some(([id, count]) => input.fleet?.[id] !== count))) throw new Error('ACADEMY_ACTION_REFUSED');
          const next = beginAcademyFlight(world, kind, time);
          write(next);
          const f = next.flight!;
          return reply({ planet: academyPlanet(next), pending: academyPending(next, time),
            missionId: f.id, raidId: f.id, runId: f.id, pirateId: 'academy-pirate', level: 1, callsign: 'AC-01',
            asteroidId: ACADEMY_ROCK, fleet: f.fleet, craft: 1, capacity: PROSPECTOR.hold,
            departAt: new Date(f.departAt), arriveAt: new Date(f.arriveAt), flightMinutes: 0.1,
            exposureMinutes: (f.homeAt - f.departAt) / 60_000, homeDefenceAfter: 0,
            intercept: academyTarget(world), fuel: kind === 'mine' ? 0 : academyFuel(kind), mining: academyMining(next, time),
          });
        }
        if (route === '/api/rewards/claim') {
          const { id } = z.object({ id: z.string() }).strict().parse(body);
          if (!('reward' in step) || step.reward !== id) throw new Error('ACADEMY_ACTION_REFUSED');
          const ref = findRewardTier(id);
          if (!ref) throw new Error('ACADEMY_ACTION_REFUSED');
          const next = completeAcademyLesson(world, step.id);
          write(next);
          return reply({ granted: ref.tier.reward, rewards: academyRewards(next), planet: academyPlanet(next) });
        }
        if (route === '/api/planet/upgrade' || route === '/api/planet/instrument') {
          const { type } = z.object({ type: z.string() }).strict().parse(body);
          const wanted = route.endsWith('/upgrade') && 'building' in step ? step.building
            : route.endsWith('/instrument') && step.id === 'aegis' ? 'AEGIS' : null;
          if (type !== wanted) throw new Error('ACADEMY_ACTION_REFUSED');
          const next = beginAcademyOrder(world, step.id, time);
          write(next);
          const planet = academyPlanet(next);
          const level = 'building' in step ? world.checkpoint.buildings[step.building] + 1 : 1;
          return reply({ type, level, ...next.checkpoint.resources, planet });
        }
        if (route === '/api/planet/build') {
          const { hull, count } = z.object({ hull: z.string(), count: z.number().int().positive() }).strict().parse(body);
          const wanted = step.id === 'darts' || step.id === 'reinforcements' ? 'DART'
            : step.id === 'prospector' ? 'PROSPECTOR' : step.id === 'courier' ? 'COURIER' : null;
          if (hull !== wanted || count !== (wanted === 'DART' ? 2 : 1)) throw new Error('ACADEMY_ACTION_REFUSED');
          const next = beginAcademyOrder(world, step.id, time);
          write(next);
          return reply({ hull, built: count, ...next.checkpoint.resources, planet: academyPlanet(next) });
        }
      }
      return reply({ error: 'ACADEMY_ONLY', message: 'ACADEMY_ONLY' }, 404);
    } catch (error) {
      const code = error instanceof z.ZodError || error instanceof SyntaxError ? 'BAD_REQUEST'
        : error instanceof Error ? error.message : 'ACADEMY_ACTION_REFUSED';
      return reply({ error: code, message: code }, 400);
    }
  };
}

/** Only the current lesson can pay; previous lesson rewards remain visible. */
export function academyRewards(world: AcademyWorld): RewardsView {
  const step = ACADEMY_STEPS[world.step];
  const current = step && 'reward' in step ? step.reward : null;
  const paid = new Set(world.checkpoint.claimedRewards);
  const chains = REWARD_CHAINS.flatMap((chain) => {
    const tiers = chain.tiers.flatMap((tier) => {
      const id = rewardId(chain.id, tier.goal);
      if (id !== current && !paid.has(id)) return [];
      return [{ id, goal: tier.goal, alloy: tier.reward.alloy, crystal: tier.reward.crystal,
        state: paid.has(id) ? 'claimed' as const : 'claimable' as const }];
    });
    return tiers.length ? [{ id: chain.id, metric: chain.metric, scope: chain.scope,
      progress: Math.max(...tiers.map((tier) => tier.goal)), tiers }] : [];
  });
  return { chains, claimable: current === null ? 0 : 1 };
}
