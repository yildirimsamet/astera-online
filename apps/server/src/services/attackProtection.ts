import { and, eq, gt, inArray, isNull, lt, ne, or } from 'drizzle-orm';
import {
  alloyRate,
  crystalRate,
  deuteriumRate,
  earnsRecoveryShield,
  effectiveAttackProtection,
  extendRecoveryShield,
  productionMult,
  recoveryLossHours,
  resourceValue,
  type AttackProtection,
  type Resources,
} from '@astera/rules';
import type { Queryable, Tx } from '../db/client.js';
import { botProfiles, buildings, missions, planets, players, satellites } from '../db/schema.js';
import { GameError, orbitFromRows } from './planet.js';

/**
 * WHO MAY BE ATTACKED, AND WHAT A DEFEAT BUYS. D183 · owner instruction 2026-09-14.
 *
 * ONE FILE FOR BOTH SHIELDS, because to a raider they are one rule. A commander
 * may hold the first-day shield, the recovery shield, or both, and every surface
 * that asks "is this commander reachable" has to get its answer from the same
 * place — `effectiveAttackProtection` in the rules package — or the disc, the
 * launch gate, the bots' target list and the HUD each answer it from whichever
 * column they happened to be written against. That is exactly the failure mode
 * `assertAttackProtections` was extracted out of `mission.ts` and `strategic.ts`
 * to avoid the first time, and adding a second column is when it would recur.
 *
 * WHAT IS PURE AND WHAT IS NOT. The rules package owns the bar, the window and the
 * composition of the two columns; this file owns the four things that need a
 * database — what a commander's works turn out across every world they hold, whether
 * they have a hostile fleet of their own in the air, whether they are a person at
 * all, and the atomic read-check-clear on the player rows.
 */

/**
 * THE STAGED ROLLOUT SWITCH FOR THE RECOVERY SHIELD. `deployment.md` carries the
 * order, and it is the same shape as `PIRATE_SPAWN_INCREASE_ENABLED`.
 *
 * Off means the column is written by the migration and read by nobody: no grant is
 * made and no stored instant protects anybody, so a fleet mid-roll cannot have one
 * instance refusing launches for a shield another instance does not know exists.
 * The first-day shield is untouched either way — it is a separate column and a
 * separate decision.
 */
export const recoveryShieldEnabled = (): boolean =>
  process.env.RECOVERY_SHIELD_ENABLED !== 'false';

/**
 * THE TWO STORED INSTANTS, READ AS ONE, WITH THE SWITCH APPLIED.
 *
 * Every surface that draws or enforces protection comes through here rather than
 * comparing a column to a clock: the disc badge, the season payload's countdown,
 * the launch gate and the bots' target list. One reading, one place for the
 * rollout switch, and no way for two of them to disagree about who is reachable.
 */
export const protectionFrom = (
  newcomerUntil: Date | null,
  recoveryUntil: Date | null,
  now: Date,
): AttackProtection | null => effectiveAttackProtection(
  newcomerUntil?.getTime() ?? null,
  recoveryShieldEnabled() ? recoveryUntil?.getTime() ?? null : null,
  now.getTime(),
);

/**
 * WHAT THIS COMMANDER'S WORKS TURN OUT IN AN HOUR, ACROSS EVERY WORLD.
 *
 * The denominator of the recovery shield: a defeat is heavy when it costs more
 * hours of this than `ABUSE.recoveryLossHours`.
 *
 * IT REPLACED STORAGE CAPACITY, and the live field is why. Capacity is a ceiling
 * nobody reaches — the median commander holds 24% of theirs — so a floor written
 * against it meant a different fraction of a different quantity for every player,
 * and one caught with an empty store could lose everything they had and clear
 * nothing. Production is what a commander actually has going, it is the unit the
 * whole economy profile is already written in, and it can only be zero for someone
 * holding no world at all.
 *
 * NOMINAL, AND THAT IS DELIBERATE: the Foundry counts because it genuinely makes a
 * world bigger, while disruption and a struck world's fallen Core do not — the bar
 * must not drop because they were just hit, or the second raid of an evening would
 * be easier to earn a shield from than the first.
 */
async function commanderProductionRate(
  db: Queryable,
  playerId: string,
): Promise<Resources> {
  const total: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
  const worlds = await db
    .select({ id: planets.id })
    .from(planets)
    .where(eq(planets.controllerPlayerId, playerId));
  if (worlds.length === 0) return total;

  const worldIds = worlds.map((world) => world.id);
  const [buildingRows, satelliteRows] = await Promise.all([
    db.select().from(buildings).where(inArray(buildings.planetId, worldIds)),
    db.select().from(satellites).where(inArray(satellites.planetId, worldIds)),
  ]);

  const levelsByWorld = new Map<string, Map<string, number>>();
  for (const row of buildingRows) {
    const levels = levelsByWorld.get(row.planetId) ?? new Map<string, number>();
    levels.set(row.type, row.level);
    levelsByWorld.set(row.planetId, levels);
  }
  const satellitesByWorld = new Map<string, typeof satelliteRows>();
  for (const row of satelliteRows) {
    const installed = satellitesByWorld.get(row.planetId) ?? [];
    installed.push(row);
    satellitesByWorld.set(row.planetId, installed);
  }

  for (const world of worlds) {
    const levels = levelsByWorld.get(world.id);
    const level = (type: string): number => levels?.get(type) ?? 0;
    const orbit = orbitFromRows(satellitesByWorld.get(world.id) ?? [], level('CORE'));
    const boost = productionMult(orbit);
    total.alloy += alloyRate(level('REFINERY')) * boost;
    total.crystal += crystalRate(level('EXTRACTOR')) * boost;
    total.deuterium += deuteriumRate(level('DEUTERIUM_PLANT')) * boost;
  }
  return total;
}

/**
 * IS THIS COMMANDER IN THE MIDDLE OF ATTACKING SOMEBODY ELSE?
 *
 * The one refusal that is about the DEFENDER's own conduct. Without it, a
 * commander who has committed a raid and taken a counter-punch on the way would
 * collect four hours of immunity WHILE their own fleet is still in the air toward
 * a target that cannot answer back — a shield earned by attacking, which inverts
 * what the rule is for.
 *
 * RAID AND DEATH STAR, AT A COMMANDER'S WORLD. A probe, a transfer, a settlement,
 * clan aid, a merchant run and a pirate raid are not the reaching-out this rule is
 * about; a pirate raid is not even in this table. A neutral world has no commander
 * to be unfair to, so a caretaker assault does not count either.
 *
 * A RETURN LEG IS NOT AN ATTACK. It flies under `kind: 'return'`, so the filter
 * names the outbound kinds rather than excluding the inbound one.
 */
async function hasOutboundPvpStrike(
  db: Queryable,
  playerId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: missions.id })
    .from(missions)
    .innerJoin(planets, eq(planets.id, missions.targetPlanetId))
    .where(and(
      eq(missions.ownerPlayerId, playerId),
      eq(missions.status, 'in_flight'),
      inArray(missions.kind, ['attack', 'death_star']),
      ne(planets.kind, 'NEUTRAL'),
      ne(planets.controllerPlayerId, playerId),
    ))
    .limit(1);
  return row !== undefined;
}

/**
 * IS THIS COMMANDER ONE THE SERVER IS PLAYING? D159.
 *
 * A bot is given no first-day shield for a stated reason — a shield on one would
 * remove a target from the disc for a day, on exactly the day a new commander has
 * the fewest of them — and the recovery shield is the same bargain for four hours
 * at a time. The server's commanders hold themselves to the rules people are
 * protected BY and claim none of the protections for themselves.
 *
 * Asked only once both thresholds have already been cleared, so the ordinary
 * battle pays nothing for it.
 */
async function isServerCommander(db: Queryable, playerId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: players.id })
    .from(players)
    .innerJoin(botProfiles, eq(botProfiles.accountId, players.accountId))
    .where(eq(players.id, playerId))
    .limit(1);
  return row !== undefined;
}

/**
 * GRANT OR EXTEND THE FOUR-HOUR WINDOW AFTER ONE BATTLE. Owner instruction.
 *
 * CALLED INSIDE THE BATTLE'S OWN TRANSACTION, with the defender's player row
 * already held `FOR UPDATE` by the settlement that got here (`lockLedgers`). Two
 * battles resolving against one commander in the same instant therefore queue
 * rather than race, and the read-check-write below is atomic against everything
 * that takes that row — see `assertAttackProtections` for the one thing that
 * deliberately does not, and why.
 *
 * THE LOSS COMES FROM THE CALLER, not from a second reading of the world. The
 * battle has already debited the stores and cleared the dead hulls, so anything
 * measured here would be measured after the fact. Only the PRODUCTION is read
 * here, because that is a fact about the commander rather than about the battle.
 *
 * IT RETURNS THE HOURS AS WELL AS THE WINDOW, so the battle report can record what
 * the decision was made on. The figure cannot be recomputed later: the production
 * rate at the instant of the fight is not stored anywhere else.
 */
export async function grantRecoveryShield(
  tx: Tx,
  input: {
    playerId: string;
    /** The world the battle was fought at; it is the one that works double. */
    planetId: string;
    lootLost: Resources;
    fleetLost: Resources;
    now: Date;
  },
): Promise<{
  until: Date | null;
  hours: number;
  /**
   * DID THIS BLOW CROSS THE BAR — whether or not a window was actually written.
   *
   * Two refusals below are not about the size of the blow: a defender with a raid of
   * their own in the air, and a commander the server plays. Both still took a defeat
   * heavy enough to earn a shield, and what a colony breaks from is the DEFEAT, not the
   * protection (koloni arızaları, `FAULT.attackFaults`). `until` answers "is this
   * commander protected"; this answers "was that a heavy defeat", and they differ in
   * exactly those two cases.
   *
   * False while the switch is off: with no shield system there is no bar to cross, and
   * an operator who stages shields off should not discover they left a second system
   * keyed to it running.
   */
  earned: boolean;
}> {
  if (!recoveryShieldEnabled()) return { until: null, hours: 0, earned: false };
  /*
    NOTHING LOST, NOTHING TO ASK THE DATABASE. This runs on every resolved PvP
    arrival in the galaxy and most of them are REPELLED raids that took nothing;
    reading three tables to divide zero by something is work the worker should not
    do on every mission that lands.
  */
  if (resourceValue(input.lootLost) + resourceValue(input.fleetLost) <= 0) {
    return { until: null, hours: 0, earned: false };
  }
  const production = await commanderProductionRate(tx, input.playerId);
  const hours = recoveryLossHours(input.lootLost, input.fleetLost, production);
  if (!earnsRecoveryShield({ lootLost: input.lootLost, fleetLost: input.fleetLost, production })) {
    return { until: null, hours, earned: false };
  }
  const until = await forceRecoveryShield(tx, {
    playerId: input.playerId,
    planetId: input.planetId,
    now: input.now,
  });
  return { until, hours, earned: true };
}

/**
 * THE WINDOW, WITHOUT THE LOSS TEST. The Death Star's own door.
 *
 * A strike halves a world's stores, takes a Core level and everything that stood
 * on it, and burns the queue behind it — the loudest thing one commander can do to
 * another, and it carries no `loot` for a share to be measured against. The owner
 * ruled it grants the same recovery outright, so the threshold is skipped rather
 * than approximated from destroyed value.
 *
 * THE TWO REFUSALS THAT STILL APPLY are the ones that are not about the size of
 * the blow: a commander with a hostile fleet of their own in the air does not
 * collect a shield, and neither does one the server is playing.
 */
export async function forceRecoveryShield(
  tx: Tx,
  input: {
    playerId: string;
    /**
     * THE STRUCK WORLD. Owner instruction, 2026-09-16: it produces double while the
     * shield stands. Its row is already held by the settlement that got here
     * (`loadLocked`), and its economy has been advanced to `now`, so the boost
     * starts exactly at the battle and nothing before it is paid twice.
     */
    planetId: string;
    now: Date;
  },
): Promise<Date | null> {
  if (!recoveryShieldEnabled()) return null;
  if (await isServerCommander(tx, input.playerId)) return null;
  if (await hasOutboundPvpStrike(tx, input.playerId)) return null;

  const [row] = await tx
    .select({ until: players.recoveryShieldUntil })
    .from(players)
    .where(eq(players.id, input.playerId))
    .for('update');
  if (!row) return null;

  // Never shorten a window that already reaches further, and never write a row
  // that is not a change — a no-op update still costs a lock and an SSE flush.
  const until = new Date(extendRecoveryShield(
    row.until?.getTime() ?? null,
    input.now.getTime(),
  ));
  /*
    THE STRUCK WORLD WORKS DOUBLE UNTIL THE SHIELD'S END — the end the shield
    actually has, which is the existing one when that already reaches further. Only
    ever moved forward: a second defeat on this world extends its boost, and a
    defeat elsewhere leaves this world's boost at the window its own defeat bought.
  */
  const standing = row.until !== null && row.until.getTime() >= until.getTime()
    ? row.until
    : until;
  await tx.update(planets)
    .set({ recoveryBoostUntil: standing })
    .where(and(
      eq(planets.id, input.planetId),
      eq(planets.controllerPlayerId, input.playerId),
      or(isNull(planets.recoveryBoostUntil), lt(planets.recoveryBoostUntil, standing)),
    ));
  if (standing === row.until) return row.until;
  await tx.update(players)
    .set({ recoveryShieldUntil: until })
    .where(eq(players.id, input.playerId));
  return until;
}

/**
 * BOTH SHIELDS, ON BOTH SIDES OF ONE HOSTILE LAUNCH. D183, extended 2026-09-14.
 *
 * ONE STATEMENT, TWO LANES. A raid and a strike ask the identical question, and a
 * shield that stopped one and not the other would stop nothing worth stopping —
 * the strike is the loudest thing one commander can do to another. Written here
 * rather than twice because two copies of a rule are how the two lanes start
 * disagreeing about who is protected.
 *
 * THE ORDER IS LOAD-BEARING. The TARGET's protection is checked first: accepting
 * the loss of your own window to hit somebody who cannot be hit would spend a
 * position for nothing, and the launch is refused either way. Both refusals are
 * raised before anything is spent, like D168's band, because a refusal that costs
 * something is a punishment for asking a question.
 *
 * SPENT TOGETHER, AND SPENT, NEVER PAUSED. Accepting clears BOTH columns in the
 * one update: a commander who fires has committed to the war, and leaving the
 * other window standing would let somebody keep half a shield by owning two kinds
 * of it. Dropping writes null rather than a past instant, so "has this commander
 * committed" stays a presence rather than a date comparison somebody forgets to
 * make, and the first day can never come back.
 *
 * THE READ IS DELIBERATELY UNLOCKED, AND THE REASON IS A LOCK CYCLE.
 *
 * A launch already holds both PLANET rows by the time it gets here (`lockWorlds`),
 * while battle settlement holds both PLAYER rows before it takes the defender's
 * planet (`lockLedgers`, then `loadLocked`). Taking `FOR UPDATE` on the players
 * here would close the ring: the launch would hold a planet and wait for a player
 * while the settlement held that player and waited for that planet, and Postgres
 * would break the tie by aborting one of them — a 500 on a raid, at exactly the
 * busy moment the lock was added to make safe. So this reads the two rows the same
 * way the first-day shield has always read them, and the atomicity is bought on the
 * other side instead: `forceRecoveryShield` refuses a grant to a commander who has
 * an outbound raid in flight, so "attacking and protected at once" is closed by the
 * grant rather than by the spend.
 *
 * WHAT REMAINS IS ONE NARROW WINDOW, stated rather than glossed: a launch that has
 * read its rows but not yet committed its mission is invisible to a settlement
 * resolving in that instant, so a shield can be granted to a commander whose raid
 * is a few milliseconds from the air. It closes itself — the window is four hours,
 * their own next launch clears it, and it costs the galaxy one commander who could
 * not be hit back for one evening. Closing it properly means taking the player
 * locks BEFORE the planet locks in `startAttack`, which is a change to the launch
 * path's lock contract rather than to this rule.
 *
 * A NEUTRAL TARGET IS OUTSIDE IT ENTIRELY. There is no commander to protect and
 * none to charge; settling is not the reaching-out this rule is about.
 */
export async function assertAttackProtections(
  tx: Tx,
  input: {
    attackerPlayerId: string;
    defenderPlayerId: string | null;
    now: Date;
    acknowledgeShieldLoss: boolean;
  },
): Promise<void> {
  if (input.defenderPlayerId === null) return;

  const ids = [...new Set([input.attackerPlayerId, input.defenderPlayerId])];
  const rows = await tx
    .select({
      id: players.id,
      newcomer: players.newcomerShieldUntil,
      recovery: players.recoveryShieldUntil,
    })
    .from(players)
    .where(inArray(players.id, ids));
  const protectionOf = (id: string): AttackProtection | null => {
    const row = rows.find((candidate) => candidate.id === id);
    return row ? protectionFrom(row.newcomer, row.recovery, input.now) : null;
  };

  const theirs = protectionOf(input.defenderPlayerId);
  if (theirs) {
    throw new GameError(
      'NEWCOMER_SHIELDED',
      theirs.kind === 'RECOVERY'
        ? 'That commander is under a recovery shield'
        : 'That commander is still under their first-day shield',
      409,
      { until: new Date(theirs.until).toISOString(), protection: theirs.kind },
    );
  }

  const mine = protectionOf(input.attackerPlayerId);
  if (!mine) return;
  if (!input.acknowledgeShieldLoss) {
    throw new GameError(
      'SHIELD_WOULD_DROP',
      mine.kind === 'RECOVERY'
        ? 'Launching this gives up your own recovery shield'
        : 'Launching this gives up your own first-day shield',
      409,
      { until: new Date(mine.until).toISOString(), protection: mine.kind },
    );
  }
  await tx.update(players)
    .set({ newcomerShieldUntil: null, recoveryShieldUntil: null })
    .where(eq(players.id, input.attackerPlayerId));
  /*
    THE BOOST GOES WITH THE SHIELD. Owner's words: "bu kalkan aktifken". Cut to NOW
    rather than nulled, so the lazy tick still pays every boosted minute up to the
    launch on a world that has not been read since. Only rows with a live boost are
    touched, which is none at all for almost every launch in the galaxy.
  */
  await tx.update(planets)
    .set({ recoveryBoostUntil: input.now })
    .where(and(
      eq(planets.controllerPlayerId, input.attackerPlayerId),
      gt(planets.recoveryBoostUntil, input.now),
    ));
}
