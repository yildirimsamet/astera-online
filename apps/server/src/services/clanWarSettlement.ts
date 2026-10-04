import { and, eq } from 'drizzle-orm';
import {
  DEBRIS,
  FAULT,
  NON_COMBATANT_HULLS,
  defendedTransfer,
  allocateJointDefenderLoss,
  allocateJointDominion,
  allocateJointLoot,
  allocateJointSalvage,
  computeLoot,
  dominionTransfer,
  fleetCargo,
  fleetCount,
  fleetEntries,
  combatValue,
  escapeAllowed,
  fleetEscapeMinimumApplies,
  ESCAPE,
  garrisonOf,
  raidableStock,
  resolveRaid,
  salvageCapacity,
  seededFrom,
  settleWreck,
  vaultProtects,
  type Fleet,
  type JointAttackerStack,
  type Resources,
  normalizeLots,
  normalizeHpDamage,
  shipDamageApplies,
  hpRadiationApplies,
  type HpDamageLot,
} from '@astera/rules';
import { dockDamaged, dockNotice, shipsIn } from './shipDamage.js';
import { settleWaveRadiation, tellRadiationLoss } from './radiation.js';
import type { Clock } from '../clock.js';
import type { Tx } from '../db/client.js';
import {
  battleReports,
  clanScoreEvents,
  clanWarContributions,
  clanWarDominionEvents,
  clanWarParticipantResults,
  clans,
  debrisFields,
  planets,
  units,
} from '../db/schema.js';
import type { missions } from '../db/schema.js';
import { adminPlayerIdsInSeason } from './admin.js';
import { grantRecoveryShield, permanentFleetCost } from './attackProtection.js';
import {
  flyingAlloy,
  flyingCrystal,
  flyingDeuterium,
  flyingValue,
  applyDelta,
  identityOfPlanet,
  lockLedgers,
  saveLedger,
} from './battleSettlement.js';
import { addDominionCounters } from './dominion.js';
import {
  defenderCountOf,
  lineOf,
  lockStationsAt,
  notifySupporters,
  settleStations,
  standStations,
  supportFactorOf,
  supportLossOf,
  supporterIdsOf,
  writeDefenderResults,
} from './defenderLine.js';
import { breakFaults, defenceOnline } from './faults.js';
import { rescheduleLoyaltyWatch } from './loyalty.js';
import { notify, announceUnlocks } from './notifications.js';
import {
  loadLocked,
  recomputePlayerWealth,
  recomputeWealth,
  saveResources,
  setUnits,
} from './planet.js';
import { techOf } from './researchState.js';
import { rememberVisitedWorld } from './intel.js';
import { recordGalaxyEvent } from './chronicle.js';
import { publishShard } from '../stream/bus.js';
import {
  closeOperation,
  clanWarPlanetTarget,
  planContributionReturn,
  type ClanWarOperationRow,
} from './clanWar.js';

/**
 * KLAN ORTAK SAVAŞI — SETTLEMENT. Owner design, 2026-09-20.
 *
 * One board, several owners, and every consequence split back out to the people
 * who paid for it. The ordinary raid settles in `worker/handlers.ts`; this is the
 * same sequence with four things replaced:
 *
 *   COMBAT   `resolveJointCombat`, which fires each wave with its OWN owner's
 *            research and keeps every casualty with the wave that suffered it.
 *   LOOT     one haul, computed against the whole surviving side's hold, then
 *            split max-min fair between COMMANDERS and by hold between their
 *            waves. The ordinary 10% clan raid share is not on this path at all.
 *   SCORE    the team's exchange is corrected for the head-count advantage and
 *            then divided by what each commander actually contributed.
 *   RETURN   every wave flies to the world IT left from, not to one rendezvous.
 *
 * ONE TRANSACTION. The battle, the debit, both ledgers, the report, the
 * participant rows and every return leg commit together or not at all: there is
 * no state in which a joint war has been fought but somebody's fleet is nowhere.
 */

const NOTHING: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
const RESOURCE_KEYS = ['alloy', 'crystal', 'deuterium'] as const;

const addResources = (into: Resources, from: Resources): Resources => {
  for (const key of RESOURCE_KEYS) into[key] += from[key];
  return into;
};

/** Pre-lock immutable score snapshots before player ledgers, in clan-id order. */
async function lockJointWarScoreClans(
  tx: Tx,
  operation: ClanWarOperationRow,
): Promise<void> {
  const clanIds = [operation.attackerScoreClanId, operation.defenderScoreClanId]
    .filter((clanId): clanId is string => clanId !== null)
    .filter((clanId, index, ids) => ids.indexOf(clanId) === index)
    .sort();
  for (const clanId of clanIds) {
    await tx.select({ id: clans.id }).from(clans)
      .where(eq(clans.id, clanId)).for('no key update');
  }
}

/** The ships this wave actually still has, read from the authoritative unit rows. */
async function fleetOfContribution(
  tx: Tx,
  contribution: typeof clanWarContributions.$inferSelect,
): Promise<Fleet> {
  const rows = await tx
    .select()
    .from(units)
    .where(and(
      eq(units.planetId, contribution.originPlanetId),
      eq(units.location, contribution.unitLocation),
    ));
  const fleet: Fleet = {};
  for (const row of rows) if (row.count > 0) fleet[row.hull] = row.count;
  return fleet;
}

/**
 * THE COMBINED STRIKE REACHES ITS TARGET.
 *
 * Called from the mission-arrival handler, which has already claimed the mission
 * and locked its endpoints plus every contribution origin in planet-id order —
 * so this runs exactly once per strike and cannot interleave with a write to any
 * home, staging, or target stack it settles.
 */
export async function resolveClanWarBattle(
  tx: Tx,
  input: {
    mission: typeof missions.$inferSelect;
    operation: ClanWarOperationRow;
    rulesetVersion: number;
    clock: Clock;
    adminUsernames: ReadonlySet<string>;
  },
): Promise<void> {
  const { mission, operation } = input;
  const now = input.clock.now();

  const fighting = await tx
    .select()
    .from(clanWarContributions)
    .where(and(
      eq(clanWarContributions.operationId, operation.id),
      eq(clanWarContributions.status, 'IN_BATTLE'),
    ))
    .for('update');
  /*
    RADYASYON FIRST (plan §3.5.4). The pool flies the strike leg as one wing, so every wave
    takes the same dose over it before anything else happens here — before the target is
    even looked at. A wave it finished has nothing left to fight with and is lost the way
    a wiped wave is; a pool it finished whole never fights (`stacks.length === 0` below).
  */
  const waves: typeof fighting = [];
  for (const row of fighting) {
    const dosed = await settleWaveRadiation(tx, row, mission, input.rulesetVersion);
    await tellRadiationLoss(tx, { playerId: row.playerId, refId: mission.id, toPlanetId: mission.targetPlanetId },
      dosed, now);
    waves.push(dosed.wave);
  }
  if (waves.length === 0) {
    await closeOperation(tx, { operation, reason: 'FAILED', now });
    return;
  }

  const [targetWorld] = await tx
    .select({
      kind: planets.kind,
      controllerPlayerId: planets.controllerPlayerId,
      recoveryUntil: planets.recoveryUntil,
      protectedUntil: planets.protectedUntil,
    })
    .from(planets)
    .where(eq(planets.id, mission.targetPlanetId));
  if (!targetWorld) throw new Error('clan war target vanished');

  /*
    THE WORLD WAS NOT THERE TO BE FOUGHT. Same semantics as an ordinary raid that
    arrives at a shield or at a world that changed hands: the pool turns round
    intact, nothing is looted, no score moves and no report is written. The
    operation closes as `TARGET_CHANGED`, which is what the clan will read.
  */
  const unreachable =
    targetWorld.controllerPlayerId === null
    || targetWorld.kind === 'NEUTRAL'
    // A combined strike cannot fight a world now controlled by one of its own
    // contributors. The technical mission owner only names the coordinator.
    || waves.some((wave) => wave.playerId === targetWorld.controllerPlayerId)
    || (targetWorld.recoveryUntil !== null && targetWorld.recoveryUntil > now)
    || (targetWorld.protectedUntil !== null && targetWorld.protectedUntil > now);
  if (unreachable) {
    await returnPoolUntouched(tx, { operation, waves, now, reason: 'TARGET_CHANGED' });
    await rememberVisitedWorld(tx, {
      observerPlayerId: operation.leaderPlayerId,
      targetPlanetId: mission.targetPlanetId,
      seasonId: mission.seasonId,
      seenAt: now,
    });
    return;
  }
  // Narrowed for the compiler as well as for the reader: `unreachable` already
  // covers the null case, and an unchecked `!` here would be a silent cast.
  const defenderPlayerId = targetWorld.controllerPlayerId;
  if (defenderPlayerId === null) throw new Error('clan war target has no controller');

  const stacks: JointAttackerStack[] = [];
  const liveWaves: typeof waves = [];
  for (const wave of waves) {
    const fleet = await fleetOfContribution(tx, wave);
    if (fleetCount(fleet) === 0) continue;
    liveWaves.push(wave);
    stacks.push({
      contributionId: wave.id,
      playerId: wave.playerId,
      fleet,
      tech: { tech: wave.tech },
      // What the wave arrived with in damage (radiation on its legs); null when whole.
      ...(wave.damage ? { damage: wave.damage } : {}),
    });
  }
  if (stacks.length === 0) {
    await returnPoolUntouched(tx, { operation, waves, now, reason: 'FAILED' });
    return;
  }

  const participantIds = [...new Set(stacks.map((stack) => stack.playerId))].sort();
  /*
    KLAN SAVUNMA DESTEĞİ: the defending clan's waves standing at the target, locked after
    the worlds and before any clan or player row (`defenderLine.ts`).
  */
  const stationWaves = await lockStationsAt(tx, {
    hostPlanetId: mission.targetPlanetId,
    rulesetVersion: input.rulesetVersion,
  });
  const supporterIds = supporterIdsOf(stationWaves);
  const adminPlayerIds = await adminPlayerIdsInSeason(
    tx,
    mission.seasonId,
    input.adminUsernames,
  );
  const scoreEligible = !adminPlayerIds.has(defenderPlayerId)
    && participantIds.every((playerId) => !adminPlayerIds.has(playerId))
    && supporterIds.every((playerId) => !adminPlayerIds.has(playerId));

  // Clan management owns clan rows before player rows. Settlement must take the
  // same order or a concurrent management write can form clan→player / player→clan.
  if (scoreEligible) await lockJointWarScoreClans(tx, operation);
  // A supporter's ledger never moves (owner, 2026-10-02), but `settleStations` writes their
  // row (wealth): it is taken here, in the one id order, never late after the others.
  const ledgers = await lockLedgers(tx, [...participantIds, defenderPlayerId, ...supporterIds]);
  const defender = await loadLocked(tx, mission.targetPlanetId, input.clock, {
    requireLive: false,
  });
  const defenderTech = await techOf(tx, defender.playerId);
  const defenceDark = !defenceOnline(defender.faults, defender.empUntil, defender.now);
  const defenders = garrisonOf(defender.homeFleet, defenceDark ? {} : defender.ground);

  /*
    SEEDED FROM THE MISSION, exactly as every other battle in the game: a joint
    war is re-derivable from its inputs, and a redelivered settlement would
    produce the same board (it never runs twice — `claimMission` sees to that).
  */
  /*
    TAKTİK GERİ ÇEKİLME READS THE WHOLE POOL. Owner decision, 2026-09-23. The waves
    arrive as one wing, so they are weighed together against the line — and a raid
    the ships ran from is re-resolved from this same seed against the guns alone.
  */
  const stations = await standStations(tx, {
    waves: stationWaves,
    host: defender,
    rulesetVersion: input.rulesetVersion,
    now: defender.now,
  });
  const raid = resolveRaid({
    stacks,
    line: defenders,
    shield: defenceDark ? 0 : defender.shield,
    rng: () => seededFrom(mission.id),
    defender: { tech: defenderTech },
    deuterium: defender.deuterium,
    // From ruleset 15 the world's posture decides; before it, the season's rule.
    escape: escapeAllowed(input.rulesetVersion, defender.defencePosture),
    minimumCombatShips: fleetEscapeMinimumApplies(input.rulesetVersion)
      ? ESCAPE.minimumCombatShips : 0,
    support: stations.map((station) => station.stack),
    hostPlayerId: defender.playerId,
    preciseDamage: hpRadiationApplies(input.rulesetVersion),
  });
  const result = raid.result;
  // The host's own part of the line; the waves' survivors go back to their own rows.
  const hostOutcome = result.defenders[0]!;
  const escaped: Fleet = raid.escape?.kind === 'ESCAPED' ? raid.escape.ships : {};
  const liftFuel = raid.escape?.kind === 'ESCAPED' ? raid.escape.fuel : 0;
  const stood: Fleet = {};
  for (const [hull, count] of fleetEntries(defenders)) {
    if ((escaped[hull] ?? 0) === 0) stood[hull] = count;
  }

  /* ── the defender's world ─────────────────────────────────────── */

  const defenderHome: Fleet = {};
  for (const [hull, standing] of fleetEntries(defender.homeFleet)) {
    // A ship that lifted off is as absent from the survivors as a Prospector.
    defenderHome[hull] = NON_COMBATANT_HULLS.includes(hull) || (escaped[hull] ?? 0) > 0
      ? standing
      : hostOutcome.survivors[hull] ?? 0;
  }
  for (const [hull, standing] of fleetEntries(defender.ground)) {
    defenderHome[hull] = defenceDark
      ? standing
      : (hostOutcome.survivors[hull] ?? 0) + (result.defenceSalvage[hull] ?? 0);
  }
  await setUnits(tx, defender.planetId, defenderHome, 'home');
  /*
    KALICI GEMİ HASARI, as in the raid lane: the defender's part-hit ships are judged on
    the spot, each wave carries its own home on its own return leg.
  */
  const damageRule = shipDamageApplies(input.rulesetVersion);
  const attackerDamage = damageRule ? result.attackerDamage : [];
  const defenderDamage = damageRule ? result.defenderDamage : [];
  const waveDamage = (outcome: { survivorDamage: HpDamageLot[] }): HpDamageLot[] =>
    (damageRule ? outcome.survivorDamage : []);
  const defenderDock = await dockDamaged(tx, {
    planetId: defender.planetId,
    ownerPlayerId: defender.playerId,
    lots: damageRule ? hostOutcome.survivorDamage : [],
    at: defender.now,
  });
  await settleStations(tx, { stations, outcomes: result.defenders, damageRule, now: defender.now });

  // The lift burned before anything reached a hold (see the raid lane).
  const exposedStock = {
    alloy: defender.alloy,
    crystal: defender.crystal,
    deuterium: defender.deuterium - liftFuel,
  };
  const exposedBuffer = {
    alloy: defender.bufferAlloy,
    crystal: defender.bufferCrystal,
    deuterium: defender.bufferDeuterium,
  };
  const vaultFloor = vaultProtects(
    defender.buildings.VAULT,
    defender.buildings.REFINERY,
    defender.buildings.EXTRACTOR,
    defender.buildings.DEUTERIUM_PLANT,
  );

  /*
    ONE HAUL, MEASURED AGAINST THE WHOLE SURVIVING SIDE'S HOLD.

    Every wave's cargo is read with ITS OWN owner's Cargo Holds — a joint strike
    carries what its five commanders' research says it carries, not what the
    leader's does.
  */
  const survivorCargo = result.contributions.map((outcome) => {
    const wave = liveWaves.find((row) => row.id === outcome.contributionId)!;
    return {
      playerId: outcome.playerId,
      contributionId: outcome.contributionId,
      cargo: fleetCargo(outcome.survivors, wave.tech),
    };
  });
  const totalCargo = survivorCargo.reduce((sum, share) => sum + share.cargo, 0);
  const loot = computeLoot(exposedStock, exposedBuffer, vaultFloor, result.grade, totalCargo);
  const uncappedLoot = computeLoot(
    exposedStock,
    exposedBuffer,
    vaultFloor,
    result.grade,
    Number.MAX_SAFE_INTEGER,
  );
  const lootUnits = loot.alloy + loot.crystal + loot.deuterium;
  const cargoLimited =
    uncappedLoot.alloy + uncappedLoot.crystal + uncappedLoot.deuterium > lootUnits;
  const raidableBefore = raidableStock(exposedStock, exposedBuffer, vaultFloor, 'DECISIVE');
  const shieldAbsorbed = result.rounds.reduce((sum, round) => sum + round.shieldAbsorbed, 0);

  await saveResources(tx, defender.planetId, {
    alloy: defender.alloy - loot.fromStock.alloy,
    crystal: defender.crystal - loot.fromStock.crystal,
    deuterium: exposedStock.deuterium - loot.fromStock.deuterium,
    bufferAlloy: defender.bufferAlloy - loot.fromBuffer.alloy,
    bufferCrystal: defender.bufferCrystal - loot.fromBuffer.crystal,
    bufferDeuterium: defender.bufferDeuterium - loot.fromBuffer.deuterium,
    shield: result.shieldLeft,
  });

  // The host's own permanent loss: a clanmate's wave dying does not shield the host.
  const fleetLost = permanentFleetCost(hostOutcome.losses, result.defenceSalvage);
  const recovery = await grantRecoveryShield(tx, {
    playerId: defender.playerId,
    planetId: defender.planetId,
    lootLost: { alloy: loot.alloy, crystal: loot.crystal, deuterium: loot.deuterium },
    fleetLost,
    now: defender.now,
  });
  const colonyFaults = recovery.earned
    ? await breakFaults(tx, {
      seasonId: mission.seasonId,
      planetId: defender.planetId,
      now: defender.now,
      count: FAULT.attackFaults,
      seed: `clan-war:${mission.id}`,
      lane: 'ATTACK',
      announce: false,
    })
    : [];
  const loyaltyLoss = defender.kind === 'COLONY' ? FAULT.battleLoyaltyLoss[result.grade] : 0;
  if (loyaltyLoss > 0) {
    await tx.update(planets)
      .set({ loyalty: Math.max(0, defender.loyalty - loyaltyLoss) })
      .where(eq(planets.id, defender.planetId));
    await rescheduleLoyaltyWatch(tx, {
      seasonId: mission.seasonId,
      planetId: defender.planetId,
      now: defender.now,
    });
  }

  /* ── the haul, and whose ships carry it ───────────────────────── */

  const lootShares = allocateJointLoot(
    { alloy: loot.alloy, crystal: loot.crystal, deuterium: loot.deuterium },
    survivorCargo,
  );
  const lootByContribution = new Map(lootShares.map((row) => [row.contributionId, row.resources]));

  /*
    THE WRECK, AND THE COLLECTORS THAT LIFT FROM IT. D200.

    `settleWreck` runs once against the whole side's surviving collectors, and what
    it lifts is then split by each wave's own remaining lift capacity — a wave that
    brought no Garbage Collector takes none of it, whoever owns it.
  */
  const totalRaw = flyingValue(result.attackerLosses) + flyingValue(result.defenderLosses);
  const made = totalRaw * DEBRIS.share;
  const share = (raw: number): number => (totalRaw > 0 ? made * (raw / totalRaw) : 0);
  const { salvage, field: wreck } = settleWreck(
    {
      alloy: share(flyingAlloy(result.attackerLosses) + flyingAlloy(result.defenderLosses)),
      crystal: share(flyingCrystal(result.attackerLosses) + flyingCrystal(result.defenderLosses)),
      deuterium: share(
        flyingDeuterium(result.attackerLosses) + flyingDeuterium(result.defenderLosses),
      ),
    },
    result.attackerSurvivors,
  );
  const salvageShares = allocateJointSalvage(salvage, result.contributions.map((outcome) => ({
    playerId: outcome.playerId,
    contributionId: outcome.contributionId,
    cargo: salvageCapacity(outcome.survivors),
  })));
  const salvageByContribution = new Map(
    salvageShares.map((row) => [row.contributionId, row.resources]),
  );

  /* ── score ────────────────────────────────────────────────────── */

  /*
    THE HEAD COUNT IS COMMANDERS, NOT SHIPS AND NOT WAVES. Owner decision.

    A commander who sent three waves is one attacker; a leader who sent none is
    not an attacker at all. `D` is one today — a world has one defender — and is
    stored anyway so the audit reads the same when that stops being true.
  */
  const attackerCount = participantIds.length;
  // One for the host, plus every clanmate who stood a ship in the line (Klan Savunma Desteği).
  const defenderCount = defenderCountOf(stations);
  const base = scoreEligible
    ? dominionTransfer(
      lootUnits + result.defenderLossValue - result.attackerLossValue,
      input.rulesetVersion,
    )
    : 0;
  /*
    KLAN SAVUNMA DESTEĞİ (owner, 2026-10-02): the attackers' head count against the factor
    the defending line's support brings — line power ÷ host power, at most ×5 — on the host's
    own fight, with the supporters' lost ships added at face value (`defendedTransfer`). With
    nobody supporting, the factor is 1 and this is the head-count rule exactly as it was.
  */
  const hostPower = combatValue(defenders);
  const adjusted = scoreEligible
    ? defendedTransfer(base, supportLossOf(stations, result.defenders), attackerCount, supportFactorOf(hostPower, stations))
    : 0;

  /*
    WHAT EACH COMMANDER IS OWED, AND WHY THE PARTS MUST ADD TO THE WHOLE.

    `personalRaw = their loot + the defender loss their fire caused − their own
    permanent loss`. The three columns are the SAME quantities the team exchange
    is built from, so the parts sum to the base exactly — and settlement refuses
    to commit when they do not, because a score that cannot be reproduced from its
    own report is a competitive record nobody should trust.
  */
  const lossByPlayer = new Map<string, number>();
  const lootValueByPlayer = new Map<string, number>();
  for (const outcome of result.contributions) {
    lossByPlayer.set(
      outcome.playerId,
      (lossByPlayer.get(outcome.playerId) ?? 0) + outcome.lossValue,
    );
    const taken = lootByContribution.get(outcome.contributionId) ?? NOTHING;
    lootValueByPlayer.set(
      outcome.playerId,
      (lootValueByPlayer.get(outcome.playerId) ?? 0)
        + taken.alloy + taken.crystal + taken.deuterium,
    );
  }
  const damageByPlayer = new Map<string, number>();
  for (const outcome of result.contributions) {
    damageByPlayer.set(
      outcome.playerId,
      (damageByPlayer.get(outcome.playerId) ?? 0) + outcome.hullDamage,
    );
  }
  const defenderLossShares = result.defenderLossValue > 0
    ? allocateJointDefenderLoss(
      result.defenderLossValue,
      participantIds.map((playerId) => ({
        playerId,
        damage: damageByPlayer.get(playerId) ?? 0,
      })),
    )
    : participantIds.map((playerId) => ({ playerId, value: 0 }));
  const defenderLossByPlayer = new Map(
    defenderLossShares.map((row) => [row.playerId, row.value]),
  );

  const weights = participantIds.map((playerId) => ({
    playerId,
    raw: (lootValueByPlayer.get(playerId) ?? 0)
      + (defenderLossByPlayer.get(playerId) ?? 0)
      - (lossByPlayer.get(playerId) ?? 0),
  }));
  const rawTotal = weights.reduce((sum, weight) => sum + weight.raw, 0);
  const expectedBase = lootUnits + result.defenderLossValue - result.attackerLossValue;
  if (rawTotal !== expectedBase) {
    throw new Error('joint war participant scores do not reproduce the battle exchange');
  }
  const shares = scoreEligible
    ? allocateJointDominion(adjusted, weights)
    : participantIds.map((playerId) => ({ playerId, delta: 0 }));
  /* THE DEFENDING SIDE: the host alone takes the whole opposite of the attackers' transfer. */
  const defenderShares = [{ playerId: defenderPlayerId, delta: -adjusted }];
  const deltaByPlayer = new Map(shares.map((row) => [row.playerId, row.delta]));

  if (scoreEligible) {
    for (const playerId of participantIds) {
      const ledger = ledgers.get(playerId);
      if (!ledger) throw new Error('joint war participant vanished before settlement');
      applyDelta(ledger, deltaByPlayer.get(playerId) ?? 0);
      await saveLedger(tx, ledger);
    }
    for (const share of defenderShares) {
      const ledger = ledgers.get(share.playerId);
      if (!ledger) throw new Error('joint war defender vanished before settlement');
      applyDelta(ledger, share.delta);
      await saveLedger(tx, ledger);
    }
    await recordClanScore(tx, {
      seasonId: mission.seasonId,
      missionId: mission.id,
      attackerClanId: operation.attackerScoreClanId,
      defenderClanId: operation.defenderScoreClanId,
      attackerDelta: adjusted,
      at: now,
    });
    await publishShard(tx, mission.seasonId, 'score');
  }

  /* ── the record ───────────────────────────────────────────────── */

  const [report] = await tx.insert(battleReports).values({
    seasonId: mission.seasonId,
    missionId: mission.id,
    /*
      A TECHNICAL BINDER, NOT A CLAIM ABOUT WHO FOUGHT. `attacker_player_id` is
      NOT NULL and holds one commander; the people who actually flew are in
      `clan_war_participant_results`, and the report's own reader checks THAT.
    */
    attackerPlayerId: operation.leaderPlayerId,
    defenderPlayerId: defender.playerId,
    targetPlanetId: defender.planetId,
    clanWarOperationId: operation.id,
    targetKind: 'PLAYER',
    grade: result.grade,
    rounds: result.rounds,
    loot: { alloy: loot.alloy, crystal: loot.crystal, deuterium: loot.deuterium },
    attackerLosses: result.attackerLosses,
    defenderLosses: result.defenderLosses,
    attackerFleet: aggregateOf(stacks),
    // The whole line that stood — the host's and every clanmate wave's.
    defenderFleet: lineOf(stood, stations),
    defenderCount,
    defenceSalvage: result.defenceSalvage,
    attackerDamage,
    defenderDamage,
    colonyFaults,
    fleetEscape: raid.escape,
    disruptedMinutes: 0,
    wreckValue: wreck ? wreck.alloy + wreck.crystal + wreck.deuterium : 0,
    salvage,
    cargoLimited,
    shieldAbsorbed,
    /*
      THE AGGREGATE SWING, so an older client and every ladder query read one
      number for one battle. The per-commander split lives beside it, and the two
      always agree: the shares are normalised to exactly this figure.
    */
    dominionSwing: adjusted,
    dominionRuleVersion: scoreEligible ? input.rulesetVersion : null,
    dominionLootValue: scoreEligible ? lootUnits : null,
    dominionAttackerLossValue: scoreEligible ? result.attackerLossValue : null,
    dominionDefenderLossValue: scoreEligible ? result.defenderLossValue : null,
    dominionRawExchange: scoreEligible ? base : null,
    dominionEligible: scoreEligible,
    raidableBefore: Math.round(raidableBefore),
    recoveryLossHours: recovery.hours,
    recoveryShieldUntil: recovery.until,
    createdAt: defender.now,
  }).returning({ id: battleReports.id });
  if (!report) throw new Error('clan war battle report insert returned no row');

  const sentByPlayer = new Map<string, Fleet>();
  const lostByPlayer = new Map<string, Fleet>();
  const survivedByPlayer = new Map<string, Fleet>();
  const lootByPlayer = new Map<string, Resources>();
  const salvageByPlayer = new Map<string, Resources>();
  const carriedByPlayer = new Map<string, HpDamageLot[]>();
  for (const outcome of result.contributions) {
    carriedByPlayer.set(outcome.playerId, [
      ...(carriedByPlayer.get(outcome.playerId) ?? []),
      ...waveDamage(outcome),
    ]);
    mergeInto(sentByPlayer, outcome.playerId, outcome.sent);
    mergeInto(lostByPlayer, outcome.playerId, outcome.losses);
    mergeInto(survivedByPlayer, outcome.playerId, outcome.survivors);
    addResources(
      lootByPlayer.get(outcome.playerId) ?? setDefault(lootByPlayer, outcome.playerId),
      lootByContribution.get(outcome.contributionId) ?? NOTHING,
    );
    addResources(
      salvageByPlayer.get(outcome.playerId) ?? setDefault(salvageByPlayer, outcome.playerId),
      salvageByContribution.get(outcome.contributionId) ?? NOTHING,
    );
  }

  await tx.insert(clanWarParticipantResults).values(participantIds.map((playerId) => ({
    seasonId: mission.seasonId,
    operationId: operation.id,
    reportId: report.id,
    playerId,
    sent: sentByPlayer.get(playerId) ?? {},
    losses: lostByPlayer.get(playerId) ?? {},
    survivors: survivedByPlayer.get(playerId) ?? {},
    loot: lootByPlayer.get(playerId) ?? { ...NOTHING },
    salvage: salvageByPlayer.get(playerId) ?? { ...NOTHING },
    hullDamage: damageByPlayer.get(playerId) ?? 0,
    damage: hpRadiationApplies(input.rulesetVersion)
      ? normalizeHpDamage(survivedByPlayer.get(playerId) ?? {}, carriedByPlayer.get(playerId))
      : normalizeLots(carriedByPlayer.get(playerId)),
    dominionRaw: weights.find((weight) => weight.playerId === playerId)?.raw ?? 0,
    dominionDelta: deltaByPlayer.get(playerId) ?? 0,
    createdAt: now,
  })));

  if (scoreEligible) {
    const audit: (typeof clanWarDominionEvents.$inferInsert)[] = [
      ...participantIds.map((playerId) => ({
        seasonId: mission.seasonId,
        operationId: operation.id,
        reportId: report.id,
        playerId,
        role: 'ATTACKER' as const,
        rulesetVersion: input.rulesetVersion,
        attackerCount,
        defenderCount,
        baseExchange: base,
        adjustedTransfer: adjusted,
        delta: deltaByPlayer.get(playerId) ?? 0,
        createdAt: now,
      })),
      ...defenderShares.map((share) => ({
        seasonId: mission.seasonId,
        operationId: operation.id,
        reportId: report.id,
        playerId: share.playerId,
        role: 'DEFENDER' as const,
        rulesetVersion: input.rulesetVersion,
        attackerCount,
        defenderCount,
        baseExchange: base,
        adjustedTransfer: adjusted,
        delta: share.delta,
        createdAt: now,
      })),
    ];
    await tx.insert(clanWarDominionEvents).values(audit);
  }
  if (defenderCount > 1) {
    await writeDefenderResults(tx, {
      seasonId: mission.seasonId,
      reportId: report.id,
      host: {
        playerId: defenderPlayerId,
        outcome: hostOutcome,
        power: hostPower,
        lootLost: { alloy: loot.alloy, crystal: loot.crystal, deuterium: loot.deuterium },
      },
      stations,
      outcomes: result.defenders,
      hostDelta: -adjusted,
      now,
    });
    await notifySupporters(tx, {
      missionId: mission.id,
      reportId: report.id,
      grade: result.grade,
      hostPlanetId: defender.planetId,
      hostPlanetName: defender.name,
      stations,
      outcomes: result.defenders,
      now,
    });
  }

  let wreckFieldId: string | null = null;
  if (wreck) {
    const [row] = await tx.insert(debrisFields).values({
      seasonId: mission.seasonId,
      planetId: defender.planetId,
      x: defender.x,
      y: defender.y,
      z: defender.z,
      missionId: mission.id,
      alloy: wreck.alloy,
      crystal: wreck.crystal,
      deuterium: wreck.deuterium,
      createdAt: defender.now,
    }).returning({ id: debrisFields.id });
    wreckFieldId = row?.id ?? null;
  }
  if (recovery.until) await publishShard(tx, mission.seasonId, 'protection');

  /* ── everybody flies home, to the world they left from ────────── */

  for (const outcome of result.contributions) {
    const wave = liveWaves.find((row) => row.id === outcome.contributionId)!;
    await tx.update(clanWarContributions).set({
      losses: outcome.losses,
      survivors: outcome.survivors,
      loot: lootByContribution.get(outcome.contributionId) ?? { ...NOTHING },
      salvage: salvageByContribution.get(outcome.contributionId) ?? { ...NOTHING },
      hullDamage: outcome.hullDamage,
      damage: waveDamage(outcome).length > 0 ? waveDamage(outcome) : null,
      battleAt: now,
    }).where(eq(clanWarContributions.id, wave.id));
    await planContributionReturn(tx, {
      contribution: { ...wave, status: 'IN_BATTLE' },
      operation,
      fromPlanetId: defender.planetId,
      fleet: outcome.survivors,
      now,
    });
  }
  /* A wave that had no ships left to fight was never in `stacks`; it is lost too. */
  for (const wave of waves) {
    if (liveWaves.some((live) => live.id === wave.id)) continue;
    await planContributionReturn(tx, {
      contribution: wave,
      operation,
      fromPlanetId: defender.planetId,
      fleet: {},
      now,
    });
  }
  await closeOperation(tx, { operation, reason: 'BATTLE', now });

  /* ── and everyone is told ─────────────────────────────────────── */

  await recomputeWealth(tx, defender.planetId);
  for (const playerId of participantIds) await recomputePlayerWealth(tx, playerId);

  const defenderIdentity = await identityOfPlanet(tx, defender.planetId);
  if (defenderIdentity) {
    await recordGalaxyEvent(tx, {
      seasonId: mission.seasonId,
      kind: 'bombardment',
      refId: mission.id,
      subjectPlanetId: defender.planetId,
      payload: {
        planetName: defenderIdentity.planetName,
        commanderName: defenderIdentity.username,
      },
      occurredAt: defender.now,
    });
    if (wreckFieldId) {
      await recordGalaxyEvent(tx, {
        seasonId: mission.seasonId,
        kind: 'wreck_formed',
        refId: wreckFieldId,
        subjectPlanetId: defender.planetId,
        payload: {
          planetName: defenderIdentity.planetName,
          commanderName: defenderIdentity.username,
        },
        occurredAt: defender.now,
      });
    }
  }

  await notify(tx, {
    playerId: defender.playerId,
    kind: 'raided',
    payload: {
      /*
        THE DEFENDER IS TOLD WHO CAME, AND IT IS A CLAN. The identity a joint
        strike wears in traffic is the clan's; the notification says the same
        thing rather than naming one commander out of five.
      */
      originClanTag: operation.clanTag,
      grade: result.grade,
      lootAlloy: loot.alloy,
      lootCrystal: loot.crystal,
      lootDeuterium: loot.deuterium,
      unitsLost: fleetCount(hostOutcome.losses),
      theirLosses: fleetCount(result.attackerLosses),
      attackers: attackerCount,
      ...(raid.escape
        ? { escape: raid.escape.kind, escapeShips: fleetCount(raid.escape.ships) }
        : {}),
      ...dockNotice(defenderDock),
      disruptedMinutes: 0,
    },
    at: defender.now,
    refId: mission.id,
  });

  for (const playerId of participantIds) {
    await notify(tx, {
      playerId,
      kind: 'raid_result',
      payload: {
        grade: result.grade,
        targetPlanetId: defender.planetId,
        targetUsername: defenderIdentity?.username ?? 'someone',
        targetPlanetName: defender.name,
        ...(defenderIdentity?.clanTag ? { targetClanTag: defenderIdentity.clanTag } : {}),
        clanWarOperationId: operation.id,
        lootAlloy: lootByPlayer.get(playerId)?.alloy ?? 0,
        lootCrystal: lootByPlayer.get(playerId)?.crystal ?? 0,
        lootDeuterium: lootByPlayer.get(playerId)?.deuterium ?? 0,
        unitsLost: fleetCount(lostByPlayer.get(playerId) ?? {}),
        shipsHome: fleetCount(survivedByPlayer.get(playerId) ?? {}),
        dominion: deltaByPlayer.get(playerId) ?? 0,
        ...(raid.escape?.kind === 'ESCAPED' ? { targetFled: true } : {}),
        // Flying home damaged; the Repair Station judges them where each wave lands.
        ...(shipsIn(carriedByPlayer.get(playerId) ?? []) > 0
          ? { damaged: shipsIn(carriedByPlayer.get(playerId) ?? []) }
          : {}),
      },
      at: defender.now,
      refId: mission.id,
    });
    await rememberVisitedWorld(tx, {
      observerPlayerId: playerId,
      targetPlanetId: mission.targetPlanetId,
      seasonId: mission.seasonId,
      seenAt: defender.now,
    });
    await announceUnlocks(tx, playerId, defender.now);
  }
  /*
    THE COORDINATOR WHO SENT NO HULLS IS TOLD TOO, and exactly once. They chose
    the target and pulled the trigger; a result they have to go looking for is a
    decision with no feedback. A leader who DID fly is already in the loop above.
  */
  if (!participantIds.includes(operation.leaderPlayerId)) {
    await notify(tx, {
      playerId: operation.leaderPlayerId,
      kind: 'raid_result',
      payload: {
        grade: result.grade,
        targetPlanetId: defender.planetId,
        targetUsername: defenderIdentity?.username ?? 'someone',
        targetPlanetName: defender.name,
        clanWarOperationId: operation.id,
        coordinator: true,
        lootAlloy: loot.alloy,
        lootCrystal: loot.crystal,
        lootDeuterium: loot.deuterium,
        unitsLost: fleetCount(result.attackerLosses),
        shipsHome: fleetCount(result.attackerSurvivors),
        dominion: adjusted,
        ...(raid.escape?.kind === 'ESCAPED' ? { targetFled: true } : {}),
      },
      at: defender.now,
      refId: mission.id,
    });
  }
  await announceUnlocks(tx, defender.playerId, defender.now);
  await rememberVisitedWorld(tx, {
    observerPlayerId: operation.leaderPlayerId,
    targetPlanetId: mission.targetPlanetId,
    seasonId: mission.seasonId,
    seenAt: defender.now,
  });
}

/* ── helpers ────────────────────────────────────────────────────── */

const setDefault = (into: Map<string, Resources>, key: string): Resources => {
  const fresh = { ...NOTHING };
  into.set(key, fresh);
  return fresh;
};

function mergeInto(into: Map<string, Fleet>, key: string, fleet: Fleet): void {
  const target = into.get(key) ?? {};
  for (const [hull, n] of fleetEntries(fleet)) target[hull] = (target[hull] ?? 0) + n;
  into.set(key, target);
}

const aggregateOf = (stacks: readonly JointAttackerStack[]): Fleet => {
  const total: Fleet = {};
  for (const stack of stacks) {
    for (const [hull, n] of fleetEntries(stack.fleet)) total[hull] = (total[hull] ?? 0) + n;
  }
  return total;
};


/** The pool turns round without a shot: no loot, no score, no report. */
async function returnPoolUntouched(
  tx: Tx,
  input: {
    operation: ClanWarOperationRow;
    waves: (typeof clanWarContributions.$inferSelect)[];
    now: Date;
    reason: 'TARGET_CHANGED' | 'FAILED';
  },
): Promise<void> {
  for (const wave of input.waves) {
    await planContributionReturn(tx, {
      contribution: wave,
      operation: input.operation,
      fromPlanetId: clanWarPlanetTarget(input.operation).planetId,
      fleet: await fleetOfContribution(tx, wave),
      now: input.now,
    });
  }
  await closeOperation(tx, { operation: input.operation, reason: input.reason, now: input.now });
}

/**
 * THE CLAN LADDER, ONCE PER OPERATION AND ON THE OPERATION'S OWN SNAPSHOT.
 *
 * Read from `clan_war_operations` rather than from `attack_commitments`, which
 * now holds one row per participating commander: guessing a clan out of five rows
 * is exactly the ambiguity the snapshot exists to remove.
 */
async function recordClanScore(
  tx: Tx,
  input: {
    seasonId: string;
    missionId: string;
    attackerClanId: string | null;
    defenderClanId: string | null;
    attackerDelta: number;
    at: Date;
  },
): Promise<void> {
  const rows: (typeof clanScoreEvents.$inferInsert)[] = [];
  if (input.attackerClanId !== null) {
    rows.push({
      seasonId: input.seasonId,
      missionId: input.missionId,
      clanId: input.attackerClanId,
      side: 'ATTACK',
      dominionDelta: input.attackerDelta,
      createdAt: input.at,
    });
  }
  if (input.defenderClanId !== null) {
    rows.push({
      seasonId: input.seasonId,
      missionId: input.missionId,
      clanId: input.defenderClanId,
      side: 'DEFENCE',
      dominionDelta: -input.attackerDelta,
      createdAt: input.at,
    });
  }
  if (rows.length === 0) return;
  /*
    THE CACHE MOVES ONLY FOR EVENTS THAT WERE ACTUALLY WRITTEN.

    `clan_score_events` is unique on `(mission, clan, side)`, so a second delivery
    inserts nothing — and updating the cached counters unconditionally would then
    pay the clan twice for one battle. The insert's own `RETURNING` is the only
    honest answer to "did this happen".
  */
  const written = await tx
    .insert(clanScoreEvents)
    .values(rows)
    .onConflictDoNothing()
    .returning({ clanId: clanScoreEvents.clanId, delta: clanScoreEvents.dominionDelta });
  for (const row of written) {
    const [clan] = await tx.select().from(clans).where(eq(clans.id, row.clanId)).for('update');
    if (!clan) continue;
    await tx.update(clans).set(row.delta >= 0
      ? { dominionTaken: addDominionCounters(clan.dominionTaken, row.delta, 'Clan Dominion') }
      : { dominionLost: addDominionCounters(clan.dominionLost, -row.delta, 'Clan Dominion') })
      .where(eq(clans.id, row.clanId));
  }
}
