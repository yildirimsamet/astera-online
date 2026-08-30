import { and, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildings, miningRuns, planets, players, playerResearch, satellites, seasons } from '../db/schema.js';
import { GameError, orbitFromRows } from '../services/planet.js';
import { techOf } from '../services/researchState.js';
import {
  launchHarvest,
  launchMining,
  projectIsotopeKnowledge,
  projectPrivateMiningView,
  projectVisibleDebris,
} from '../services/mining.js';
import { projectPlayerAsteroidField } from '../services/asteroidField.js';
import { sensorHistoryForPlayer } from '../services/sensorHistory.js';
import { requireAuth } from './auth.js';
import { ownedPlanet } from '../services/ownership.js';
import type { Queryable } from '../db/client.js';

const launchBody = z.object({
  originPlanetId: z.string().uuid().optional(),
  asteroidId: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
  craft: z.number().int().min(1).max(500),
}).strict();

/**
 * MINING — the Drill's reason to exist. D19.
 *
 * Asteroid existence is earned through the commander's durable sensor history;
 * only then does the rock become a public race for that commander. The underlying
 * ore/wreck snapshot is shared, but `/field` applies caller fog and opaque ids on
 * every read. Hardware, research and own runs stay on `/status` so shard events do
 * not fan out those private rows.
 */
export function registerMiningRoutes(app: FastifyInstance): void {
  const me = async (accountId: string, db: Queryable = app.db) => {
    const rows = await db
      .select({ planetId: planets.id, seasonId: players.seasonId, playerId: players.id })
      .from(players)
      .innerJoin(planets, and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')))
      .where(eq(players.accountId, accountId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
    return row;
  };

  const privateView = async (accountId: string, planetId?: string) => {
    const capital = alias(planets, 'mining_capital');
    const selected = alias(planets, 'mining_selected');
    const runOrigin = alias(planets, 'mining_run_origin');
    const selectedId = planetId === undefined
      ? eq(selected.id, capital.id)
      : eq(selected.id, planetId);
    // Identity, ownership, active hardware, research and private flights are one
    // atomic SQL snapshot. No surrounding transaction is needed: there is no
    // second private read for ownership to race with.
    const rows = await app.db
      .select({
        playerId: players.id,
        seasonId: players.seasonId,
        asteroidKey: seasons.asteroidKey,
        planetId: selected.id,
        kind: selected.kind,
        coreLevel: buildings.level,
        satelliteSlot: satellites.slot,
        satelliteType: satellites.type,
        researchProjectId: playerResearch.projectId,
        run: miningRuns,
      })
      .from(players)
      .innerJoin(seasons, eq(seasons.id, players.seasonId))
      .innerJoin(
        capital,
        and(eq(capital.controllerPlayerId, players.id), eq(capital.kind, 'CAPITAL')),
      )
      .innerJoin(selected, and(eq(selected.controllerPlayerId, players.id), selectedId))
      .leftJoin(
        buildings,
        and(eq(buildings.planetId, selected.id), eq(buildings.type, 'CORE')),
      )
      .leftJoin(satellites, eq(satellites.planetId, selected.id))
      /*
        THE COMMANDER'S SPECTROMETRY, NOT THE WORLD'S. T7.

        This joined `planet_research` on the selected world. After research moved
        to the commander that join can only ever miss, and the failure is SILENT:
        the route would simply report every isotope anomaly as unreadable to a
        player who had paid for the project. Keyed on `players.id`, which is what
        the gate always meant.
      */
      .leftJoin(
        playerResearch,
        and(
          eq(playerResearch.playerId, players.id),
          eq(playerResearch.projectId, 'ISOTOPE_SPECTROMETRY'),
        ),
      )
      // Hardware belongs to the selected world; airborne Prospectors belong to
      // the commander. Joining every currently controlled origin keeps a run on
      // the galaxy and in the pending strip when another colony is selected.
      .leftJoin(runOrigin, eq(runOrigin.controllerPlayerId, players.id))
      .leftJoin(
        miningRuns,
        and(
          eq(miningRuns.planetId, runOrigin.id),
          inArray(miningRuns.status, ['outbound', 'returning']),
        ),
      )
      .where(eq(players.accountId, accountId));
    const first = rows[0];
    if (!first) {
      if (planetId !== undefined) {
        // Keep NO_PLANET distinct from naming another commander's world. The
        // extra lookup is on a refusal only.
        await me(accountId);
        throw new GameError('PLANET_NOT_OWNED', 'You do not control that world', 403);
      }
      throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
    }
    if (first.kind === 'NEUTRAL') {
      throw new GameError('PLANET_NOT_OWNED', 'You do not control that world', 403);
    }
    const orbit = orbitFromRows(
      rows.flatMap((row) => row.satelliteSlot === null || row.satelliteType === null
        ? []
        : [{ slot: row.satelliteSlot, type: row.satelliteType }]),
      first.coreLevel ?? 0,
    );
    const runs = [...new Map(
      rows.flatMap((row) => row.run === null ? [] : [[row.run.id, row.run] as const]),
    ).values()];
    return {
      seasonId: first.seasonId,
      revealIsotopes: rows.some(
        (row) => row.researchProjectId === 'ISOTOPE_SPECTROMETRY',
      ),
      playerId: first.playerId,
      view: projectPrivateMiningView(
        orbit,
        runs,
        await techOf(app.db, first.playerId),
        first.asteroidKey,
      ),
    };
  };

  const fieldView = async (seasonId: string, playerId: string, revealIsotopes: boolean) => {
    const now = app.clock.now();
    const snapshot = await app.projections.miningSnapshot(seasonId, now);
    const epochs = await sensorHistoryForPlayer(app.db, playerId, snapshot.startsAt);
    const field = projectPlayerAsteroidField(
      snapshot,
      snapshot.asteroidKey,
      epochs,
      now,
      revealIsotopes,
    );
    return {
      asteroids: field.asteroids.map((asteroid) => ({
        id: asteroid.id,
        level: asteroid.level,
        ore: asteroid.ore,
        oreRemaining: Math.round(asteroid.oreRemaining),
        crystalShare: Math.round(asteroid.crystalShare * 100) / 100,
        radius: asteroid.radius,
        period: asteroid.period,
        phase: asteroid.phase,
        inclination: asteroid.inclination,
        ascendingNode: asteroid.ascendingNode,
        speed: asteroid.speed,
        appearsAt: asteroid.appearsAt,
        expiresAt: asteroid.expiresAt,
        active: asteroid.active,
        isotopeRich: asteroid.isotopeRich,
        deuteriumShare: asteroid.deuteriumShare === null
          ? null
          : Math.round(asteroid.deuteriumShare * 100) / 100,
      })),
      debris: projectVisibleDebris(snapshot, now).map((field) => ({
        id: field.id,
        planetId: field.planetId,
        alloy: Math.round(field.alloy),
        crystal: Math.round(field.crystal),
        deuterium: Math.round(field.deuterium),
        minutesLeft: Math.round(field.minutesLeft),
      })),
      nextFieldChangeAt: field.nextFieldChangeAt,
    };
  };

  /**
   * What is crossing the disc right now, and what your craft could do about it.
   *
   * The rocks come with their full trajectory rather than a position, so the
   * client animates them from its own clock instead of polling — the same
   * arrangement that lets fleets move for zero bandwidth (A4, A5).
   */
  app.get('/api/mining', { preHandler: requireAuth }, async (req) => {
    const query = z.object({ planetId: z.string().uuid().optional() }).strict().parse(req.query);
    const own = await privateView(req.accountId!, query.planetId);
    return {
      ...own.view,
      ...await fieldView(own.seasonId, own.playerId, own.revealIsotopes),
    };
  });

  /** Caller-filtered field; shard invalidation is safe because the query reapplies fog. */
  app.get('/api/mining/field', { preHandler: requireAuth }, async (req) => {
    const commander = await app.projections.commander(req.accountId!);
    return fieldView(commander.seasonId, commander.playerId, false);
  });

  /** Caller-only hardware, isotope entitlement and active runs. */
  app.get('/api/mining/status', { preHandler: requireAuth }, async (req) => {
    const query = z.object({ planetId: z.string().uuid().optional() }).strict().parse(req.query);
    const own = await privateView(req.accountId!, query.planetId);
    const revealed = own.revealIsotopes
      ? projectIsotopeKnowledge((await fieldView(own.seasonId, own.playerId, true)).asteroids)
      : [];
    return { ...own.view, isotopes: revealed };
  });

  /** Send craft to a wreck field. D32. */
  app.post('/api/mining/harvest', { preHandler: requireAuth }, async (req) => {
    const body = z
      .object({ originPlanetId: z.string().uuid().optional(), fieldId: z.string().uuid(), craft: z.number().int().min(1).max(500) }).strict()
      .parse(req.body);
    const legacy = await me(req.accountId!);
    const planetId = body.originPlanetId ?? legacy.planetId;
    const owner = body.originPlanetId
      ? await ownedPlanet(app.db, req.accountId!, body.originPlanetId)
      : legacy;
    return launchHarvest(app.db, planetId, body.fieldId, body.craft, app.clock, owner.playerId);
  });

  /** Send craft at a rock. Refused if it will be gone before they arrive. */
  app.post('/api/mining/launch', { preHandler: requireAuth }, async (req) => {
    const body = launchBody.parse(req.body);
    const legacy = await me(req.accountId!);
    const planetId = body.originPlanetId ?? legacy.planetId;
    const owner = body.originPlanetId
      ? await ownedPlanet(app.db, req.accountId!, body.originPlanetId)
      : legacy;
    const result = await launchMining(
      app.db,
      planetId,
      body.asteroidId,
      body.craft,
      app.clock,
      owner.playerId,
    );
    const { asteroidIndex: _internalIndex, ...publicResult } = result;
    return publicResult;
  });
}
