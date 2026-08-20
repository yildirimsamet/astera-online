import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prospectorHold, prospectorSpeed } from '@astera/rules';
import { planets, players } from '../db/schema.js';
import { GameError, orbitOf } from '../services/planet.js';
import {
  activeMiningRuns,
  launchHarvest,
  launchMining,
  visibleAsteroids,
  visibleDebris,
} from '../services/mining.js';
import { requireAuth } from './auth.js';

const launchBody = z.object({
  asteroidIndex: z.number().int().min(0),
  craft: z.number().int().min(1).max(500),
});

/**
 * MINING — the Drill's reason to exist. D19.
 *
 * The asteroid field is deliberately PUBLIC: rocks are physical objects on open
 * trajectories, everyone sees the same ones, and the race for them is the whole
 * decision. Nothing in this file is fog-bearing, which is why none of it needs the
 * careful per-caller filtering the intel routes do.
 */
export function registerMiningRoutes(app: FastifyInstance): void {
  const me = async (accountId: string) => {
    const rows = await app.db
      .select({ planetId: planets.id, seasonId: players.seasonId })
      .from(players)
      .innerJoin(planets, eq(planets.playerId, players.id))
      .where(eq(players.accountId, accountId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
    return row;
  };

  /**
   * What is crossing the disc right now, and what your craft could do about it.
   *
   * The rocks come with their full trajectory rather than a position, so the
   * client animates them from its own clock instead of polling — the same
   * arrangement that lets fleets move for zero bandwidth (A4, A5).
   */
  app.get('/api/mining', { preHandler: requireAuth }, async (req) => {
    const { planetId, seasonId } = await me(req.accountId!);
    const now = app.clock.now();

    const orbit = await orbitOf(app.db, planetId);

    const [field, runs] = await Promise.all([
      visibleAsteroids(app.db, seasonId, now),
      activeMiningRuns(app.db, planetId),
    ]);

    return {
      /** Whether the DERRICK is in orbit. D25 — a satellite you have or do not. */
      derrick: orbit.includes('DERRICK'),
      craftSpeed: prospectorSpeed(orbit),
      craftHold: prospectorHold(orbit),
      /** What a Derrick would make of them, so the interface can sell one. */
      derrickHold: prospectorHold(['DERRICK']),
      asteroids: field.map((a) => ({
        index: a.index,
        level: a.level,
        ore: a.ore,
        oreRemaining: Math.round(a.oreRemaining),
        crystalShare: Math.round(a.crystalShare * 100) / 100,
        radius: a.radius,
        period: a.period,
        phase: a.phase,
        y: a.y,
        speed: a.speed,
        appearsAt: a.appearsAt,
        expiresAt: a.expiresAt,
      })),
      /**
       * WRECK FIELDS ARE PUBLIC IN FULL. D32.
       *
       * Everyone sees every field, its size and its clock — that is the whole
       * mechanic: a private fight becomes a public, timed, contested second event,
       * and somebody who is not at war gets a reason to watch other people's.
       */
      debris: (await visibleDebris(app.db, seasonId, now)).map((d) => ({
        id: d.id,
        planetId: d.planetId,
        alloy: Math.round(d.alloy),
        crystal: Math.round(d.crystal),
        minutesLeft: Math.round(d.minutesLeft),
      })),
      runs: runs.map((r) => ({
        id: r.id,
        targetKind: r.targetKind,
        asteroidIndex: r.asteroidIndex,
        debrisFieldId: r.debrisFieldId,
        status: r.status,
        craft: r.craft,
        departAt: r.departAt,
        arriveAt: r.arriveAt,
        homeAt: r.homeAt,
        intercept: { x: r.interceptX, y: r.interceptY, z: r.interceptZ },
        // Only meaningful once it has turned for home; before that it is zero
        // because nothing has been claimed yet, not because the trip failed.
        minedAlloy: Math.round(r.minedAlloy),
        minedCrystal: Math.round(r.minedCrystal),
      })),
    };
  });

  /** Send craft to a wreck field. D32. */
  app.post('/api/mining/harvest', { preHandler: requireAuth }, async (req) => {
    const body = z
      .object({ fieldId: z.string().uuid(), craft: z.number().int().min(1).max(500) })
      .parse(req.body);
    const { planetId } = await me(req.accountId!);
    return launchHarvest(app.db, planetId, body.fieldId, body.craft, app.clock);
  });

  /** Send craft at a rock. Refused if it will be gone before they arrive. */
  app.post('/api/mining/launch', { preHandler: requireAuth }, async (req) => {
    const body = launchBody.parse(req.body);
    const { planetId } = await me(req.accountId!);
    return launchMining(app.db, planetId, body.asteroidIndex, body.craft, app.clock);
  });
}
