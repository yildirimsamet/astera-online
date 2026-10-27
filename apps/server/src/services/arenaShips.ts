import { queueShipReady } from './arenaReady.js';
import { notify } from './notifications.js';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, gt, isNotNull, isNull } from 'drizzle-orm';
import { ARENA_ECONOMY as E, TEAM_CONNECT_SECONDS, classChangeOpen, dailyCap, entryOpen, gainXp, launchLoad, levelCap, levelCost, loadoutPlan, refillCost, repairQuote, settleHold, shipStats,
  MAX_POINT_RANK, abilityRank, pointsLeft, sortieXp, xpToNext, type Ability, type AbilityPoints, type ArenaResources, type LoadoutPlan, type ShipClass, type SortieOutcome, type SortieLoadout } from '@astera/rules/arena';
import { systemClock, type Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import { arenaAdmirals, arenaShips, arenaTeams, arenaTeamMembers, clanMemberships, players } from '../db/schema.js';
import { ZERO, commander, holdOf, nextMidnight, perHour, sentToday, shipFor, landArenaCargo, type ShipRow } from './arenaShipState.js';
import { activeTeamFor, recallLateMember, recordTeamEnd, recallTeamFlights, releaseStaleLobby } from './arenaTeamLedger.js';
import { assertWorldOperational, GameError, loadLocked, lockSeason, readPlanetSnapshot, recomputePlayerWealth, saveResources,
  type LockedPlanet } from './planet.js';

/**
 * THE YARIK SHIP ON THE GALAXY'S BOOKS (Y6a, plan 14 §7). The arena room calls `launchSortie` before a
 * flight and `endSortie` once it is over; the hangar reads `readHangar`. Locks go season → ship →
 * capital on every path, so a freeze, a launch and a landing cannot wait on one another in a circle.
 * Y6b (§5): a flight's XP goes into the ship's bar as it ends; `upgradeShip` buys the next level.
 */
export type { SortieOutcome };
/** `pilotKills`, `assists`: pilots this flight brought down and helped down (bots never count). */
/** `unseen`: the pilot's page was gone when it ended, so the room's result never reached them. */
export interface SortieEnd { outcome: SortieOutcome; fuel: number; ammo: number; hold: readonly number[]; pilotKills: number; assists: number; unseen?: boolean }
export interface SortieResult {
  outcome: SortieOutcome; deposit: ArenaResources; overflow: ArenaResources; readyAt: string | null; readyReason: 'repair' | 'service' | null;
  /** What the flight made, what the ship kept of it, and what its bar took. */
  xp: { earned: number; kept: number; banked: number };
  teamId?: string;
}
export type Launch = SortieLoadout;
export interface HangarView {
  core: number; minCore: number;
  ship: { class: ShipClass; changeUntil: string | null; fuel: number; ammo: number; hold: number[]; readyAt: string | null;
    readyReason: 'repair' | 'service' | null; flying: boolean;
    /** Y9: out with a fleet it escorts, or flying home alone after it (until `homeAt`); null at home. */
    away: 'escort' | 'homeward' | null; homeAt: string | null;
    /** Y6b: the level, the XP in the bar against what the next level asks, the Çekirdeği's cap and the next level's price. */
    level: number; xp: number; xpNext: number; levelCap: number; upgrade: ArenaResources; abilities: AbilityPoints;
    /** What the next launch tops the tank and the magazine up to, in percent (owner 2026-10-27). */
    plan: LoadoutPlan } | null;
  /** Deuterium the next launch takes from the capital, for the plan. */
  refill: { fuel: number; ammo: number; total: number };
  /** The capital's stock, whole: what pays a refill and a level. */
  deuterium: number; alloy: number; crystal: number;
  cap: ArenaResources; sent: ArenaResources; resetsAt: string; entryClosesAt: string;
}


const planOf = (row: ShipRow): LoadoutPlan => ({ fuel: row.fuelPlan, ammo: row.ammoPlan });

function hangarOf(planet: LockedPlanet, row: ShipRow | undefined, now: Date, landsAt: Date | null): HangarView {
  const ready = row?.readyAt && row.readyAt > now ? row.readyAt : null;
  return {
    core: planet.buildings.CORE, minCore: E.minCore,
    ship: row ? { class: row.ship, fuel: row.fuel, ammo: row.ammo, hold: holdOf(row), flying: row.sortieId !== null,
      away: row.admiralId !== null ? 'escort' : landsAt ? 'homeward' : null, homeAt: row.admiralId === null ? landsAt?.toISOString() ?? null : null,
      changeUntil: classChangeOpen(row.chosenAt, row.changedAt, now) ? new Date(row.chosenAt.getTime() + E.freeChangeHours * 3_600_000).toISOString() : null,
      readyAt: ready?.toISOString() ?? null, readyReason: ready ? row.readyReason : null,
      level: row.level, xp: row.xp, xpNext: xpToNext(row.level), levelCap: levelCap(planet.buildings.CORE), upgrade: levelCost(row.level), abilities: row.abilities,
      plan: planOf(row) } : null,
    refill: row ? refillCost(row.ship, row.fuel, row.ammo, row.level, planOf(row)) : { fuel: 0, ammo: 0, total: 0 },
    deuterium: Math.floor(planet.deuterium), alloy: Math.floor(planet.alloy), crystal: Math.floor(planet.crystal),
    cap: dailyCap(perHour(planet)), sent: row ? sentToday(row, now) : { ...ZERO }, resetsAt: nextMidnight(now).toISOString(),
    entryClosesAt: new Date(planet.seasonEndsAt.getTime() - E.entryClosesMinutes * 60_000).toISOString(),
  };
}

/** The desk for the caller's ship as it stands now, with its road home if it is on one. */
async function viewOf(tx: Tx, planet: LockedPlanet, playerId: string, now: Date): Promise<HangarView> {
  return hangarOf(planet, (await shipFor(tx, playerId))[0], now, await homeLanding(tx, playerId, now));
}

export async function readHangar(db: Db, clock: Clock, accountId: string): Promise<HangarView> {
  return db.transaction(async tx => {
    const who = await commander(tx, accountId);
    const planet = await readPlanetSnapshot(tx, who.capitalId, clock);
    return viewOf(tx, planet, who.playerId, clock.now());
  });
}

/** When a ship flying home alone after its fleet (Y9) touches down; null when it is not on that road. */
export async function homeLanding(q: Queryable, playerId: string, now: Date): Promise<Date | null> {
  const [task] = await q.select({ at: arenaAdmirals.finishedAt }).from(arenaAdmirals)
    .where(and(eq(arenaAdmirals.playerId, playerId), eq(arenaAdmirals.status, 'returned'), isNotNull(arenaAdmirals.homeDepartAt), gt(arenaAdmirals.finishedAt, now)))
    .orderBy(desc(arenaAdmirals.finishedAt)).limit(1);
  return task?.at ?? null;
}

/** The first choice at Komuta Merkezi 9 gives a full ship; one change of class is free for freeChangeHours, keeping the level. */
export async function chooseShip(db: Db, clock: Clock, accountId: string, ship: ShipClass): Promise<HangarView> {
  return db.transaction(async tx => {
    const who = await commander(tx, accountId);
    const planet = await readPlanetSnapshot(tx, who.capitalId, clock);
    if (planet.buildings.CORE < E.minCore) {
      throw new GameError('CORE_TOO_LOW', 'A ship comes with Komuta Merkezi 9', 409, { core: planet.buildings.CORE, need: E.minCore });
    }
    const now = clock.now();
    const full = (level: number) => ({ fuel: shipStats(ship, level).fuelTank, ammo: shipStats(ship, level).ammoCapacity });
    const born = await tx.insert(arenaShips).values({ playerId: who.playerId, ship, chosenAt: now, ...full(1) }).onConflictDoNothing()
      .returning({ playerId: arenaShips.playerId });
    if (born.length === 0) {
      const [row] = await shipFor(tx, who.playerId).for('update');
      if (row && row.ship !== ship) {
        if (row.sortieId !== null) throw new GameError('SHIP_FLYING', 'Your ship is in the Yarık', 409);
        if (row.admiralId !== null) throw new GameError('ADMIRAL_AWAY', 'Your ship accompanies a fleet', 409);
        if (!classChangeOpen(row.chosenAt, row.changedAt, now)) throw new GameError('CLASS_LOCKED', 'Your class is set for the season', 409);
        if (holdOf(row).some(units => units > 0)) throw new GameError('CARGO_ABOARD', 'Fly the cargo aboard to an exit first', 409);
        await tx.update(arenaShips).set({ ship, changedAt: now, abilities: {}, ...full(row.level) }).where(eq(arenaShips.playerId, who.playerId));
      }
    }
    return viewOf(tx, planet, who.playerId, now);
  });
}

/**
 * Sets what the next launch tops the tank and the magazine up to (owner 2026-10-27): steps of the
 * rules' LOADOUT only. It spends nothing; the launch charges for it.
 */
export async function setLoadout(db: Db, clock: Clock, accountId: string, plan: LoadoutPlan): Promise<HangarView> {
  const valid = loadoutPlan(plan);
  if (!valid) throw new GameError('INVALID_PLAN', 'The tank goes in quarters, the magazine from empty', 400, { fuel: plan.fuel, ammo: plan.ammo });
  return db.transaction(async tx => {
    const who = await commander(tx, accountId);
    const [row] = await shipFor(tx, who.playerId).for('update');
    if (!row) throw new GameError('NO_SHIP', 'Choose a ship first', 409);
    await tx.update(arenaShips).set({ fuelPlan: valid.fuel, ammoPlan: valid.ammo }).where(eq(arenaShips.playerId, who.playerId));
    return viewOf(tx, await readPlanetSnapshot(tx, who.capitalId, clock), who.playerId, clock.now());
  });
}

/** Tops the ship up to its plan from the capital's deuterium and puts it in the air. Refused, nothing is spent. */
export async function launchSortie(db: Db, clock: Clock, accountId: string): Promise<Launch> {
  await releaseStaleLobby(db, clock, accountId);
  try {
    return await db.transaction(tx => launchSortieIn(tx, clock, accountId));
  } catch (error) {
    // Refused past the window: the reservation comes home now rather than at the next sweep.
    if (error instanceof GameError && error.code === 'TEAM_CONNECT_EXPIRED') await recallLateMember(db, clock, accountId);
    throw error;
  }
}

/** Team start prelocks every ship/capital in order, then calls the same launch rules in its transaction. */
export async function launchSortieIn(tx: Tx, clock: Clock, accountId: string, reserved = false): Promise<Launch> {
    const who = await commander(tx, accountId);
    await lockSeason(tx, who.seasonId);
    if (!reserved) {
      const active = await activeTeamFor(tx, who.playerId);
      if (active) {
        const [team] = await tx.select().from(arenaTeams).where(eq(arenaTeams.id, active.team.id)).for('update');
        if (team?.state === 'forming') throw new GameError('TEAM_LOBBY', 'Leave the lobby before flying solo', 409);
        if (team?.state === 'flying') {
          const [member] = await tx.select().from(arenaTeamMembers).where(eq(arenaTeamMembers.id, active.member.id));
          if (member?.outcome === 'recalled' && member.connectedAt === null) throw new GameError('TEAM_CONNECT_EXPIRED', 'The team went in without you', 409);
          if (member?.outcome !== null || !member.launch) throw new GameError('TEAM_IN_FLIGHT', 'Wait for the team or watch a teammate', 409);
          // The window is kept at the door too, not only by the sweep that recalls an absent member (CR4).
          if (member.connectedAt === null && team.startedAt && clock.now().getTime() - team.startedAt.getTime() >= TEAM_CONNECT_SECONDS * 1000) {
            throw new GameError('TEAM_CONNECT_EXPIRED', 'The team went in without you', 409);
          }
          await tx.update(arenaTeamMembers).set({ connectedAt: clock.now() }).where(eq(arenaTeamMembers.id, member.id));
          return member.launch;
        }
      }
    }
    const [row] = await shipFor(tx, who.playerId).for('update');
    if (!reserved && await activeTeamFor(tx, who.playerId)) throw new GameError('TEAM_LOBBY', 'Your ship joined a team while launch was pending', 409);
    if (!row) throw new GameError('NO_SHIP', 'Choose a ship first', 409);
    if (row.sortieId !== null) throw new GameError('SHIP_FLYING', 'Your ship is in the Yarık', 409);
    if (row.admiralId !== null) throw new GameError('ADMIRAL_AWAY', 'Your ship accompanies a fleet', 409);
    const now = clock.now();
    if (row.readyAt && row.readyAt > now) {
      throw new GameError('SHIP_NOT_READY', 'Your ship is not ready yet', 409, { until: row.readyAt.toISOString(), reason: row.readyReason ?? 'service' });
    }
    const planet = await loadLocked(tx, who.capitalId, clock);
    if (!entryOpen(planet.seasonEndsAt, now)) {
      throw new GameError('SEASON_CLOSING', 'The Yarık closes before the season ends', 409, { endsAt: planet.seasonEndsAt.toISOString() });
    }
    assertWorldOperational(planet);
    const cost = refillCost(row.ship, row.fuel, row.ammo, row.level, planOf(row));
    if (planet.deuterium + 1e-9 < cost.total) {
      throw new GameError('NOT_ENOUGH_DEUTERIUM', 'The capital cannot fill the ship', 409, { need: cost.total, have: Math.floor(planet.deuterium) });
    }
    if (cost.total > 0) {
      await saveResources(tx, who.capitalId, { alloy: planet.alloy, crystal: planet.crystal, deuterium: planet.deuterium - cost.total });
      await recomputePlayerWealth(tx, who.playerId, now);
    }
    const load = launchLoad(row.ship, row.level, row.fuel, row.ammo, planOf(row)); const sortieId = randomUUID();
    await tx.update(arenaShips).set({ fuel: load.fuel, ammo: load.ammo, sortieId }).where(eq(arenaShips.playerId, who.playerId));
    const [clan] = await tx.select({ id: clanMemberships.clanId }).from(clanMemberships).where(and(eq(clanMemberships.playerId, who.playerId), eq(clanMemberships.seasonId, who.seasonId), isNull(clanMemberships.leftAt)));
    return { clanId: clan?.id ?? null, sortieId, ship: row.ship, level: row.level, fuel: load.fuel, ammo: load.ammo, hold: holdOf(row), refilled: cost.total, abilities: row.abilities };
}

/**
 * Closes `sortieId` once: null when it is not the ship's flight in the air (already closed, or
 * recalled after a crash). An exit lands the hold up to the day's cap while the season is live;
 * a recall keeps it aboard; every other end loses it. Its XP goes into the bar (`sortieXp`, `gainXp`).
 */
export async function endSortie(db: Db, clock: Clock, accountId: string, sortieId: string, end: SortieEnd): Promise<SortieResult | null> {
  return db.transaction(async tx => {
    const who = await commander(tx, accountId);
    const season = await lockSeason(tx, who.seasonId, false);
    const [member] = await tx.select().from(arenaTeamMembers).where(and(eq(arenaTeamMembers.playerId, who.playerId), eq(arenaTeamMembers.sortieId, sortieId)));
    const team = member ? (await tx.select().from(arenaTeams).where(eq(arenaTeams.id, member.teamId)).for('update'))[0] : undefined;
    const pooled = member !== undefined && team?.solo !== true;
    const [row] = await tx.select().from(arenaShips)
      .where(and(eq(arenaShips.playerId, who.playerId), eq(arenaShips.sortieId, sortieId))).for('update');
    if (!row) return null;
    const now = clock.now(); const stats = shipStats(row.ship, row.level);
    let deposit = { ...ZERO }; let overflow = { ...ZERO };
    const live = season.status === 'live' && end.outcome === 'extracted' && !pooled;
    const planet = live ? await loadLocked(tx, who.capitalId, clock) : await readPlanetSnapshot(tx, who.capitalId, clock);
    if (live) ({ deposit, overflow } = await landArenaCargo(tx, row, planet, end.hold, now));
    else if (!pooled && end.outcome === 'extracted') ({ deposit, overflow } = settleHold(end.hold, ZERO));
    const kept = end.outcome === 'recalled' ? [0, 1, 2].map(i => Math.max(0, end.hold[i] ?? 0)) : [0, 0, 0];
    const readyReason = end.outcome === 'recalled' ? null : end.outcome === 'dead' ? 'repair' : 'service';
    const readyAt = readyReason === null ? null : new Date(now.getTime() + (readyReason === 'repair' ? E.repairMinutes : E.serviceMinutes) * 60_000);
    const made = sortieXp(end);
    const bar = gainXp({ level: row.level, xp: row.xp, core: planet.buildings.CORE }, made.kept);
    await tx.update(arenaShips).set({
      sortieId: null, readyAt, readyReason, readyNoticeId: readyAt ? sortieId : null, xp: bar.xp,
      fuel: Math.min(stats.fuelTank, Math.max(0, end.fuel)), ammo: Math.min(stats.ammoCapacity, Math.max(0, end.ammo)),
      holdAlloy: kept[0], holdCrystal: kept[1], holdDeuterium: kept[2],
    }).where(eq(arenaShips.playerId, who.playerId));
    if (readyAt) await queueShipReady(tx, who.seasonId, who.playerId, sortieId, readyAt);
    // The result the room could not show: a lost ship and hold become news (F22).
    if (end.unseen === true && (end.outcome === 'dead' || end.outcome === 'towed') && readyAt) {
      const lost = settleHold(end.hold, ZERO).overflow;
      await notify(tx, { playerId: who.playerId, kind: 'arena_sortie_end', refId: sortieId, at: now,
        payload: { outcome: end.outcome, lost, reason: readyReason, readyAt: readyAt.toISOString(), xp: made.kept } });
    }
    if (member) {
      await recordTeamEnd(tx, member.teamId, who.playerId, season.status === 'live' ? end.outcome : 'recalled', pooled ? end.hold : [], now);
      if (!pooled) await tx.update(arenaTeamMembers).set({ claimedAt: now, receipt: { deposit, overflow } }).where(eq(arenaTeamMembers.id, member.id));
    }
    return { ...(pooled ? { teamId: member.teamId } : {}), outcome: end.outcome, deposit, overflow, readyAt: readyAt?.toISOString() ?? null, readyReason,
      xp: { earned: made.earned, kept: made.kept, banked: bar.banked } };
  });
}

/**
 * Buys the next level (Y6b): a full bar, room under the Komuta Çekirdeği, and alloy and crystal
 * from the capital. The tank and magazine keep what they hold; the next launch fills the grown one.
 */
export async function upgradeShip(db: Db, clock: Clock, accountId: string): Promise<HangarView> {
  return db.transaction(async tx => {
    const who = await commander(tx, accountId);
    await lockSeason(tx, who.seasonId);
    const [row] = await shipFor(tx, who.playerId).for('update');
    if (!row) throw new GameError('NO_SHIP', 'Choose a ship first', 409);
    if (row.sortieId !== null) throw new GameError('SHIP_FLYING', 'Your ship is in the Yarık', 409);
    if (row.admiralId !== null) throw new GameError('ADMIRAL_AWAY', 'Your ship accompanies a fleet', 409);
    const planet = await loadLocked(tx, who.capitalId, clock);
    assertWorldOperational(planet);
    const cap = levelCap(planet.buildings.CORE);
    if (row.level >= cap) throw new GameError('LEVEL_CAP', 'Grow the Komuta Çekirdeği first', 409, { cap, core: planet.buildings.CORE });
    const need = xpToNext(row.level);
    if (row.xp < need) throw new GameError('XP_SHORT', 'The XP bar is not full yet', 409, { xp: row.xp, need });
    const cost = levelCost(row.level);
    if (planet.alloy + 1e-9 < cost.alloy || planet.crystal + 1e-9 < cost.crystal) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'The capital cannot pay for the level', 409, { alloy: cost.alloy, crystal: cost.crystal });
    }
    const now = clock.now();
    await saveResources(tx, who.capitalId, { alloy: planet.alloy - cost.alloy, crystal: planet.crystal - cost.crystal, deuterium: planet.deuterium });
    await recomputePlayerWealth(tx, who.playerId, now);
    await tx.update(arenaShips).set({ level: row.level + 1, xp: 0 }).where(eq(arenaShips.playerId, who.playerId));
    const after = await readPlanetSnapshot(tx, who.capitalId, clock);
    return viewOf(tx, after, who.playerId, now);
  });
}

/**
 * Y6d: buys the shorter repair wait. The locked timer is also the duplicate-payment guard:
 * after payment its remaining wait cannot exceed a fresh quote, so a repeated order spends nothing.
 */
export async function repairShip(db: Db, clock: Clock, accountId: string): Promise<HangarView> {
  return db.transaction(async tx => {
    const who = await commander(tx, accountId);
    await lockSeason(tx, who.seasonId);
    const [row] = await shipFor(tx, who.playerId).for('update');
    if (!row) throw new GameError('NO_SHIP', 'Choose a ship first', 409);
    if (row.sortieId !== null) throw new GameError('SHIP_FLYING', 'Your ship is in the Yarık', 409);
    if (row.admiralId !== null) throw new GameError('ADMIRAL_AWAY', 'Your ship accompanies a fleet', 409);
    const now = clock.now();
    if (row.readyReason !== 'repair' || !row.readyAt || row.readyAt <= now) {
      throw new GameError('SHIP_NOT_REPAIRING', 'Your ship has no repair to shorten', 409);
    }
    const quote = repairQuote(row.level);
    // A ship still flying home alone is repaired from the moment it lands (CR2).
    const landsAt = await homeLanding(tx, who.playerId, now);
    const readyAt = new Date(Math.max(now.getTime(), landsAt?.getTime() ?? 0) + quote.minutes * 60_000);
    if (readyAt >= row.readyAt) throw new GameError('REPAIR_NOT_SHORTER', 'The current repair finishes sooner; wait for it', 409);
    const planet = await loadLocked(tx, who.capitalId, clock);
    assertWorldOperational(planet);
    const cost = quote.cost;
    if (planet.alloy + 1e-9 < cost.alloy || planet.crystal + 1e-9 < cost.crystal) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'The capital cannot pay for the repair', 409, { alloy: cost.alloy, crystal: cost.crystal });
    }
    await saveResources(tx, who.capitalId, { alloy: planet.alloy - cost.alloy, crystal: planet.crystal - cost.crystal, deuterium: planet.deuterium });
    await recomputePlayerWealth(tx, who.playerId, now);
    const noticeId = row.readyNoticeId ?? randomUUID();
    await tx.update(arenaShips).set({ readyAt, readyNoticeId: noticeId }).where(eq(arenaShips.playerId, who.playerId));
    await queueShipReady(tx, who.seasonId, who.playerId, noticeId, readyAt);
    return viewOf(tx, await readPlanetSnapshot(tx, who.capitalId, clock), who.playerId, now);
  });
}

/** One earned point buys one rank of this ability only. Flight ranks stay frozen until the next launch. */
export async function spendAbility(db: Db, clock: Clock, accountId: string, ability: Ability): Promise<HangarView> {
  return db.transaction(async tx => {
    const who = await commander(tx, accountId);
    await lockSeason(tx, who.seasonId);
    const [row] = await shipFor(tx, who.playerId).for('update');
    if (!row) throw new GameError('NO_SHIP', 'Choose a ship first', 409);
    if (row.sortieId !== null) throw new GameError('SHIP_FLYING', 'Your ship is in the Yarık', 409);
    if (row.admiralId !== null) throw new GameError('ADMIRAL_AWAY', 'Your ship accompanies a fleet', 409);
    if (abilityRank(row.ship, ability, row.abilities) >= 5) throw new GameError('ABILITY_RANK_MAX', 'This ability is already at rank five', 409);
    if (abilityRank(row.ship, ability, row.abilities) >= MAX_POINT_RANK) throw new GameError('ABILITY_ESSENCE_REQUIRED', 'Ranks four and five wait for Yarık Essence', 409);
    if (pointsLeft(row.level, row.abilities) < 1) throw new GameError('ABILITY_POINTS_SHORT', 'Raise your ship level to earn an ability point', 409);
    const planet = await loadLocked(tx, who.capitalId, clock);
    assertWorldOperational(planet);
    const abilities = { ...row.abilities, [ability]: (row.abilities[ability] ?? 0) + 1 };
    await tx.update(arenaShips).set({ abilities }).where(eq(arenaShips.playerId, who.playerId));
    return viewOf(tx, planet, who.playerId, clock.now());
  });
}

/** At the room's start: flights a crash left open come home with what they carried in (KG-A15). */
export async function recallOpenSorties(db: Db | Tx, clock: Clock = systemClock): Promise<number> {
  return db.transaction(async tx => {
    // A freeze and a claim also acquire season before team and ship. Startup must follow that order.
    const owners = await tx.select({ seasonId: players.seasonId }).from(arenaShips).innerJoin(players, eq(players.id, arenaShips.playerId));
    for (const seasonId of [...new Set(owners.map(o => o.seasonId))].sort()) await lockSeason(tx, seasonId, false);
    const open = await tx.select({ id: arenaShips.playerId }).from(arenaShips).where(isNotNull(arenaShips.sortieId));
    await recallTeamFlights(tx, clock.now());
    await tx.update(arenaShips).set({ sortieId: null }).where(isNotNull(arenaShips.sortieId));
    return open.length;
  });
}
