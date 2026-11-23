import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { z } from 'zod';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NEWCOMER_SCENARIO } from '@astera/rules';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { FixedClock } from '../src/clock.js';
import {
  accounts,
  battleReports,
  newcomerScenario,
  personalRocks,
  pirateRaids,
  players,
  units,
  unknownSignalState,
} from '../src/db/schema.js';
import { transferCommander } from '../src/services/commanderTransfer.js';
import { launchProbe } from '../src/services/intel.js';
import { launchMining } from '../src/services/mining.js';
import { launchPirateRaid } from '../src/services/pirateRaid.js';
import { joinSeason } from '../src/services/player.js';
import { createSeason } from '../src/services/season.js';
import { ensureWaitingSeason } from '../src/services/waitingServers.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveUnits, makeAccount, testDb, testEnv, truncateAll } from './helpers.js';

const START = new Date('2026-11-20T09:00:00.000Z');

const scenarioResponse = z.object({
  scenario: z.object({
    step: z.enum(['LANDING', 'MINE', 'PIRATE', 'PROBE', 'WRAP_UP', 'DONE', 'DISMISSED']),
    pirateDefeated: z.boolean(),
  }).nullable(),
});

const asteroidList = z.object({
  asteroids: z.array(z.object({ id: z.string(), personal: z.boolean().optional() })),
});

const pirateList = z.object({
  pirates: z.array(z.object({
    id: z.string(),
    level: z.number(),
    fleet: z.record(z.string(), z.number()),
    hoard: z.object({ alloy: z.number(), crystal: z.number(), deuterium: z.number() }),
  })),
});

const trafficResponse = z.object({
  contacts: z.array(z.object({ id: z.string(), kind: z.string() })),
});

afterAll(async () => { await (await testDb()).close(); });

describe('newcomer authentic onboarding scenario (plan 2026-11-20 §5.3 + playtest 2026-11-23)', () => {
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let clock: FixedClock;

  beforeEach(async () => {
    const { db } = await testDb();
    await truncateAll(db);
    clock = new FixedClock(new Date(START.getTime() + 5 * 60_000));
    const built = buildApp({ db, clock, logger: pino({ level: 'silent' }), env: testEnv() });
    app = built.app; close = built.close; await app.ready();
  });
  afterEach(async () => { await close(); });

  async function season(code: string) {
    const { db } = await testDb();
    return (await createSeason(db, { shardCode: code, seed: 2026, startsAt: START, playerCap: 20 })).season;
  }

  async function landed(name: string, opts: { firstGame: boolean; guideOff?: boolean }, seasonId: string) {
    const { db } = await testDb();
    const account = await makeAccount(db, name);
    await db.update(accounts).set({
      firstGameShieldAvailable: opts.firstGame,
      firstSeasonStartedAt: opts.firstGame ? null : START,
      starterGuideOffAt: opts.guideOff ? clock.now() : null,
    }).where(eq(accounts.id, account.id));
    const joined = await joinSeason(db, account.id, seasonId, clock);
    const [player] = await db.select().from(players).where(eq(players.accountId, account.id));
    const authorization = `Bearer ${await app.tokens.issueAccess(account.id)}`;
    const getScenario = async () => scenarioResponse.parse((await app.inject({
      method: 'GET', url: '/api/newcomer-scenario', headers: { authorization },
    })).json()).scenario;
    return { planetId: joined.planetId, playerId: player!.id, accountId: account.id, authorization, getScenario };
  }

  const worker = async () => new EventWorker(
    (await testDb()).db, clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }),
  ).tick();

  it('starts at LANDING for a first game and defers the first regular unknown signal; skips returning or guide-off accounts', async () => {
    const { db } = await testDb();
    const s = await season('EU-SCEN-A');
    const first = await landed('FreshOne', { firstGame: true }, s.id);
    const returning = await landed('Veteran', { firstGame: false }, s.id);
    const guideOff = await landed('NoGuide', { firstGame: true, guideOff: true }, s.id);

    expect((await first.getScenario())?.step).toBe('LANDING');
    expect(await returning.getScenario()).toBeNull();
    expect(await guideOff.getScenario()).toBeNull();

    // Starting capital building/instrument tiers are pre-claimed on landing so claimable is 0
    const rewardsRes = await app.inject({
      method: 'GET',
      url: `/api/rewards?planetId=${first.planetId}`,
      headers: { authorization: first.authorization },
    });
    expect(rewardsRes.statusCode).toBe(200);
    expect(z.object({ claimable: z.number() }).parse(rewardsRes.json()).claimable).toBe(0);

    const [firstSig] = await db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, first.playerId));
    const [returningSig] = await db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, returning.playerId));
    const [guideOffSig] = await db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, guideOff.playerId));
    expect(firstSig).toBeUndefined();
    expect(returningSig?.nextAt).toBeTruthy();
    expect(guideOffSig?.nextAt).toBeTruthy();
  });

  it('runs the full authentic arc: mine -> personal pirate visible only to owner -> real pirate raid with 0 losses -> real planet probe -> complete', async () => {
    const { db } = await testDb();
    const s = await season('EU-SCEN-B');
    const p = await landed('Commander', { firstGame: true }, s.id);
    const other = await landed('Neighbour', { firstGame: false }, s.id);

    // 1. LANDING -> MINE
    const started = await app.inject({ method: 'POST', url: '/api/newcomer-scenario/start', headers: { authorization: p.authorization }, payload: {} });
    expect(started.statusCode).toBe(200);
    expect(scenarioResponse.parse(started.json()).scenario?.step).toBe('MINE');

    // Before mining, personal pirate has not spawned yet
    const [beforeRow] = await db.select().from(newcomerScenario).where(eq(newcomerScenario.playerId, p.playerId));
    expect(beforeRow?.pirateSpec).toBeNull();
    expect(beforeRow!.pirateIndex).toBeLessThan(0);

    // 2. Real mining launch advances MINE -> PIRATE and spawns the personal pirate
    const rocks = asteroidList.parse((await app.inject({
      method: 'GET', url: '/api/mining', headers: { authorization: p.authorization },
    })).json()).asteroids;
    const personal = rocks.find((r) => r.personal === true);
    expect(personal).toBeDefined();
    await launchMining(db, p.planetId, personal!.id, 1, clock, p.playerId);
    expect((await p.getScenario())?.step).toBe('PIRATE');

    // 3. Personal pirate appears in owner's /api/pirates and /api/galaxy/traffic, and NEVER in another player's
    const ownPirates = pirateList.parse((await app.inject({
      method: 'GET', url: '/api/pirates', headers: { authorization: p.authorization },
    })).json()).pirates;
    expect(ownPirates.length).toBeGreaterThanOrEqual(1);
    const personalPirate = ownPirates.find((pir) => pir.hoard.alloy === 300 && pir.hoard.crystal === 150 && pir.fleet.DART === 2);
    expect(personalPirate).toBeDefined();

    const ownTraffic = trafficResponse.parse((await app.inject({
      method: 'GET', url: '/api/galaxy/traffic', headers: { authorization: p.authorization },
    })).json()).contacts;
    expect(ownTraffic.some((c) => c.id === personalPirate!.id && c.kind === 'pirate')).toBe(true);

    const otherPirates = pirateList.parse((await app.inject({
      method: 'GET', url: '/api/pirates', headers: { authorization: other.authorization },
    })).json()).pirates;
    expect(otherPirates.some((pir) => pir.id === personalPirate!.id)).toBe(false);

    const otherTraffic = trafficResponse.parse((await app.inject({
      method: 'GET', url: '/api/galaxy/traffic', headers: { authorization: other.authorization },
    })).json()).contacts;
    expect(otherTraffic.some((c) => c.id === personalPirate!.id)).toBe(false);

    // Another player cannot raid this commander's personal pirate
    await giveUnits(db, other.planetId, { DART: 1 });
    await expect(launchPirateRaid(db, other.planetId, personalPirate!.id, { DART: 1 }, clock, other.playerId))
      .rejects.toThrow(/No such pirate/u);

    // 4. Owner launches a REAL pirate raid with starter fleet (3 DART + 1 WARDEN)
    const raid = await launchPirateRaid(db, p.planetId, personalPirate!.id, { DART: 3, WARDEN: 1 }, clock, p.playerId);
    expect(raid.pirateId).toBe(personalPirate!.id);
    // Outbound flight for newbie personal pirate is ~30-45 seconds
    const outboundSec = raid.flightMinutes * 60;
    expect(outboundSec).toBeGreaterThanOrEqual(30);
    expect(outboundSec).toBeLessThanOrEqual(45);

    // Resolve arrival via real worker
    clock.set(new Date(raid.arriveAt.getTime() + 60_000));
    await worker();

    // Real battle report exists, DECISIVE, ZERO player losses and ZERO ship damage
    const reports = await db.select().from(battleReports).where(eq(battleReports.pirateRaidId, raid.raidId));
    expect(reports).toHaveLength(1);
    expect(reports[0]!.grade).toBe('DECISIVE');
    expect(reports[0]!.attackerLosses).toEqual({});
    expect(reports[0]!.attackerDamage).toEqual([]);
    expect((reports[0]!.loot.alloy + reports[0]!.loot.crystal)).toBeGreaterThan(0);

    // Scenario automatically advances PIRATE -> PROBE and marks pirateDefeated = true
    const afterVictory = await p.getScenario();
    expect(afterVictory?.step).toBe('PROBE');
    expect(afterVictory?.pirateDefeated).toBe(true);

    // Resolve return leg: all 3 DART + 1 WARDEN return home intact
    const [raidRow] = await db.select().from(pirateRaids).where(eq(pirateRaids.id, raid.raidId));
    expect(raidRow?.homeAt).toBeTruthy();
    clock.set(new Date(raidRow!.homeAt!.getTime() + 5_000));
    await worker();
    const homeUnits = await db.select().from(units).where(and(eq(units.planetId, p.planetId), eq(units.location, 'home')));
    expect(homeUnits.find((u) => u.hull === 'DART')?.count).toBe(3);
    expect(homeUnits.find((u) => u.hull === 'WARDEN')?.count).toBe(1);

    // 5. Real probe sent to another planet advances PROBE -> WRAP_UP
    await launchProbe(db, p.planetId, other.planetId, clock, p.playerId);
    expect((await p.getScenario())?.step).toBe('WRAP_UP');

    // 6. Complete moves WRAP_UP -> DONE and schedules the first regular unknown signal in 1-2 minutes
    const completedAt = clock.now();
    const done = await app.inject({ method: 'POST', url: '/api/newcomer-scenario/complete', headers: { authorization: p.authorization }, payload: {} });
    expect(done.statusCode).toBe(200);
    expect(scenarioResponse.parse(done.json()).scenario?.step).toBe('DONE');

    const [sig] = await db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, p.playerId));
    expect(sig?.nextAt).toBeTruthy();
    const gapMin = (sig!.nextAt!.getTime() - completedAt.getTime()) / 60_000;
    expect(gapMin).toBeGreaterThanOrEqual(NEWCOMER_SCENARIO.postScenarioSignalGapMinutes[0] - 0.01);
    expect(gapMin).toBeLessThanOrEqual(NEWCOMER_SCENARIO.postScenarioSignalGapMinutes[1] + 0.01);
  });

  it('dismisses cleanly, hides the personal pirate, and releases unknown signals', async () => {
    const { db } = await testDb();
    const s = await season('EU-SCEN-C');
    const p = await landed('Skipper', { firstGame: true }, s.id);
    await app.inject({ method: 'POST', url: '/api/newcomer-scenario/start', headers: { authorization: p.authorization }, payload: {} });
    const rocks = asteroidList.parse((await app.inject({
      method: 'GET', url: '/api/mining', headers: { authorization: p.authorization },
    })).json()).asteroids;
    await launchMining(db, p.planetId, rocks.find((r) => r.personal === true)!.id, 1, clock, p.playerId);
    expect((await p.getScenario())?.step).toBe('PIRATE');

    const res = await app.inject({ method: 'POST', url: '/api/newcomer-scenario/dismiss', headers: { authorization: p.authorization }, payload: {} });
    expect(res.statusCode).toBe(200);
    expect(scenarioResponse.parse(res.json()).scenario?.step).toBe('DISMISSED');

    // Personal pirate is no longer returned in /api/pirates
    const ownPirates = pirateList.parse((await app.inject({
      method: 'GET', url: '/api/pirates', headers: { authorization: p.authorization },
    })).json()).pirates;
    expect(ownPirates.some((pir) => pir.hoard.alloy === 300 && pir.hoard.crystal === 150 && pir.fleet.DART === 2)).toBe(false);

    const [sig] = await db.select().from(unknownSignalState).where(eq(unknownSignalState.playerId, p.playerId));
    expect(sig?.nextAt).toBeTruthy();
  });

  it('turning off starter-guide via PUT /api/auth/me/starter-guide also dismisses an active scenario', async () => {
    const s = await season('EU-SCEN-D');
    const p = await landed('GuideOffLater', { firstGame: true }, s.id);
    expect((await p.getScenario())?.step).toBe('LANDING');

    const off = await app.inject({
      method: 'PUT', url: '/api/auth/me/starter-guide',
      headers: { authorization: p.authorization },
      payload: { off: true },
    });
    expect(off.statusCode).toBe(200);
    expect((await p.getScenario())?.step).toBe('DISMISSED');
  });

  // Review 2026-11-23: a scenario left half-done must not hold the screen for days, nor ask for a pirate that is gone.
  it('holds the screen for the founding hour only, and its pirate waits for the commander until beaten', async () => {
    const { db } = await testDb();
    const s = await season('EU-SCEN-F');
    const landedAt = clock.now();
    const p = await landed('Slowpoke', { firstGame: true }, s.id);
    const view = z.object({ scenario: z.object({ holdsScreenUntil: z.coerce.date() }) }).parse((await app.inject({
      method: 'GET', url: '/api/newcomer-scenario', headers: { authorization: p.authorization },
    })).json());
    expect(view.scenario.holdsScreenUntil.getTime()).toBe(landedAt.getTime() + 60 * 60_000);

    await app.inject({ method: 'POST', url: '/api/newcomer-scenario/start', headers: { authorization: p.authorization }, payload: {} });
    const rocks = asteroidList.parse((await app.inject({
      method: 'GET', url: '/api/mining', headers: { authorization: p.authorization },
    })).json()).asteroids;
    await launchMining(db, p.planetId, rocks.find((r) => r.personal === true)!.id, 1, clock, p.playerId);

    clock.set(new Date(clock.now().getTime() + 2 * 24 * 60 * 60_000));
    const pirates = pirateList.parse((await app.inject({
      method: 'GET', url: '/api/pirates', headers: { authorization: p.authorization },
    })).json()).pirates;
    const own = pirates.find((pir) => pir.hoard.alloy === 300 && pir.hoard.crystal === 150 && pir.fleet.DART === 2);
    expect(own).toBeDefined();

    // A hold with no gun cannot beat a crew: the zero-loss rule needs a warship in the wing.
    await expect(launchPirateRaid(db, p.planetId, own!.id, { COURIER: 1 }, clock, p.playerId))
      .rejects.toMatchObject({ code: 'NEEDS_WARSHIP' });
  });

  it('commander transfer retires personal rocks and dismisses an active scenario', async () => {
    const { db } = await testDb();
    const s = await season('EU-SCEN-E');
    const waiting = await ensureWaitingSeason(db, s.id, clock);
    expect(waiting).toBeTruthy();
    const p = await landed('Mover', { firstGame: true }, s.id);
    await app.inject({ method: 'POST', url: '/api/newcomer-scenario/start', headers: { authorization: p.authorization }, payload: {} });

    const moved = await transferCommander(db, p.playerId, waiting!.id, clock, undefined, { ownerRequested: true });
    expect(moved.status).toBe('MOVED');

    expect(await db.select().from(personalRocks).where(eq(personalRocks.playerId, p.playerId))).toHaveLength(0);
    const [row] = await db.select().from(newcomerScenario).where(eq(newcomerScenario.playerId, p.playerId));
    expect(row?.step).toBe('DISMISSED');
  });
});
