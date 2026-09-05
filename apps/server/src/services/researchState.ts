import { and, eq, gt, sql } from 'drizzle-orm';
import {
  DEUTERIUM,
  RESEARCH_PROJECT_IDS,
  RESEARCH_PROJECTS,
  researchAvailable,
  type ResearchProjectId,
  type TechLevels,
} from '@astera/rules';
import { atMinute } from '../clock.js';
import type { Queryable } from '../db/client.js';
import { battleReports, playerResearch } from '../db/schema.js';
import type { LockedPlanet } from './planet.js';

/**
 * WHAT THIS COMMANDER HOLDS, AND HOW FAR UP EACH LADDER. T7.
 *
 * Keyed on the PLAYER. It used to be keyed on the planet, which was tolerable
 * while every project was a one-off permission and became a regression the moment
 * one carried a level: a commander with three colonies would buy the same ladder
 * four times, and "micromanagement grows" is the first signal on the list the
 * design says to fix.
 *
 * A missing entry is level 0. Nothing stores a zero.
 */
export type ResearchLevels = ReadonlyMap<ResearchProjectId, number>;

/**
 * The same levels as a plain record, which is the shape every EFFECT reads. T8.
 *
 * `researchLevels` hands back a Map because the build queue projects into it; the
 * rules package takes `TechLevels`. One converter rather than two storage shapes,
 * so there is never a question of which one an effect is looking at.
 */
export const asTech = (levels: ReadonlyMap<ResearchProjectId, number>): TechLevels =>
  Object.fromEntries(levels);

/** Everything this commander has researched, ready for an effect function. */
export async function techOf(db: Queryable, playerId: string): Promise<TechLevels> {
  return asTech(await researchLevels(db, playerId));
}

export async function researchLevels(
  db: Queryable,
  playerId: string,
): Promise<Map<ResearchProjectId, number>> {
  const rows = await db
    .select({ projectId: playerResearch.projectId, level: playerResearch.level })
    .from(playerResearch)
    .where(eq(playerResearch.playerId, playerId));
  return new Map(rows.map((row) => [row.projectId, row.level]));
}

/** Does this commander hold the project at all — the question a permission asks. */
export async function hasResearch(
  db: Queryable,
  playerId: string,
  projectId: ResearchProjectId,
): Promise<boolean> {
  const [row] = await db
    .select({ level: playerResearch.level })
    .from(playerResearch)
    .where(
      and(
        eq(playerResearch.playerId, playerId),
        eq(playerResearch.projectId, projectId),
      ),
    )
    .limit(1);
  return (row?.level ?? 0) > 0;
}

/**
 * Everything the owner may know about the frontier. D93–D95, moved to the
 * commander by T7.
 *
 * No discovery flag is stored. The isotope project is revealed by the shared
 * season clock; Dense Fuel Cells is revealed by a real cargo-limited raid after
 * its prerequisite is complete. That keeps research attached to PvP instead of
 * becoming a detached checklist — and both reads were ALREADY keyed on the
 * attacking commander, so a rung opened by a raid flown from one world has always
 * been open on every world. Moving the completions to the player is what finally
 * makes the two halves agree.
 */
export async function researchView(
  db: Queryable,
  planet: LockedPlanet,
  projectedLevels: ResearchLevels = new Map(),
) {
  const attackerDamage = sql<number>`(
    SELECT COALESCE(SUM((round ->> 'attackerDamage')::double precision), 0)
    FROM jsonb_array_elements(${battleReports.rounds}) AS round
  )`;
  const [rows, cargoInsight, shieldInsight] = await Promise.all([
    db
      .select({
        projectId: playerResearch.projectId,
        level: playerResearch.level,
        completedAt: playerResearch.completedAt,
      })
      .from(playerResearch)
      .where(eq(playerResearch.playerId, planet.playerId)),
    db
      .select({ id: battleReports.id })
      .from(battleReports)
      .where(
        and(
          eq(battleReports.attackerPlayerId, planet.playerId),
          eq(battleReports.cargoLimited, true),
        ),
      )
      .limit(1),
    db
      .select({ id: battleReports.id })
      .from(battleReports)
      .where(
        and(
          eq(battleReports.attackerPlayerId, planet.playerId),
          gt(battleReports.shieldAbsorbed, 0),
          sql`${attackerDamage} > 0`,
          sql`${battleReports.shieldAbsorbed} >= ${attackerDamage}
            * ${DEUTERIUM.graviticDiscoveryShieldShare}`,
        ),
      )
      .limit(1),
  ]);
  const completedAt = new Map(rows.map((row) => [row.projectId, row.completedAt]));
  const held = new Map(rows.map((row) => [row.projectId, row.level]));
  /** Held, plus whatever the construction queue ahead of this order will finish. */
  const queued = new Map(held);
  for (const [id, level] of projectedLevels) {
    queued.set(id, Math.max(queued.get(id) ?? 0, level));
  }
  const graviticInsight = shieldInsight.length > 0;

  const discoveredWith = (
    id: ResearchProjectId,
    levels: ReadonlyMap<ResearchProjectId, number>,
  ): boolean => {
    const done = (project: ResearchProjectId): boolean => (levels.get(project) ?? 0) > 0;
    /*
      DISCOVERY IS A FRONTIER CONCEPT, AND ONLY THE FRONTIER FOUR HAVE ONE.

      The four are FOUND — by the season clock, by a cargo-limited raid, by a shield
      that held — which is the mechanism that keeps research attached to PvP.
      Everything else is simply THERE, and what stands in front of it is its own
      declared `prerequisite` and `availableAtMinutes`, checked separately below.

      THIS WAS A FALL-THROUGH, AND IT COST TEN PROJECTS. The last branch used to be
      the Death Star Protocol's rule — Gravitic Charges held, and the War act open —
      written when those four ids were the whole enum. Every id added after it
      inherited that rule silently: all three economy ladders, all five doctrines,
      and both strategic projects. Their own declarations say `availableAtMinutes:
      0` and `prerequisite: null`, and T8's docblock says in as many words that they
      are "open from the first minute like the refinery: they are not Frontier
      content". A brand new commander could research exactly one of fifteen.

      The strategic pair is DISCOVERED and still shut, which is a different sentence
      from "not discovered" and the one its card has to be able to say: the War act
      has not opened, or the weapon it answers has not been researched.
    */
    switch (id) {
      case 'ISOTOPE_SPECTROMETRY':
        return researchAvailable(id, planet.nowMinutes);
      case 'DENSE_FUEL_CELLS':
        return done('ISOTOPE_SPECTROMETRY') && cargoInsight.length > 0;
      case 'GRAVITIC_CHARGES':
        return done('ISOTOPE_SPECTROMETRY') && graviticInsight;
      case 'DEATH_STAR_PROTOCOL':
        return done('GRAVITIC_CHARGES') && researchAvailable(id, planet.nowMinutes);
      default:
        return true;
    }
  };

  return RESEARCH_PROJECT_IDS.map((id) => {
    const project = RESEARCH_PROJECTS[id];
    const level = held.get(id) ?? 0;
    const queuedLevel = queued.get(id) ?? 0;
    // A permission is "completed" at its ceiling; a ladder is completed only at
    // the top of it. One expression covers both, and `maxLevel: 1` reproduces
    // exactly what the four seasonal projects did before they had levels.
    const completed = level >= project.maxLevel;
    const discovered = discoveredWith(id, held);
    const prerequisiteMet = project.prerequisite === null
      || (held.get(project.prerequisite) ?? 0) > 0;
    const queueDiscovered = discoveredWith(id, queued);
    const queuePrerequisiteMet = project.prerequisite === null
      || (queued.get(project.prerequisite) ?? 0) > 0;

    return {
      id,
      level,
      /**
       * THE RUNG THIS WORLD WOULD BUY NEXT, counting what its queue will finish.
       *
       * `level` is what is HELD and is what the screen shows; this is what the next
       * order is for. They differ exactly when a rung of the same ladder is already
       * queued, and reading the held one there priced a second order at the first
       * rung and stamped it with the first rung's number — so it was paid for and
       * bought nothing, because the completion writes `GREATEST(level, count)`.
       */
      nextLevel: Math.min(project.maxLevel, queuedLevel + 1),
      maxLevel: project.maxLevel,
      /** The price of the NEXT rung, or of the top one when there is no next. */
      cost: project.costAt(Math.min(project.maxLevel, queuedLevel + 1)),
      discovered,
      completed,
      completedAt: completedAt.get(id) ?? null,
      available: !completed
        && discovered
        && prerequisiteMet
        && researchAvailable(id, planet.nowMinutes),
      /**
       * WHETHER THE PROJECT IN FRONT OF THIS ONE IS DONE — PUBLISHED, NOT INFERRED.
       *
       * Both gates were computed here and neither left the server, so a card that
       * saw `available: false` had exactly one visible gate to blame and blamed it:
       * a live commander was told the Interception Grid was researchable "in 0m"
       * two days after the War act opened, when the truth was that Gravitic Charges
       * was not held. Five projects are gated by a project alone — the three stat
       * ladders and the two strategic ones — and `discovered` is true for every one
       * of them, so nothing else in the payload can carry the reason.
       *
       * A project with no prerequisite reports `true`: nothing stands in front of
       * it, which is what "met" means when there is nothing to meet.
       */
      prerequisiteMet,
      /** Whether this project may be appended after the active Construction tail. */
      queueDiscovered,
      queuePrerequisiteMet,
      queueAvailable: queuedLevel < project.maxLevel
        && queueDiscovered
        && queuePrerequisiteMet
        && researchAvailable(id, planet.nowMinutes),
      availableAt: atMinute(planet.seasonStart, project.availableAtMinutes),
      prerequisite: project.prerequisite,
    };
  });
}
