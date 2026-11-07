import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { brandRecallSchema, collectSchema, buildCancelSchema, piratesSchema, skinCollectionSchema, unknownSignalsSchema, planetSchema, planetsSchema, seasonSchema } from '../src/api/schemas.js';
import { legacyRevealsSchema } from '../src/api/legacySchemas.js';
import { starterFetch } from '../src/starter/transport.js';
import { wireVessel } from './starterVesselFixture.js';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function harness(on = true, answer: (url: string, init?: RequestInit) => Response = () => json({ vessel: wireVessel() })) {
  const base = vi.fn((input: RequestInfo | URL, init?: RequestInit) => Promise.resolve(answer((typeof input === 'string' ? input : input instanceof URL ? input.href : input.url), init)));
  return { base, fetch: starterFetch(base, () => on) };
}

const withWorld = z.object({ planet: planetSchema });

const seasonBody = {
  seasonId: 'galaxy-1', shard: 'EU-1', shardName: 'Vantage', seed: 7, status: 'live',
  startsAt: '2026-11-01T00:00:00.000Z', endsAt: '2027-11-01T00:00:00.000Z', playerCap: 300, players: 2,
  rulesetVersion: 18, rivals: [], result: null, shieldUntil: null, shieldKind: null,
};

describe('the starter transport', () => {
  describe('with no ship', () => {
    it.each(['/api/planet', '/api/clan/create', '/api/season'])('leaves %s entirely alone', async (path) => {
      const { base, fetch } = harness(false, () => json({ ok: true }));
      const init = { method: 'POST', headers: { authorization: 'Bearer t' } };
      const response = await fetch(path, init);
      expect(base).toHaveBeenCalledWith(path, init);
      expect(await response.json()).toEqual({ ok: true });
    });
  });

  describe('the account paths', () => {
    it.each([
      '/api/auth/me', '/api/auth/refresh', '/api/onboarding/claim', '/api/announcements', '/api/announcements/read',
      '/api/feedback', '/api/maintenance', '/api/community/policy', '/api/push/devices', '/api/stream', '/api/stream?trafficWake=1',
      '/api/starter/vessel', '/api/starter/repair', '/api/starter/enlist',
    ])('%s goes straight through', async (path) => {
      const { base, fetch } = harness(true, () => json({ ok: true }));
      await fetch(path, { method: 'GET' });
      expect(base).toHaveBeenCalledWith(path, { method: 'GET' });
    });
  });

  describe('closed by default', () => {
    it.each([
      ['POST', '/api/clan/create'], ['GET', '/api/clan/me'], ['POST', '/api/planet/upgrade'], ['GET', '/api/skins/shop'],
      ['POST', '/api/death-star/launch'], ['POST', '/api/intel/rival'], ['GET', '/api/some/path/nobody/knows/yet'],
      ['POST', '/api/planets/ship-1/upgrade'], ['GET', '/api/servers'], ['POST', '/api/planets/ship-1/abandon'],
    ])('%s %s never reaches the network', async (method, path) => {
      const { base, fetch } = harness();
      const response = await fetch(path, { method });
      expect(base).not.toHaveBeenCalled();
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ error: 'STARTER_CLOSED' });
    });
  });

  describe('the deck aboard', () => {
    const answered = (extra: object) => (url: string) => json(url.includes('/api/starter/') ? { ...extra, vessel: wireVessel() } : { ok: true });

    it.each([
      ['/api/planet/build', '/api/starter/build', { hull: 'DART', built: 1, alloy: 1, crystal: 1 }],
      ['/api/planets/ship-1/build', '/api/starter/build', { hull: 'DART', built: 1, alloy: 1, crystal: 1 }],
      ['/api/planet/research', '/api/starter/research', { projectId: 'SHIP_POWER' }],
      ['/api/planets/ship-1/research', '/api/starter/research', { projectId: 'SHIP_POWER' }],
      ['/api/planets/ship-1/repairs', '/api/starter/dock', { orderId: 'o' }],
      ['/api/fleet/launch', '/api/starter/fleet/launch', { missionId: 'm', arriveAt: '2026-11-01T00:00:00.000Z', exposureMinutes: 1, homeDefenceAfter: 0, pending: [] }],
    ])('%s goes to the ship and comes back with a world', async (from, to, body) => {
      const { base, fetch } = harness(true, answered(body));
      const init = { method: 'POST', body: '{}' };
      const response = await fetch(from, init);
      expect(base).toHaveBeenCalledWith(to, init);
      expect(withWorld.parse(await response.json()).planet.planet.id).toBe('ship-1');
    });

    it('asks the galaxy for a recall', async () => {
      const { base, fetch } = harness(true, () => json({ missionId: 'm', arriveAt: '2026-11-01T00:00:00.000Z' }));
      await fetch('/api/fleet/m-1/recall', { method: 'POST' });
      expect(base).toHaveBeenCalledWith('/api/starter/fleet/m-1/recall', { method: 'POST' });
    });

    it.each([
      ['/api/reports?limit=50', '/api/starter/reports'],
      ['/api/mining', '/api/starter/mining'],
      ['/api/mining?planetId=ship-1', '/api/starter/mining'],
      ['/api/mining/field', '/api/starter/mining'],
      ['/api/mining/status?planetId=ship-1', '/api/starter/mining'],
      ['/api/reports/BATTLE/r-1/replay', '/api/starter/reports/BATTLE/r-1/replay'],
    ])('reads %s from the ship', async (from, to) => {
      const { base, fetch } = harness(true, () => json({ ok: true }));
      await fetch(from);
      expect(base).toHaveBeenCalledWith(to, undefined);
    });

    it.each([
      ['/api/mining/launch', '/api/starter/mining/launch'],
      ['/api/mining/harvest', '/api/starter/mining/harvest'],
      ['/api/mining/runs/r-1/recall', '/api/starter/mining/runs/r-1/recall'],
    ])('%s comes back with a world too', async (from, to) => {
      const { base, fetch } = harness(true, answered({ runId: 'r', craft: 1, arriveAt: '2026-11-01T00:00:00.000Z', flightMinutes: 1, intercept: { x: 0, y: 0, z: 0 }, capacity: 1, homeAt: '2026-11-01T00:00:00.000Z', mining: {}, pending: [] }));
      const response = await fetch(from, { method: 'POST' });
      expect(base).toHaveBeenCalledWith(to, { method: 'POST' });
      expect(withWorld.parse(await response.json()).planet.planet.id).toBe('ship-1');
    });
  });

  describe('the eyes aboard', () => {
    it.each([
      ['/api/intel', '/api/starter/intel'],
      ['/api/galaxy/traffic', '/api/starter/traffic'],
      ['/api/session/pending', '/api/starter/pending'],
      ['/api/notifications?limit=30', '/api/starter/notifications'],
    ])('reads %s from the galaxy it is in', async (from, to) => {
      const { base, fetch } = harness(true, () => json({ ok: true }));
      await fetch(from);
      expect(base).toHaveBeenCalledWith(to, undefined);
    });

    it.each([
      ['/api/intel/probe', '/api/starter/probe'],
      ['/api/intel/watch', '/api/starter/watch'],
      ['/api/notifications/seen', '/api/starter/notifications/seen'],
    ])('sends %s to the ship', async (from, to) => {
      const { base, fetch } = harness(true, () => json({ ok: true }));
      const init = { method: 'POST', body: '{"targetPlanetId":"x"}' };
      await fetch(from, init);
      expect(base).toHaveBeenCalledWith(to, init);
    });
  });

  describe('the ship in place of the planet', () => {
    it('answers /api/planet from the ship, in the planet schema', async () => {
      const { base, fetch } = harness();
      const response = await fetch('/api/planet', { headers: { authorization: 'Bearer t' } });
      expect(base).toHaveBeenCalledWith('/api/starter/vessel', { headers: { authorization: 'Bearer t' } });
      expect(planetSchema.parse(await response.json()).planet.id).toBe('ship-1');
    });

    it('answers a world by id the same way', async () => {
      const { fetch } = harness();
      expect(planetSchema.parse(await (await fetch('/api/planets/ship-1')).json()).planet.id).toBe('ship-1');
    });

    it('lists the one ship as every world this commander has', async () => {
      const { fetch } = harness();
      const body = planetsSchema.parse(await (await fetch('/api/planets')).json());
      expect(body).toMatchObject({ playerId: 'ship-1', seasonId: 'galaxy-1', capitalPlanetId: 'ship-1' });
      expect(body.planets.map(world => world.planet.id)).toEqual(['ship-1']);
    });

    it('keeps the origin a native build sends everything to', async () => {
      const { base, fetch } = harness();
      await fetch('https://play.example/api/planet');
      expect(base).toHaveBeenCalledWith('https://play.example/api/starter/vessel', undefined);
    });

    it('keeps the headers the client reads off every answer, such as the server clock', async () => {
      const { fetch } = harness(true, () => new Response(JSON.stringify({ vessel: wireVessel() }), {
        status: 200, headers: { 'content-type': 'application/json', 'x-server-time': '123', 'content-length': '5' },
      }));
      const response = await fetch('/api/planet');
      expect(response.headers.get('x-server-time')).toBe('123');
      expect(response.headers.get('content-length')).toBeNull();
    });

    it('hands a refusal back as it came, not dressed as a ship', async () => {
      const { fetch } = harness(true, () => json({ error: 'VESSEL_NOT_FOUND', message: 'no ship' }, 404));
      const response = await fetch('/api/planet');
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ error: 'VESSEL_NOT_FOUND' });
    });
  });

  describe('renamed reads', () => {
    it('reads the season from this galaxy', async () => {
      const { base, fetch } = harness(true, () => json(seasonBody));
      const body = seasonSchema.parse(await (await fetch('/api/season')).json());
      expect(base).toHaveBeenCalledWith('/api/starter/season', undefined);
      expect(body.seasonId).toBe('galaxy-1');
    });

    it('reads the map from this galaxy', async () => {
      const { base, fetch } = harness(true, () => json({ you: { planetId: 'ship-1', playerId: 'ship-1' }, planets: [] }));
      await fetch('/api/galaxy');
      expect(base).toHaveBeenCalledWith('/api/starter/galaxy', undefined);
    });
  });

  describe('writes the top bar can reach', () => {
    it('collects at the ship and answers in the main shape', async () => {
      const moved = { alloy: 10, crystal: 0, deuterium: 0 };
      const blocked = { alloy: 0, crystal: 0, deuterium: 0 };
      const { base, fetch } = harness(true, () => json({ vessel: wireVessel({ alloy: 660 }), moved, blocked }));
      const body = collectSchema.parse(await (await fetch('/api/planet/collect', { method: 'POST' })).json());
      expect(base).toHaveBeenCalledWith('/api/starter/collect', { method: 'POST' });
      expect(body).toMatchObject({ moved, blocked, alloy: 660, bufferAlloy: 12.5 });
      expect(body.planet.planet.alloy).toBe(660);
    });

    it('collects by world id too', async () => {
      const { base, fetch } = harness(true, () => json({ vessel: wireVessel(), moved: { alloy: 0, crystal: 0, deuterium: 0 }, blocked: { alloy: 0, crystal: 0, deuterium: 0 } }));
      await fetch('/api/planets/ship-1/collect', { method: 'POST' });
      expect(base).toHaveBeenCalledWith('/api/starter/collect', { method: 'POST' });
    });

    it('cancels at the ship and answers in the main shape', async () => {
      const refund = { alloy: 22, crystal: 16, deuterium: 0 };
      const { base, fetch } = harness(true, () => json({ vessel: wireVessel(), refund }));
      const body = buildCancelSchema.parse(await (await fetch('/api/planets/ship-1/build-orders/order-9/cancel', { method: 'POST' })).json());
      expect(base).toHaveBeenCalledWith('/api/starter/orders/order-9/cancel', { method: 'POST' });
      expect(body).toMatchObject({ orderId: 'order-9', refund });
    });

    it('cancels through the short path as well', async () => {
      const { base, fetch } = harness(true, () => json({ vessel: wireVessel(), refund: { alloy: 0, crystal: 0, deuterium: 0 } }));
      await fetch('/api/planet/build-orders/order-9/cancel', { method: 'POST' });
      expect(base).toHaveBeenCalledWith('/api/starter/orders/order-9/cancel', { method: 'POST' });
    });

    it('does not take a read of a write path for the write', async () => {
      const { base, fetch } = harness();
      expect((await fetch('/api/planet/collect')).status).toBe(404);
      expect(base).not.toHaveBeenCalled();
    });
  });

  describe('the reads the galaxy screen opens with, empty until their system exists', () => {
    it.each([
      ['/api/pirates?originPlanetId=ship-1', piratesSchema],
      ['/api/unknown-signals', unknownSignalsSchema],
      ['/api/skins', skinCollectionSchema],
      ['/api/session/brand-recall', brandRecallSchema],
      ['/api/legacy/me/reveals', legacyRevealsSchema],
    ])('%s parses in its real schema, without touching the network', async (path, schema) => {
      const { base, fetch } = harness();
      const response = await fetch(path);
      expect(base).not.toHaveBeenCalled();
      expect(schema.safeParse(await response.json()).success).toBe(true);
    });
  });
});

describe('the universe, from a ship', () => {
  it('reads the same address as a commander, never a closed door', async () => {
    const { fetch, base } = harness(true, () => json({ galaxies: [], mine: 1 }));
    await fetch('/api/universe');
    expect(base).toHaveBeenCalledTimes(1);
  });
});
