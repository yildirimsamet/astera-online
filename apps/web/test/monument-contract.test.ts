import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { monumentQuoteSchema, monumentsSchema, clanWarTargetResultSchema } from '../src/api/schemas.js';
import { keys } from '../src/api/keys.js';
import { readsForPrivateEvent } from '../src/session/shardEvents.js';

const id = '00000000-0000-4000-8000-000000000001';
const at = '2026-10-04T12:00:00.000Z';
const catalog = { serverNow: at, monuments: [{ id, ordinal: 1, position: { x: 6000, y: 0, z: 0 },
  controller: { kind: 'NEUTRAL' }, capacity: 7270, used: 0, reserved: 0, productionPerMinute: 60, emptySince: null }], waves: [], probes: [], probeReports: [] };
const quote = { fuel: 120, arriveAt: at, travelMinutes: 50, room: { used: 0, reserved: 0, total: 7270, after: 0 },
  bays: { used: 0, total: 3 }, shieldWouldDrop: true, outboundForecast: { doseHp: 500, destroyed: 0, fleet: { CITADEL: 2 },
    health: [{ hull: 'CITADEL', count: 2, maxHp: 2000, remainingHp: 1500, damageBp: 2500, remainderBp: 0 }] } };

describe('monument wire and mutation contract', () => {
  it('marks the clan monument target through the existing endpoint without a fake planet', async () => {
    const fetch: typeof globalThis.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ operation: null }), { status: 400 })));
    const api = new Api({ fetch });
    await expect(api.markClanWarMonumentTarget(id)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledWith('/api/clan/war/target', expect.objectContaining({ body: JSON.stringify({ targetMonumentId: id }) }));
  });
  it('parses public facts, exact owner health, physical cargo and both probe clocks', () => {
    const view = monumentsSchema.parse({ ...catalog, probeReports: [{ id, monumentId: id, fleet: { CITADEL: 3 }, accuracy: 1,
      observedAt: at, deliveredAt: at }], waves: [{ id, monumentId: id, playerId: id, originPlanetId: id, rootWaveId: null,
      jointOperationId: null, status: 'HOLD', purpose: 'ATTACK', heldAt: at, sentAt: at, arriveAt: null,
      position: { x: 6000, y: 0, z: 0 }, route: [], tech: { SHIP_ARMOR: 2 }, fleet: { CITADEL: 2 },
      lots: [{ id, hull: 'CITADEL', count: 2, damageBp: 2500, remainderBp: 0.125, maxHp: 2000, remainingHp: 1499.975, deuterium: 0, cargoCapacity: 0 }],
      deuterium: 0, productionPerMinute: 0, fillsAt: null, nextLossAt: at,
      returnForecast: { homePlanetId: id, arriveAt: at, minutes: 50, doseHp: 100, destroyed: 0, deuterium: 0, lostDeuterium: 0, lots: [] } }] });
    expect(view.serverNow).toBeInstanceOf(Date);
    expect(view.waves[0]?.lots[0]?.remainderBp).toBe(0.125);
    expect(view.probeReports[0]?.observedAt).toBeInstanceOf(Date);
    expect(view.probeReports[0]?.deliveredAt).toBeInstanceOf(Date);
  });

  it('preserves both consent fields and the same send key through the real client', async () => {
    let sentPath = '', sentKey = '', sentBody = '';
    const fetch: typeof globalThis.fetch = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      sentPath = typeof url === 'string' ? url : url instanceof URL ? url.pathname : url.url;
      sentKey = new Headers(init?.headers).get('idempotency-key') ?? '';
      sentBody = typeof init?.body === 'string' ? init.body : '';
      return Promise.resolve(new Response(JSON.stringify({ wave: { id, status: 'OUTBOUND', monumentId: id }, quote }), { status: 200 }));
    });
    const api = new Api({ fetch });
    const input = { originPlanetId: id, fleet: { CITADEL: 2 }, purpose: 'ATTACK' as const, acknowledgeShieldLoss: true, acknowledgeRadiationLoss: true };
    await api.sendMonument(id, input, 'same-monument-confirmation');
    expect(sentPath).toBe(`/api/monuments/${id}/send`);
    expect(sentKey).toBe('same-monument-confirmation');
    expect(sentBody).toBe(JSON.stringify(input));
    expect(monumentQuoteSchema.parse(quote).outboundForecast.health[0]?.remainingHp).toBe(1500);
  });

  it('maps a private monument transition to its own state and related player surfaces', () => {
    const reads = readsForPrivateEvent('private:monument');
    for (const key of [keys.monuments, keys.pending, keys.planet, keys.notifications, keys.reports]) expect(reads).toContainEqual(key);
  });

  it('reads the actual public controller name and native probe route without inventing fields', () => {
    const view = monumentsSchema.parse({ ...catalog, monuments: [{ ...catalog.monuments[0],
      controller: { kind: 'PLAYER', playerId: id, name: 'Captain' } }], probes: [{ id, monumentId: id,
      originPlanetId: id, status: 'RETURNING', departAt: at, arriveAt: at, homeAt: at,
      route: [{ from: { x: 6000, y: 0, z: 0 }, to: { x: 0, y: 0, z: 0 }, startMs: 1, endMs: 2 }] }] });
    expect(view.monuments[0]?.controller).toMatchObject({ kind: 'PLAYER', name: 'Captain' });
    expect(view.probes[0]?.homeAt).toBeInstanceOf(Date);
    expect(view.probes[0]?.route).toHaveLength(1);
  });

  it('rejects a monument target that smuggles a real planet identity into its discriminator', () => {
    expect(() => clanWarTargetResultSchema.parse({ operation: { id, status: 'COMPLETED', closeReason: 'MONUMENT', leaderPlayerId: id,
      target: { kind: 'MONUMENT', monumentId: id, playerId: id, planetId: id, username: '', planetName: 'Monument 1', position: { x: 6000, y: 0, z: 0 } },
      staging: { planetId: id, name: 'Home', position: { x: 0, y: 0, z: 0 } }, createdAt: at, expiresAt: at,
      startedAt: at, resolvedAt: at, completedAt: at, contributions: [], pool: { combatHulls: 0, waves: 0, participants: 0 } } })).toThrow();
  });

  it('parses a real monument target and terminal handoff in the existing clan contract', () => {
    const operation = clanWarTargetResultSchema.parse({ operation: { id, status: 'COMPLETED', closeReason: 'MONUMENT', leaderPlayerId: id,
      target: { kind: 'MONUMENT', monumentId: id, playerId: null, planetId: null, username: '', planetName: 'Monument 1', position: { x: 6000, y: 0, z: 0 } },
      staging: { planetId: id, name: 'Home', position: { x: 3000, y: 0, z: 0 } }, createdAt: at, expiresAt: at,
      startedAt: at, resolvedAt: at, completedAt: at, startShieldWouldDrop: null,
      contributions: [{ id, playerId: id, username: 'Captain', originPlanetId: id, originPlanetName: 'Home', sourceKind: 'LEADER_CAPITAL',
        status: 'TRANSFERRED', fleet: { CITADEL: 2 }, bulk: 0, fuelPaid: 120, sentAt: at, arrivesAt: null, mine: true, canRecall: false }],
      pool: { combatHulls: 0, waves: 0, participants: 0, strikeMinutes: null } } });
    expect(operation.operation.target.monumentId).toBe(id);
    expect(operation.operation.contributions[0]?.status).toBe('TRANSFERRED');
  });
});
