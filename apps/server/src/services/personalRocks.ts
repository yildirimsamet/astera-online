import { and, eq, gt, inArray } from 'drizzle-orm';
import { PERSONAL_ROCKS, asteroidActive, personalRockSpecs, type AsteroidSpec, type Vec3 } from '@astera/rules';
import { addMinutes, minutesSince } from '../clock.js';
import type { Queryable, Tx } from '../db/client.js';
import { asteroidClaims, personalRocks } from '../db/schema.js';
import { asteroidId } from './asteroidField.js';

/**
 * KİŞİSEL KAYALAR (plan 2026-11-20 §5.2, Faz 3). Laid once, at a first game's landing, and read by the
 * mining paths of their commander alone. Every other reader of the field — the shared snapshot, the spawn
 * gate, the public race — never sees them.
 */
export async function layPersonalRocks(tx: Tx, input: {
  seasonId: string; seasonStartsAt: Date; playerId: string; capital: Vec3; now: Date; seed: number;
}): Promise<void> {
  const specs = personalRockSpecs(input.capital, minutesSince(input.seasonStartsAt, input.now), input.seed);
  await tx.insert(personalRocks).values(specs.map(spec => ({
    seasonId: input.seasonId, playerId: input.playerId, spec,
    createdAt: input.now, expiresAt: addMinutes(input.now, PERSONAL_ROCKS.lifeMinutes),
  })));
}

/** A commander's rocks still in the sky, as rocks of the field. */
export async function personalRocksOf(db: Queryable, playerId: string, now: Date): Promise<AsteroidSpec[]> {
  const rows = await db.select().from(personalRocks)
    .where(and(eq(personalRocks.playerId, playerId), gt(personalRocks.expiresAt, now)));
  return rows.map(row => ({ ...row.spec, index: row.index }));
}

/** One personal rock by its index, whoever's it is: the arrival of a run that was allowed to launch at it. */
export async function personalRockAt(db: Queryable, seasonId: string, index: number): Promise<AsteroidSpec | undefined> {
  const [row] = await db.select().from(personalRocks)
    .where(and(eq(personalRocks.seasonId, seasonId), eq(personalRocks.index, index)));
  return row ? { ...row.spec, index: row.index } : undefined;
}

/**
 * The commander's rocks in the shape `/api/mining` serves the field, with `personal: true`: the client marks
 * them as theirs. A rock mined out or past its six hours is not served.
 */
export async function personalRockViews(db: Queryable, input: {
  seasonId: string; playerId: string; asteroidKey: string; seasonStartsAt: Date; now: Date;
}) {
  const nowMinutes = minutesSince(input.seasonStartsAt, input.now);
  const rocks = (await personalRocksOf(db, input.playerId, input.now)).filter(rock => asteroidActive(rock, nowMinutes));
  if (rocks.length === 0) return [];
  const claims = await db.select({ index: asteroidClaims.index, oreTaken: asteroidClaims.oreTaken }).from(asteroidClaims)
    .where(and(eq(asteroidClaims.seasonId, input.seasonId), inArray(asteroidClaims.index, rocks.map(rock => rock.index))));
  const taken = new Map(claims.map(claim => [claim.index, claim.oreTaken]));
  return rocks.flatMap(rock => {
    const oreRemaining = Math.max(0, rock.ore - (taken.get(rock.index) ?? 0));
    return oreRemaining <= 0 ? [] : [{
      id: asteroidId(input.asteroidKey, rock.index), level: rock.level, ore: rock.ore, oreRemaining: Math.round(oreRemaining),
      crystalShare: rock.crystalShare, radius: rock.radius, period: rock.period, phase: rock.phase,
      inclination: rock.inclination, ascendingNode: rock.ascendingNode, speed: rock.speed,
      appearsAt: rock.appearsAt, expiresAt: rock.expiresAt, active: true, isotopeRich: false, deuteriumShare: null,
      personal: true as const,
    }];
  });
}
