import { z } from 'zod';
import { PROBE, PROSPECTOR, claimOre, combatValue, distance, fleetEntries, fuzzBand, mulberry32, probeAccuracy, sensorZone, type Fleet } from '@astera/rules';
import type { Contact, IntelView, MiningView, PendingThread } from '../../api/schemas.js';
import { academyFetch } from '../academyFetch.js';
import { openAcademy } from '../academyWorld.js';
import { SCHOOL_HOME, SCHOOL_ROCK, SCHOOL_TARGET, SCHOOL_MINING_SPEED, SCHOOL_DEFENDER, SCHOOL_INVADER,
  schoolAction, schoolGalaxy, schoolPlanet, schoolRock, schoolThreatHold, schoolExampleLeg, type SchoolAction, type SchoolWorld } from './world.js';

export function schoolIntel(w: SchoolWorld): IntelView {
  const accuracy = probeAccuracy(w.buildings.SHIPYARD, 0);
  const band = (n: number) => fuzzBand(n, accuracy, mulberry32(47));
  return { watching: w.watching ? [{ slot: 0, targetPlanetId: SCHOOL_TARGET, targetName: 'Lyra', ownerName: '',
    reading: { status: 'HOME', state: 'FULL', clarity: 1, staleMinutes: 0, etaMinutes: null }, cooldownUntil: null }] : [],
    radarLog: [], probeCost: { alloy: PROBE.alloy, crystal: PROBE.crystal, deuterium: 0 }, probeCooldowns: [],
    probeReports: w.probeAt === null ? [] : [{ missionId: 'school-probe', targetPlanetId: SCHOOL_TARGET,
      targetName: 'Lyra', targetUsername: '', at: new Date(w.probeAt), accuracy,
      stock: band(1600), deuteriumStock: band(30), defence: band(combatValue(SCHOOL_DEFENDER)),
      fleetSize: band(5), fleetHome: true, detected: false }],
  };
}

export function schoolMining(w: SchoolWorld, now: number): MiningView & { isotopes: never[] } {
  const mined = claimOre(120, PROSPECTOR.hold, 0.3, 0);
  return {
    derrick: false, craftSpeed: SCHOOL_MINING_SPEED, craftHold: PROSPECTOR.hold, derrickHold: PROSPECTOR.hold,
    craftReadyAt: null, isotopes: [], debris: [], nextFieldChangeAt: null,
    asteroids: w.instruments.TELESCOPE > 0 && schoolRock(w, now).oreRemaining > 0 ? [schoolRock(w, now)] : [],
    runs: [...w.journeys, ...(w.flight ? [w.flight] : [])].filter(f => f.kind === 'mine').map(f => ({
      id: 'school-mine', targetKind: 'asteroid', asteroidId: SCHOOL_ROCK, debrisFieldId: null,
      status: now >= f.homeAt ? 'done' : now >= f.arriveAt ? 'returning' : 'outbound', craft: 1,
      departAt: new Date(f.departAt), arriveAt: new Date(f.arriveAt), homeAt: new Date(f.homeAt), intercept: f.to,
      minedAlloy: now >= f.arriveAt ? mined.alloy : 0, minedCrystal: now >= f.arriveAt ? mined.crystal : 0, minedDeuterium: 0,
    })),
  };
}

export function schoolPending(w: SchoolWorld, now: number): PendingThread[] {
  const f = w.flight;
  const sensor = schoolGalaxy(w, now).sensors?.[0];
  if (!f) return sensor && sensor.detect >= distance(sensor.at, schoolThreatHold()) && ['warning', 'aegis', 'shield', 'guns', 'defend'].includes(w.scene)
    ? [{ kind: 'incoming', targetName: 'Aurora', targetPlanetId: SCHOOL_HOME, contactId: 'school-incoming', arriveAt: new Date(now + 60_000), minutesRemaining: 1 }] : [];
  if (f.kind === 'mine') return [];
  if (f.kind === 'defend') return [{ kind: 'incoming', targetName: 'Aurora', targetPlanetId: SCHOOL_HOME,
    contactId: 'school-incoming', arriveAt: new Date(f.arriveAt), minutesRemaining: Math.max(0, f.arriveAt - now) / 60_000 }];
  const back = now >= f.turnAt;
  const end = back ? f.homeAt : f.arriveAt;
  const report = w.reports.find(r => r.missionId === 'school-raid');
  const fleet: Fleet = report && back ? Object.fromEntries(fleetEntries(f.fleet).map(([id, n]) => [id, n - (report.yourLosses[id] ?? 0)])) : f.fleet;
  return [{ id: `school-${f.kind}`, kind: f.kind === 'probe' ? 'probe' : 'fleet', targetName: 'Lyra', targetPlanetId: SCHOOL_TARGET,
    arriveAt: new Date(end), minutesRemaining: Math.max(0, end - now) / 60_000, leg: back ? 'return' : 'outbound',
    ...(f.kind === 'raid' ? { fleet } : {}),
    path: { from: back ? f.to : f.from, to: back ? f.from : f.to,
      departAt: new Date(back ? f.turnAt : f.departAt), arriveAt: new Date(end) },
  }];
}

export function schoolTraffic(w: SchoolWorld, now: number): Contact[] {
  const sphere = schoolGalaxy(w, now).sensors?.[0];
  if (!sphere) return [];
  const traffic: Contact[] = [];
  const { from: start, to: end } = schoolExampleLeg();
  const departAt = w.scene === 'traffic' ? w.sceneAt : w.startedAt;
  const elapsed = Math.max(0, Math.min(1, (now - departAt) / 8000));
  const position = { x: start.x + (end.x - start.x) * elapsed, y: 0, z: start.z + (end.z - start.z) * elapsed };
  if (now < departAt + 8000 && sensorZone([sphere], position) === 'IDENTIFIED') traffic.push({ id: 'school-neighbour-fleet', kind: 'fleet', fleet: { DART: 6 },
    from: start, to: end, landing: true, startAt: new Date(departAt), endAt: new Date(departAt + 8000) });
  const f = w.flight;
  const waiting = ['incoming', 'radar', 'warning', 'aegis', 'shield', 'guns', 'defend'].includes(w.scene);
  if (waiting || f?.kind === 'defend') {
    const home = schoolPlanet(w).planet.position;
    const active = f?.kind === 'defend';
    const from = active ? f.from : schoolThreatHold();
    traffic.push({ id: 'school-incoming', kind: 'fleet', fleet: { ...SCHOOL_INVADER },
      from, to: active ? home : from, landing: true,
      startAt: new Date(active ? f.departAt : now), endAt: new Date(active ? f.arriveAt : now),
      ...(active && now >= f.arriveAt && now < f.turnAt ? { engagement: { target: home, arriveAt: new Date(f.arriveAt), endsAt: new Date(f.turnAt) } } : {}),
      ...(sphere.detect >= distance(home, from) ? { inbound: true as const } : {}),
    });
  }
  return traffic;
}

/** Private transport: no authentication, live cache, network fallback or transfer
 * of exercise state. Validate even scripted writes before committing them. */
export function schoolFetch(read: () => SchoolWorld, dispatch: (action: SchoolAction, now: number) => void,
  clock: () => number): typeof globalThis.fetch {
  const legacy = academyFetch(() => {
    const w = read(); const original = openAcademy(w.startedAt);
    return { ...original, checkpoint: { ...original.checkpoint, buildings: w.buildings, resources: w.resources } };
  }, () => { throw new Error('ACADEMY_ACTION_REFUSED'); }, clock);
  return async (input, init) => {
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    signal?.throwIfAborted();
    const request = input instanceof Request ? input : new Request(new URL(String(input), 'https://school.invalid'), { ...init, signal: null });
    const path = new URL(request.url).pathname;
    const method = init?.method ?? request.method;
    const now = clock(), w = read();
    const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    try {
      const scoped = /^\/api\/planets\/([^/]+)(.*)$/.exec(path);
      if (scoped && decodeURIComponent(scoped[1]!) !== SCHOOL_HOME) throw new Error('ACADEMY_ACTION_REFUSED');
      const route = scoped ? `/api/planet${scoped[2] ?? ''}` : path;
      if (method === 'GET') {
        switch (route) {
          case '/api/planet': return reply(schoolPlanet(w));
          case '/api/planets': return reply({ playerId: 'academy-commander', seasonId: 'flight-school', capitalPlanetId: SCHOOL_HOME, planets: [schoolPlanet(w)] });
          case '/api/galaxy': return reply(schoolGalaxy(w, now));
          case '/api/galaxy/traffic': return reply({ contacts: schoolTraffic(w, now) });
          case '/api/intel': return reply(schoolIntel(w));
          case '/api/session/pending': return reply({ pending: schoolPending(w, now) });
          case '/api/mining': case '/api/mining/field': case '/api/mining/status': return reply(schoolMining(w, now));
          case '/api/reports': return reply({ reports: w.reports, rivals: [] });
          case '/api/notifications': return reply({ notifications: [] });
          default: return await legacy(request, init);
        }
      }
      if (method !== 'POST') return reply({ error: 'ACADEMY_ONLY' }, 404);
      const raw: unknown = request.body ? await request.json() : {};
      let action: SchoolAction;
      if (route === '/api/planet/upgrade' || route === '/api/planet/instrument' || route === '/api/planet/satellite') {
        const body = z.object({ type: z.string(), confirmedLevel: z.number().int().optional() }).strict().parse(raw);
        action = { kind: 'order', subject: body.type, count: 1 };
      } else if (route === '/api/planet/build') {
        const body = z.object({ hull: z.string(), count: z.number().int().positive() }).strict().parse(raw);
        action = { kind: 'order', subject: body.hull, count: body.count };
      } else if (route === '/api/planet/collect') action = { kind: 'collect' };
      else if (route === '/api/intel/watch') {
        const body = z.object({ targetPlanetId: z.literal(SCHOOL_TARGET), slot: z.literal(0), observerPlanetId: z.literal(SCHOOL_HOME).optional() }).strict().parse(raw);
        void body; action = { kind: 'watch' };
      } else if (route === '/api/intel/probe') {
        z.object({ targetPlanetId: z.literal(SCHOOL_TARGET), originPlanetId: z.literal(SCHOOL_HOME).optional() }).strict().parse(raw);
        action = { kind: 'probe' };
      } else if (route === '/api/mining/launch') {
        z.object({ asteroidId: z.literal(SCHOOL_ROCK), craft: z.literal(1), originPlanetId: z.literal(SCHOOL_HOME).optional() }).strict().parse(raw);
        action = { kind: 'mine' };
      } else if (route === '/api/fleet/launch') {
        const body = z.object({ targetPlanetId: z.literal(SCHOOL_TARGET), fleet: z.object({ DART: z.literal(30), COURIER: z.literal(2) }).strict(),
          originPlanetId: z.literal(SCHOOL_HOME).optional(), idempotencyKey: z.string().optional(), pace: z.literal(1).optional() }).strict().parse(raw);
        void body; action = { kind: 'raid' };
      } else return reply({ error: 'ACADEMY_ONLY', message: 'ACADEMY_ONLY' }, 404);
      const next = schoolAction(w, action, now);
      dispatch(action, now);
      const planet = schoolPlanet(next);
      if (action.kind === 'collect') return reply({ moved: { alloy: w.buffer.alloy - next.buffer.alloy,
        crystal: w.buffer.crystal - next.buffer.crystal, deuterium: w.buffer.deuterium - next.buffer.deuterium }, blocked: next.buffer,
        ...next.resources, bufferAlloy: next.buffer.alloy, bufferCrystal: next.buffer.crystal, bufferDeuterium: next.buffer.deuterium, planet });
      if (action.kind === 'watch') return reply({ slot: 0, targetPlanetId: SCHOOL_TARGET, cooldownUntil: null });
      if (action.kind === 'probe') return reply({ missionId: 'school-probe', arriveAt: new Date(next.flight!.arriveAt), flightMinutes: (next.flight!.arriveAt - now) / 60_000 });
      if (action.kind === 'mine') return reply({ runId: 'school-mine', arriveAt: new Date(next.flight!.arriveAt), homeAt: new Date(next.flight!.homeAt),
        flightMinutes: (next.flight!.arriveAt - now) / 60_000, capacity: PROSPECTOR.hold, pending: schoolPending(next, now),
        intercept: next.flight!.to, craft: 1, mining: schoolMining(next, now), planet });
      if (action.kind === 'raid') return reply({ missionId: 'school-raid', arriveAt: new Date(next.flight!.arriveAt), flightMinutes: (next.flight!.arriveAt - now) / 60_000,
        exposureMinutes: (next.flight!.homeAt - now) / 60_000, homeDefenceAfter: 0, planet, pending: schoolPending(next, now) });
      if (action.kind === 'order') {
        const current = Object.entries(w.buildings).find(([id]) => id === action.subject)?.[1]
          ?? Object.entries(w.instruments).find(([id]) => id === action.subject)?.[1] ?? 0;
        return reply({ type: action.subject, hull: action.subject, built: action.count, slot: 0,
          level: current + 1, ...next.resources, planet });
      }
      return reply({ planet });
    } catch (error) {
      const code = error instanceof z.ZodError || error instanceof SyntaxError ? 'BAD_REQUEST' : error instanceof Error ? error.message : 'ACADEMY_ACTION_REFUSED';
      return reply({ error: code, message: code }, 400);
    }
  };
}
