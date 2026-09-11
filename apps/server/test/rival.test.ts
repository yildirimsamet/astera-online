import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { rivalSetSchema, seasonSchema } from '../../web/src/api/schemas.js';
import { buildApp } from '../src/app.js';
import { eq } from 'drizzle-orm';
import {
  battleReports,
  missions,
  planets,
  probeReports,
  strategicImpacts,
} from '../src/db/schema.js';
import { TokenService } from '../src/auth/tokens.js';
import { RIVAL } from '@astera/rules';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });
const errorSchema = z.object({ error: z.string() });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('seasonal rival marker', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let auth: { authorization: string };

  beforeEach(async () => {
    f = await seedWorld(3);
    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    app = built.app;
    close = built.close;
    await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    auth = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` };
  });

  afterEach(async () => { await close(); });

  const set = (planetId: string | null) => app.inject({
    method: 'POST',
    url: '/api/rival',
    headers: auth,
    payload: { planetId },
  });

  const marks = (body: unknown) => rivalSetSchema.parse(body).rivals;

  const listed = async () => {
    const read = await app.inject({ method: 'GET', url: '/api/season', headers: auth });
    return seasonSchema.parse(read.json()).rivals;
  };

  /**
   * FIVE MARKS, AND EACH ONE KEEPS ITS OWN COLOUR. D183, owner instruction:
   * *"Rival 5 kişiye kadar olsun. Farklı renklerde olsun."*
   *
   * The SLOT is the load-bearing half. It is what the disc draws a colour from, so
   * it has to be stored rather than derived from a position in a list: a mark that
   * changed colour because an unrelated one was cleared would be a different
   * bookmark every time the list moved, which is the opposite of what a bookmark is.
   */
  it('keeps up to five marks, each in its own fixed slot', async () => {
    expect(await listed()).toEqual([]);

    const one = marks((await set(f.planetIds[1]!)).json());
    expect(one).toEqual([
      { planetId: f.planetIds[1], playerId: f.playerIds[1], slot: 0 },
    ]);

    const two = marks((await set(f.planetIds[2]!)).json());
    expect(two).toHaveLength(2);
    // The first mark is untouched, slot included: a second mark ADDS.
    expect(two).toContainEqual({ planetId: f.planetIds[1], playerId: f.playerIds[1], slot: 0 });
    expect(two).toContainEqual({ planetId: f.planetIds[2], playerId: f.playerIds[2], slot: 1 });
    expect(await listed()).toHaveLength(2);
  });

  /**
   * A SECOND PRESS CLEARS THAT ONE MARK — D103's rule, now with four others that
   * must not move. The freed SLOT is reused, because slots are colours and a
   * commander with two marks must never be shown colours one and four.
   */
  it('clears the mark that was pressed and leaves the rest where they are', async () => {
    await set(f.planetIds[1]!);
    await set(f.planetIds[2]!);

    const after = marks((await set(f.planetIds[1]!)).json());
    expect(after).toEqual([
      { planetId: f.planetIds[2], playerId: f.playerIds[2], slot: 1 },
    ]);

    // The freed colour is the one the next mark takes.
    expect(marks((await set(f.planetIds[1]!)).json()))
      .toContainEqual({ planetId: f.planetIds[1], playerId: f.playerIds[1], slot: 0 });
  });

  /**
   * ONE MARK PER COMMANDER, NOT PER WORLD. D97's reasoning, unchanged: the mark is
   * about a person, and a commander who holds four colonies would otherwise eat
   * four of the five slots. Pressing a second world of an already-marked commander
   * MOVES the mark's anchor rather than adding one.
   */
  it('marks a commander once, however many of their worlds are pressed', async () => {
    await set(f.planetIds[1]!);
    const again = marks((await set(f.planetIds[1]!)).json());
    expect(again).toEqual([]);
  });

  it('refuses a sixth mark rather than silently dropping the oldest', async () => {
    const galaxy = await seedWorld(RIVAL.max + 2);
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    const big = buildApp({ env: testEnv(), logger: silent, db: galaxy.db, clock: galaxy.clock });
    await big.app.ready();
    const header = {
      authorization: `Bearer ${await tokens.issueAccess(galaxy.accountIds[0]!)}`,
    };
    const mark = (planetId: string) => big.app.inject({
      method: 'POST', url: '/api/rival', headers: header, payload: { planetId },
    });

    for (let i = 1; i <= RIVAL.max; i += 1) {
      expect((await mark(galaxy.planetIds[i]!)).statusCode, `mark ${String(i)}`).toBe(200);
    }
    const sixth = await mark(galaxy.planetIds[RIVAL.max + 1]!);
    expect(sixth.statusCode).toBe(409);
    expect(errorSchema.parse(sixth.json()).error).toBe('RIVAL_LIMIT');
    await big.close();
  });

  /**
   * THE MARK IS A BOOKMARK, NOT A CONTRACT. Owner instruction, reversing D103.
   *
   * A Rival used to lock the moment the pair had shared anything — a probe, a
   * battle, a strike — so the surface the player used to say "watch this one"
   * became a surface that refused them. Players disliked it and it is not what
   * the mark is for: it is a memory aid on a disc of three hundred worlds, and the
   * commander is allowed to change their mind about who they are watching.
   *
   * The encounter history the old lock read is untouched — battles, strikes and
   * probes are still recorded, because reports and the recap are built on them.
   * Nothing reads them to REFUSE anything any more.
   */
  it('still moves after a Death Star has landed between the pair', async () => {
    await set(f.planetIds[1]!);
    const [mission] = await f.db.insert(missions).values({
      seasonId: f.seasonId,
      kind: 'death_star',
      status: 'resolved',
      ownerPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!,
      targetPlanetId: f.planetIds[1]!,
      fleet: {},
      distance: 10,
      departAt: f.clock.now(),
      arriveAt: f.clock.now(),
    }).returning();
    await f.db.insert(strategicImpacts).values({
      seasonId: f.seasonId,
      missionId: mission!.id,
      attackerPlayerId: f.playerIds[0]!,
      defenderPlayerId: f.playerIds[1]!,
      targetPlanetId: f.planetIds[1]!,
      outcome: 'FIRST_STRIKE',
      damage: 500,
      destroyedFleet: {},
      createdAt: f.clock.now(),
    });

    expect(marks((await set(f.planetIds[2]!)).json()))
      .toContainEqual({ planetId: f.planetIds[2], playerId: f.playerIds[2], slot: 1 });
    expect(marks((await set(f.planetIds[2]!)).json()))
      .not.toContainEqual(expect.objectContaining({ planetId: f.planetIds[2] }));
  });

  /**
   * A MARK IS CLEARED WITHOUT ASKING WHETHER ITS WORLD SURVIVED. D183.
   *
   * A marked world can be reclaimed or wiped, and the mark then pointed at nothing
   * the commander could press twice — the only way out was the menu's "clear the
   * lost marker", which sent `null` and took the other four with it. Removing a
   * mark by the planet it was placed on is checked before the world is looked up,
   * so a dead anchor is exactly as easy to clear as a live one.
   */
  it('clears a mark whose world has left the galaxy, and keeps the rest', async () => {
    await set(f.planetIds[1]!);
    await set(f.planetIds[2]!);
    // The world is gone as far as the galaxy is concerned: no controller at all.
    await f.db.update(planets)
      .set({ controllerPlayerId: null, kind: 'NEUTRAL' })
      .where(eq(planets.id, f.planetIds[1]!));

    expect(marks((await set(f.planetIds[1]!)).json())).toEqual([
      { planetId: f.planetIds[2], playerId: f.playerIds[2], slot: 1 },
    ]);
  });

  /** `null` still clears the whole set — the one gesture that empties the disc. */
  it('clears every mark when the body names no world', async () => {
    await set(f.planetIds[1]!);
    await set(f.planetIds[2]!);
    expect(marks((await set(null)).json())).toEqual([]);
    expect(await listed()).toEqual([]);
  });

  it('still moves after a battle and after a probe reading', async () => {
    await set(f.planetIds[1]!);
    const [battle] = await f.db.insert(missions).values({
      seasonId: f.seasonId,
      kind: 'attack',
      status: 'resolved',
      ownerPlayerId: f.playerIds[1]!,
      originPlanetId: f.planetIds[1]!,
      targetPlanetId: f.planetIds[0]!,
      fleet: { DART: 1 },
      distance: 10,
      departAt: f.clock.now(),
      arriveAt: f.clock.now(),
    }).returning();
    await f.db.insert(battleReports).values({
      seasonId: f.seasonId,
      missionId: battle!.id,
      attackerPlayerId: f.playerIds[1]!,
      defenderPlayerId: f.playerIds[0]!,
      targetPlanetId: f.planetIds[0]!,
      targetKind: 'PLAYER',
      grade: 'REPELLED',
      rounds: [],
      loot: { alloy: 0, crystal: 0, deuterium: 0 },
      attackerLosses: { DART: 1 },
      defenderLosses: {},
      createdAt: f.clock.now(),
    });
    const [scout] = await f.db.insert(missions).values({
      seasonId: f.seasonId,
      kind: 'probe',
      status: 'in_flight',
      ownerPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!,
      targetPlanetId: f.planetIds[1]!,
      fleet: {},
      distance: 10,
      departAt: f.clock.now(),
      arriveAt: f.clock.now(),
    }).returning();
    await f.db.insert(probeReports).values({
      observerPlayerId: f.playerIds[0]!,
      targetPlanetId: f.planetIds[1]!,
      missionId: scout!.id,
      accuracy: 0.5,
      stock: { low: 0, high: 0 },
      defence: { low: 0, high: 0 },
      fleetSize: { low: 0, high: 0 },
      fleetHome: true,
      detected: false,
      createdAt: f.clock.now(),
    });

    expect((await set(f.planetIds[2]!)).statusCode).toBe(200);
    expect((await set(null)).statusCode).toBe(200);
  });

  it('refuses self and a planet outside the caller’s current galaxy', async () => {
    const self = await set(f.planetIds[0]!);
    expect(self.statusCode).toBe(400);
    expect(errorSchema.parse(self.json()).error).toBe('RIVAL_SELF');
    const foreign = await set(randomUUID());
    expect(foreign.statusCode).toBe(404);
    expect(errorSchema.parse(foreign.json()).error).toBe('RIVAL_NOT_VISIBLE');
  });

  it('requires authentication and rejects extra client-authored state', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/rival', payload: { planetId: null } })).statusCode).toBe(401);
    expect((await app.inject({
      method: 'POST', url: '/api/rival', headers: auth,
      payload: { planetId: f.planetIds[1], bonus: 2 },
    })).statusCode).toBe(400);
  });
});
