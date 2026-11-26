import { and, asc, eq, gt, sql } from 'drizzle-orm';
import {
  CAPSULE_IDS, SYNTHESIS, accrueMoonAsterium, capsulesForLaunch, validateMissionCapsules, type AppliedCapsule, type CapsuleMissionKind, type Fleet, moonAsteriumPerDay, synthesisCancelRefund, synthesisCost, synthesisDelivered,
  synthesisDurationMs, synthesisEnabled, type CapsuleId, type MoonRarity,
} from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import {
  buildings, galaxyEventOccurrences, moons, planets, playerAsterium, playerCapsules, players, scheduledEvents, seasons, shards, synthesisJobs,
} from '../db/schema.js';
import { schedule } from '../worker/queue.js';
import { notify } from './notifications.js';
import { GameError, assertWorldOperational, loadLocked, refreshWealth, saveResources } from './planet.js';
import { loadPlanetViewData, type PlanetViewData } from './planetView.js';

/**
 * ASTERYUM VE SENTEZ LABORATUVARI (plan 2026-11-24 §3.1–§3.4, owner answers 2026-11-25).
 *
 * Asteryum is a commander's own stock (`player_asterium`): moons fill it lazily, the Yarık's storm
 * fills it at an exit, the laboratory spends it. Everything that writes it goes through here.
 */

export interface SynthesisMoonRow {
  planetId: string;
  planetName: string;
  rarity: MoonRarity;
  perDay: number;
  /** A Death Star's closure: nothing is made until then. */
  closedUntil: string | null;
  /** When this moon's next whole Asteryum lands, if it is open. */
  nextAt: string | null;
}

export interface SynthesisView {
  enabled: boolean;
  requiredCore: number;
  coreLevel: number;
  unlocked: boolean;
  asterium: number;
  /** Asteryum a day from every moon held, closed or not. */
  perDay: number;
  moons: SynthesisMoonRow[];
  capsules: Record<CapsuleId, number>;
  job: null | {
    capsuleId: CapsuleId;
    quantity: number;
    delivered: number;
    startedAt: string;
    /** The next capsule's landing; equals `completesAt` for the last one. */
    nextAt: string;
    completesAt: string;
  };
  /** The next or running Asteryum Fırtınası in this galaxy, if one is dealt. */
  storm: null | { active: boolean; startsAt: string; endsAt: string };
}

export interface SynthesisResult {
  synthesis: SynthesisView;
  planet: PlanetViewData;
}

const MS_PER_DAY = 86_400_000;

/** Asteryum exists in this season: dealt at ruleset 21+ or opened live, main galaxies only. */
export async function seasonHasSynthesis(tx: Queryable, seasonId: string): Promise<boolean> {
  const [row] = await tx.select({ rulesetVersion: seasons.rulesetVersion, synthesisStartsAt: seasons.synthesisStartsAt, role: shards.role })
    .from(seasons).innerJoin(shards, eq(shards.id, seasons.shardId)).where(eq(seasons.id, seasonId));
  return row !== undefined && synthesisEnabled(row, row);
}

/** Add to a commander's stock. Atomic, so two exits landing together both count (EN-03). */
export async function creditAsterium(tx: Tx, playerId: string, amount: number, now: Date): Promise<void> {
  if (!Number.isInteger(amount) || amount < 0) throw new Error(`Invalid Asteryum credit ${amount}`);
  if (amount === 0) return;
  await tx.insert(playerAsterium).values({ playerId, balance: amount, updatedAt: now })
    .onConflictDoUpdate({ target: playerAsterium.playerId, set: { balance: sql`${playerAsterium.balance} + ${amount}`, updatedAt: now } });
}

/**
 * PAY ONE WORLD'S MOON TO WHOEVER HOLDS THE WORLD NOW, AND START IT AGAIN FROM `now`. Called before
 * anything that changes who is paid or how fast: a capture, a secession, a Death Star's closure, a new
 * rarity, an explosion. A world with no holder pays nobody; its clock still moves on, so a later
 * captor is never paid for the time nobody held it.
 */
export async function settleWorldMoonAsterium(
  tx: Tx,
  planetId: string,
  now: Date,
  /** The world changes hands: the old holder's part-unit is not the next holder's. */
  options: { newHolder?: boolean } = {},
): Promise<void> {
  const [row] = await tx.select({ moon: moons, holder: planets.controllerPlayerId, seasonId: planets.seasonId })
    .from(moons).innerJoin(planets, eq(planets.id, moons.planetId))
    .where(eq(moons.planetId, planetId)).for('update', { of: moons });
  if (!row) return;
  const accrued = accrueMoonAsterium({
    rarity: row.moon.rarity, syncedAtMs: row.moon.asteriumSyncedAt.getTime(), closedUntilMs: row.moon.closedUntil?.getTime() ?? null,
    fraction: row.moon.asteriumFraction, nowMs: now.getTime(),
  });
  const pays = row.holder !== null && await seasonHasSynthesis(tx, row.seasonId);
  if (pays && row.holder !== null) await creditAsterium(tx, row.holder, accrued.gained, now);
  await tx.update(moons).set({
    asteriumSyncedAt: new Date(accrued.syncedAtMs),
    asteriumFraction: pays && options.newHolder !== true ? accrued.fraction : 0,
    // What the moon has paid is its holder's count; a new holder starts it again.
    asteriumProduced: options.newHolder === true ? 0 : row.moon.asteriumProduced + (pays ? accrued.gained : 0),
  }).where(eq(moons.planetId, planetId));
}

/** Every moon this commander holds, paid up to `now`. Locked in planet order, so two readers never deadlock. */
async function syncPlayerMoons(tx: Tx, playerId: string, now: Date): Promise<{ moon: typeof moons.$inferSelect; name: string }[]> {
  const rows = await tx.select({ moon: moons, name: planets.name })
    .from(moons).innerJoin(planets, eq(planets.id, moons.planetId))
    .where(eq(planets.controllerPlayerId, playerId))
    .orderBy(asc(moons.planetId))
    .for('update', { of: moons });
  let gained = 0;
  for (const row of rows) {
    const accrued = accrueMoonAsterium({
      rarity: row.moon.rarity, syncedAtMs: row.moon.asteriumSyncedAt.getTime(), closedUntilMs: row.moon.closedUntil?.getTime() ?? null,
      fraction: row.moon.asteriumFraction, nowMs: now.getTime(),
    });
    gained += accrued.gained;
    row.moon.asteriumSyncedAt = new Date(accrued.syncedAtMs);
    row.moon.asteriumFraction = accrued.fraction;
    row.moon.asteriumProduced += accrued.gained;
    await tx.update(moons).set({ asteriumSyncedAt: row.moon.asteriumSyncedAt, asteriumFraction: accrued.fraction, asteriumProduced: row.moon.asteriumProduced })
      .where(eq(moons.planetId, row.moon.planetId));
  }
  await creditAsterium(tx, playerId, gained, now);
  return rows;
}

async function addCapsules(tx: Tx, playerId: string, capsuleId: CapsuleId, count: number): Promise<void> {
  if (count <= 0) return;
  await tx.insert(playerCapsules).values({ playerId, capsuleId, quantity: count })
    .onConflictDoUpdate({ target: [playerCapsules.playerId, playerCapsules.capsuleId], set: { quantity: sql`${playerCapsules.quantity} + ${count}` } });
}

/** The laboratory's row on the capital sheet, as a notification names it (`PlanetScreen`'s `focusItem`). */
const SYNTHESIS_LAB_ITEM = 'synthesis-lab';

/**
 * MOVE A RUNNING BATCH FORWARD TO `now` (K6): capsules already made go to the inventory; the last one
 * closes the job and tells the commander once. The worker's event and every read share this, and the
 * row lock makes them agree. `jobId` limits it to one batch, for a stale event.
 */
export async function settleSynthesisJob(tx: Tx, playerId: string, now: Date, jobId?: string): Promise<typeof synthesisJobs.$inferSelect | null> {
  const [job] = await tx.select().from(synthesisJobs)
    .where(and(eq(synthesisJobs.playerId, playerId), ...(jobId === undefined ? [] : [eq(synthesisJobs.id, jobId)])))
    .for('update');
  if (!job) return null;
  const made = synthesisDelivered({ capsuleId: job.capsuleId, quantity: job.quantity, startedAtMs: job.startedAt.getTime() }, now.getTime());
  await addCapsules(tx, playerId, job.capsuleId, made - job.delivered);
  if (made < job.quantity) {
    if (made !== job.delivered) await tx.update(synthesisJobs).set({ delivered: made }).where(eq(synthesisJobs.playerId, playerId));
    return { ...job, delivered: made };
  }
  await tx.delete(synthesisJobs).where(eq(synthesisJobs.playerId, playerId));
  // The press lands in the laboratory: the capital, its Tactical tab, the lab's bay (owner 2026-11-25).
  const capital = await capitalOf(tx, playerId);
  await notify(tx, {
    playerId, kind: 'synthesis_ready', refId: job.id, at: now,
    payload: {
      capsuleId: job.capsuleId, quantity: job.quantity,
      ...(capital ? { planetId: capital.id, group: 'tactical', itemId: SYNTHESIS_LAB_ITEM } : {}),
    },
  });
  return null;
}

async function capitalOf(tx: Tx, playerId: string): Promise<{ id: string; coreLevel: number; seasonId: string } | null> {
  const [row] = await tx.select({ id: planets.id, seasonId: planets.seasonId, core: buildings.level })
    .from(planets)
    .leftJoin(buildings, and(eq(buildings.planetId, planets.id), eq(buildings.type, 'CORE')))
    .where(and(eq(planets.controllerPlayerId, playerId), eq(planets.kind, 'CAPITAL')))
    .limit(1);
  return row ? { id: row.id, coreLevel: row.core ?? 0, seasonId: row.seasonId } : null;
}

async function assemble(tx: Tx, playerId: string, seasonId: string, now: Date, enabled: boolean): Promise<SynthesisView> {
  const held = enabled ? await syncPlayerMoons(tx, playerId, now) : [];
  const job = enabled ? await settleSynthesisJob(tx, playerId, now) : null;
  const [capital, stock, inventory, storm] = await Promise.all([
    capitalOf(tx, playerId),
    tx.select({ balance: playerAsterium.balance }).from(playerAsterium).where(eq(playerAsterium.playerId, playerId)),
    tx.select().from(playerCapsules).where(eq(playerCapsules.playerId, playerId)),
    tx.select().from(galaxyEventOccurrences).where(and(
      eq(galaxyEventOccurrences.seasonId, seasonId), eq(galaxyEventOccurrences.kind, 'ASTERIUM_STORM'), gt(galaxyEventOccurrences.endsAt, now),
    )).orderBy(asc(galaxyEventOccurrences.startsAt)).limit(1),
  ]);
  const capsules = Object.fromEntries(CAPSULE_IDS.map((id) => [id, 0])) as Record<CapsuleId, number>;
  for (const row of inventory) capsules[row.capsuleId] = row.quantity;
  const coreLevel = capital?.coreLevel ?? 0;
  const moonRows = held.map(({ moon, name }): SynthesisMoonRow => {
    const perDay = moonAsteriumPerDay(moon.rarity);
    const closed = moon.closedUntil !== null && moon.closedUntil > now;
    const openFrom = closed && moon.closedUntil ? moon.closedUntil.getTime() : now.getTime();
    const nextAt = new Date(openFrom + ((1 - moon.asteriumFraction) * MS_PER_DAY) / perDay);
    return {
      planetId: moon.planetId, planetName: name, rarity: moon.rarity, perDay,
      closedUntil: closed ? moon.closedUntil?.toISOString() ?? null : null, nextAt: nextAt.toISOString(),
    };
  });
  const next = storm[0];
  return {
    enabled,
    requiredCore: SYNTHESIS.requiredCore,
    coreLevel,
    unlocked: enabled && coreLevel >= SYNTHESIS.requiredCore,
    asterium: stock[0]?.balance ?? 0,
    perDay: moonRows.reduce((sum, row) => sum + row.perDay, 0),
    moons: moonRows,
    capsules,
    job: job === null ? null : {
      capsuleId: job.capsuleId,
      quantity: job.quantity,
      delivered: job.delivered,
      startedAt: job.startedAt.toISOString(),
      nextAt: new Date(job.startedAt.getTime() + synthesisDurationMs(job.capsuleId, job.delivered + 1)).toISOString(),
      completesAt: job.completesAt.toISOString(),
    },
    storm: next ? { active: next.startsAt <= now, startsAt: next.startsAt.toISOString(), endsAt: next.endsAt.toISOString() } : null,
  };
}

async function seasonOfPlayer(tx: Tx, playerId: string): Promise<string> {
  const [row] = await tx.select({ seasonId: players.seasonId }).from(players).where(eq(players.id, playerId));
  if (!row) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
  return row.seasonId;
}

/** The laboratory as the commander sees it, with moons and the running batch brought up to now. */
export async function synthesisViewTx(tx: Tx, playerId: string, clock: Clock): Promise<SynthesisView> {
  const seasonId = await seasonOfPlayer(tx, playerId);
  return assemble(tx, playerId, seasonId, clock.now(), await seasonHasSynthesis(tx, seasonId));
}

export async function synthesisView(db: Db, playerId: string, clock: Clock): Promise<SynthesisView> {
  return db.transaction((tx) => synthesisViewTx(tx, playerId, clock));
}

async function openLab(tx: Tx, playerId: string): Promise<{ seasonId: string; capitalId: string }> {
  const seasonId = await seasonOfPlayer(tx, playerId);
  if (!await seasonHasSynthesis(tx, seasonId)) throw new GameError('SYNTHESIS_DISABLED', 'The laboratory is not open in this galaxy', 409);
  const capital = await capitalOf(tx, playerId);
  if (!capital) throw new GameError('NO_CAPITAL', 'The laboratory stands on your capital', 409);
  return { seasonId, capitalId: capital.id };
}

/**
 * START A BATCH (K6, K13): the whole price at once, from the capital and the stock; what was paid is
 * frozen on the row; the last capsule is booked on the queue. One batch at a time.
 */
export async function startSynthesis(tx: Tx, playerId: string, capsuleId: CapsuleId, quantity: number, clock: Clock): Promise<SynthesisResult> {
  const { seasonId, capitalId } = await openLab(tx, playerId);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > SYNTHESIS.maxBatch) {
    throw new GameError('INVALID_QUANTITY', `Make between 1 and ${SYNTHESIS.maxBatch} capsules`, 400);
  }
  const planet = await loadLocked(tx, capitalId, clock, { expectedPlayerId: playerId });
  assertWorldOperational(planet);
  const now = planet.now;
  if (planet.buildings.CORE < SYNTHESIS.requiredCore) {
    throw new GameError('SYNTHESIS_LOCKED', `The laboratory opens at Komuta Merkezi ${SYNTHESIS.requiredCore}`, 409);
  }
  await syncPlayerMoons(tx, playerId, now);
  if (await settleSynthesisJob(tx, playerId, now)) throw new GameError('SYNTHESIS_BUSY', 'The laboratory is already making a batch', 409);
  const completesAt = new Date(now.getTime() + synthesisDurationMs(capsuleId, quantity));
  if (completesAt > planet.seasonEndsAt) throw new GameError('SEASON_ENDING', 'That batch would finish after the season ends', 409);
  const cost = synthesisCost(capsuleId, quantity);
  if (planet.alloy < cost.alloy || planet.crystal < cost.crystal || planet.deuterium < cost.deuterium) {
    throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources');
  }
  const spent = await tx.update(playerAsterium)
    .set({ balance: sql`${playerAsterium.balance} - ${cost.asterium}`, updatedAt: now })
    .where(and(eq(playerAsterium.playerId, playerId), sql`${playerAsterium.balance} >= ${cost.asterium}`))
    .returning({ balance: playerAsterium.balance });
  if (spent.length === 0) throw new GameError('INSUFFICIENT_ASTERIUM', 'Not enough Asteryum', 409, { need: cost.asterium });
  planet.alloy -= cost.alloy; planet.crystal -= cost.crystal; planet.deuterium -= cost.deuterium;
  await saveResources(tx, capitalId, { alloy: planet.alloy, crystal: planet.crystal, deuterium: planet.deuterium });
  await refreshWealth(tx, planet);
  const [job] = await tx.insert(synthesisJobs).values({
    playerId, seasonId, capsuleId, quantity, delivered: 0, startedAt: now, completesAt,
    paidAlloy: cost.alloy, paidCrystal: cost.crystal, paidDeuterium: cost.deuterium, paidAsterium: cost.asterium,
  }).returning({ id: synthesisJobs.id });
  if (!job) throw new Error('synthesis job was not written');
  await schedule(tx, { seasonId, kind: 'synthesis_complete', refId: job.id, resolveAt: completesAt });
  return { synthesis: await assemble(tx, playerId, seasonId, now, true), planet: await loadPlanetViewData(tx, capitalId, clock) };
}

/**
 * CANCEL THE BATCH (K6): capsules already made stay; half of what the unmade ones cost comes back, from
 * what was paid (ML-06). Once the last capsule is due there is nothing left to cancel: it finishes.
 */
export async function cancelSynthesis(tx: Tx, playerId: string, clock: Clock): Promise<SynthesisResult> {
  const { seasonId, capitalId } = await openLab(tx, playerId);
  const planet = await loadLocked(tx, capitalId, clock, { expectedPlayerId: playerId });
  const now = planet.now;
  const [running] = await tx.select({ id: synthesisJobs.id }).from(synthesisJobs).where(eq(synthesisJobs.playerId, playerId));
  const job = await settleSynthesisJob(tx, playerId, now);
  if (!job) {
    if (!running) throw new GameError('NO_SYNTHESIS', 'Nothing is being made', 409);
    return { synthesis: await assemble(tx, playerId, seasonId, now, true), planet: await loadPlanetViewData(tx, capitalId, clock) };
  }
  const refund = synthesisCancelRefund(
    { alloy: job.paidAlloy, crystal: job.paidCrystal, deuterium: job.paidDeuterium, asterium: job.paidAsterium },
    job.quantity, job.delivered,
  );
  await tx.delete(synthesisJobs).where(eq(synthesisJobs.playerId, playerId));
  await tx.delete(scheduledEvents).where(and(eq(scheduledEvents.kind, 'synthesis_complete'), eq(scheduledEvents.refId, job.id)));
  await creditAsterium(tx, playerId, refund.asterium, now);
  planet.alloy += refund.alloy; planet.crystal += refund.crystal; planet.deuterium += refund.deuterium;
  await saveResources(tx, capitalId, { alloy: planet.alloy, crystal: planet.crystal, deuterium: planet.deuterium });
  await refreshWealth(tx, planet);
  return { synthesis: await assemble(tx, playerId, seasonId, now, true), planet: await loadPlanetViewData(tx, capitalId, clock) };
}

/**
 * THE ONE DOOR EVERY LAUNCH TAKES CAPSULES THROUGH (plan §3.5, S6/S7). Checked before anything else is
 * spent; priced from the fleet that actually leaves; each capsule kind taken by one conditional update,
 * so two launches racing for the last capsules cannot both pass (EN-03). Capsules a running batch has
 * already made count.
 */
export function assertMissionCapsules(kind: CapsuleMissionKind, requested: readonly CapsuleId[]): CapsuleId[] {
  const checked = validateMissionCapsules(kind, requested);
  if (!checked.ok) {
    throw new GameError(checked.code, checked.code === 'CAPSULE_DUPLICATE' ? 'Each capsule rides once' : 'That capsule cannot ride this flight', 400);
  }
  return checked.ids;
}

export async function consumeCapsulesForMission(
  tx: Tx,
  input: { playerId: string; seasonId: string; kind: CapsuleMissionKind; fleet: Fleet; capsules: readonly CapsuleId[]; now: Date },
): Promise<AppliedCapsule[]> {
  const ids = assertMissionCapsules(input.kind, input.capsules);
  if (ids.length === 0) return [];
  if (!await seasonHasSynthesis(tx, input.seasonId)) throw new GameError('SYNTHESIS_DISABLED', 'Capsules are not made in this galaxy', 409);
  await settleSynthesisJob(tx, input.playerId, input.now);
  const applied = capsulesForLaunch(ids, input.fleet).filter((capsule) => capsule.count > 0);
  for (const capsule of applied) {
    const taken = await tx.update(playerCapsules)
      .set({ quantity: sql`${playerCapsules.quantity} - ${capsule.count}` })
      .where(and(eq(playerCapsules.playerId, input.playerId), eq(playerCapsules.capsuleId, capsule.id), sql`${playerCapsules.quantity} >= ${capsule.count}`))
      .returning({ left: playerCapsules.quantity });
    if (taken.length === 0) {
      throw new GameError('INSUFFICIENT_CAPSULES', 'Not enough capsules for this fleet', 409, { capsuleId: capsule.id, need: capsule.count });
    }
  }
  return applied;
}
