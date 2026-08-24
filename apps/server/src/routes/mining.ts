import { and, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prospectorHold, prospectorSpeed } from '@astera/rules';
import { buildings, miningRuns, planetResearch, planets, players, satellites } from '../db/schema.js';
import { GameError, orbitFromRows } from '../services/planet.js';
import {
  launchHarvest,
  launchMining,
  projectVisibleAsteroids,
  projectVisibleDebris,
} from '../services/mining.js';
import { requireAuth } from './auth.js';
import { ownedPlanet } from '../services/ownership.js';
import type { Queryable } from '../db/client.js';

const launchBody = z.object({
  originPlanetId: z.string().uuid().optional(),
  asteroidIndex: z.number().int().min(0),
  craft: z.number().int().min(1).max(500),
});

/**
 * MINING — the Drill's reason to exist. D19.
 *
 * The asteroid field is deliberately PUBLIC: rocks are physical objects on open
 * trajectories, everyone sees the same ones, and the race for them is the whole
 * decision. Rock/wreck state is shared; isotope recognition, installed hardware
 * and the caller's own runs are private. They are separate endpoints so a public
 * shard event never makes every commander query everybody's private layer.
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
        planetId: selected.id,
        kind: selected.kind,
        coreLevel: buildings.level,
        satelliteSlot: satellites.slot,
        satelliteType: satellites.type,
        researchProjectId: planetResearch.projectId,
        run: miningRuns,
      })
      .from(players)
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
      .leftJoin(
        planetResearch,
        and(
          eq(planetResearch.planetId, selected.id),
          eq(planetResearch.projectId, 'ISOTOPE_SPECTROMETRY'),
        ),
      )
      .leftJoin(
        miningRuns,
        and(
          eq(miningRuns.planetId, selected.id),
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
      view: {
        /** Whether the DERRICK is in orbit. D25 — hardware, never a level. */
        derrick: orbit.includes('DERRICK'),
        craftSpeed: prospectorSpeed(orbit),
        craftHold: prospectorHold(orbit),
        derrickHold: prospectorHold(['DERRICK']),
        runs: runs.map((run) => ({
          id: run.id,
          targetKind: run.targetKind,
          asteroidIndex: run.asteroidIndex,
          debrisFieldId: run.debrisFieldId,
          status: run.status,
          craft: run.craft,
          departAt: run.departAt,
          arriveAt: run.arriveAt,
          homeAt: run.homeAt,
          intercept: { x: run.interceptX, y: run.interceptY, z: run.interceptZ },
          minedAlloy: Math.round(run.minedAlloy),
          minedCrystal: Math.round(run.minedCrystal),
          minedDeuterium: Math.round(run.minedDeuterium),
        })),
      },
    };
  };

  const fieldView = async (seasonId: string, revealIsotopes: boolean) => {
    const now = app.clock.now();
    const snapshot = await app.projections.miningSnapshot(seasonId, now);
    const field = projectVisibleAsteroids(snapshot, now, revealIsotopes);
    return {
      asteroids: field.map((asteroid) => ({
        index: asteroid.index,
        level: asteroid.level,
        ore: asteroid.ore,
        oreRemaining: Math.round(asteroid.oreRemaining),
        crystalShare: Math.round(asteroid.crystalShare * 100) / 100,
        radius: asteroid.radius,
        period: asteroid.period,
        phase: asteroid.phase,
        y: asteroid.y,
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
    return { ...own.view, ...await fieldView(own.seasonId, own.revealIsotopes) };
  });

  /** Common field only: safe for a shard-wide invalidation fan-out. */
  app.get('/api/mining/field', { preHandler: requireAuth }, async (req) => {
    const commander = await app.projections.commander(req.accountId!);
    return fieldView(commander.seasonId, false);
  });

  /** Caller-only hardware, isotope entitlement and active runs. */
  app.get('/api/mining/status', { preHandler: requireAuth }, async (req) => {
    const query = z.object({ planetId: z.string().uuid().optional() }).strict().parse(req.query);
    const own = await privateView(req.accountId!, query.planetId);
    const revealed = own.revealIsotopes
      ? (await fieldView(own.seasonId, true)).asteroids.flatMap((asteroid) =>
          asteroid.isotopeRich && asteroid.deuteriumShare !== null
            ? [{ index: asteroid.index, deuteriumShare: asteroid.deuteriumShare }]
            : [])
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
    return launchMining(app.db, planetId, body.asteroidIndex, body.craft, app.clock, owner.playerId);
  });
}
