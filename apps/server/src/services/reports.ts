import { and, desc, eq, inArray, or } from 'drizzle-orm';
import {
  PIRATE,
  deuteriumOf,
  type CombatRound,
  type Fleet,
  type Grade,
  type HullId,
  type PirateLevel,
  type Resources,
} from '@astera/rules';
import type { Db, Tx } from '../db/client.js';
import {
  accounts,
  attackCommitments,
  battleReports,
  clans,
  missions,
  pirateRaids,
  planets,
  players,
  seasons,
  strategicImpacts,
  strategicInterceptions,
  type StrategicDestroyedOrder,
  type StrategicLevelChange,
} from '../db/schema.js';
import { pirateCallsign, privatePirateField } from './pirateField.js';

/**
 * BATTLE REPORTS — the closing link of the loop.
 *
 * `game-design.md` calls this "the most accurate intel in the game", and step 9 of
 * the core loop feeds step 3: every fight teaches you something about a person you
 * will fight again. Until now the reports were written and never shown. Combat
 * happened, a one-line summary appeared in the return overlay, and nothing a
 * player learned from it survived into their next decision.
 *
 * WHAT EACH SIDE MAY SEE. Both participants get the same facts, because both were
 * there: the grade, how many rounds it ran, what each side lost, and what moved.
 * That includes the opponent's name — being raided reveals the raider, and that is
 * the counterplay, not a leak. What it deliberately does NOT include is anything
 * about what the loser still HAS: losses are ground truth, survivors are not
 * disclosed. A report tells you what someone brought, not what they kept.
 *
 * D121 ADDED DETAIL WITHOUT MOVING THAT LINE, and the line is what made the pass
 * awkward: everything a player complained about missing — how big the force was
 * that took those losses, what the shield did, what a knocked-out works cost, how
 * many guns walked back out of their own wreckage — is a fact about ONE side.
 * So each of them is served from the CALLER's row and never from the opponent's.
 * `yourFleet` minus `yourLosses` is the caller's own survivors, which they may
 * have; the identical subtraction on the opponent's roster is precisely the
 * disclosure the fog exists to refuse, so the opponent's roster is not in the
 * payload at all. The fog is enforced HERE, in the query, not in the component.
 */

export interface BattleReportView {
  kind: 'BATTLE';
  id: string;
  /**
   * Mission identity links the notification that announced this fight to its report.
   *
   * NULL on a pirate battle, which has no mission — see `pirateRaidId`. The two
   * are the report's deep link, and Signals matches on whichever is present.
   */
  missionId: string | null;
  /** The pirate raid this settles, when there was no world on the other side. D150. */
  pirateRaidId: string | null;
  /**
   * WHAT WAS ON THE OTHER SIDE WHEN IT WAS NOT A COMMANDER. D150.
   *
   * Structured rather than a sentence, because the sentence belongs to the client's
   * locale files. `opponentName` still carries a plain fallback for the same reason
   * "someone" does, but a client that knows about pirates renders this instead.
   */
  pirate: {
    level: PirateLevel;
    callsign: string;
    /**
     * THE ONE COMBAT MODIFIER IN THE FIGHT, so the damage above can be read.
     *
     * A pirate's whole difference from a player fleet of the same roster is a
     * per-level cut to its ATTACK (D150) — it is why a level 1 crew hits for half
     * and a level 4 crew almost does not flinch. Reporting the damage without it
     * asks the reader to check the arithmetic against a rule the interface never
     * states, which is exactly what D124 refuses.
     *
     * Derived from the level, which is already here, so it discloses nothing new.
     */
    damageMult: number;
    /**
     * THE SHIP THAT CAME HOME WITH THEM, on a DECISIVE win. NULL otherwise.
     *
     * The only door in this game into a hull you did not build, and it reached the
     * player as a toast and a `fleet_returned` line — both gone by the time anyone
     * opens the report, which is where a commander goes to find out what a fight
     * was worth. Read off `pirate_raids.captured_hull`, which was already stored
     * and already joined: nothing but the reading was missing.
     */
    capturedHull: HullId | null;
  } | null;
  at: Date;
  grade: Grade;
  /** The blow-by-blow. Null calculation fields identify a report from before D121a telemetry. */
  rounds: BattleReportRoundView[];
  /** True when the caller was the one who launched. */
  attacking: boolean;
  opponentName: string;
  opponentPlanet: string;
  /** Stable identity for dossier matching; null only when the seasonal world vanished. */
  opponentPlanetId: string | null;
  /**
   * THE CALLER'S OWN WORLD IN THIS BATTLE — where they launched from, or what was
   * hit.
   *
   * With one world per commander it was implicit. D97 gave a commander up to four,
   * and "Raided by Sable" stopped saying WHICH of their worlds — the most
   * actionable fact there is, missing from the record of it. Empty string only
   * where that world no longer exists, and the client omits the line.
   */
  yourPlanet: string;
  /**
   * True when the other side was an unclaimed world rather than a commander.
   *
   * There is nobody to name, and saying "someone at an unknown world" about the
   * caretaker garrison of a world with a name on the map was the report calling
   * its own most-accurate-intel claim into question.
   */
  neutral: boolean;
  /** What the caller lost, and what the caller destroyed. */
  yourLosses: Fleet;
  theirLosses: Fleet;
  /**
   * THE CALLER'S OWN BOARD WHEN THE SHOOTING STARTED — never the opponent's.
   *
   * The attacker's committed squadron; the defender's home fleet and ground guns
   * together. Empty on a report written before D121, and the client omits the
   * section rather than drawing a roster of nothing.
   */
  yourFleet: Fleet;
  /** Positive when the caller gained; negative when it was taken from them. */
  lootAlloy: number;
  lootCrystal: number;
  lootDeuterium: number;
  /**
   * The ledger movement this battle produced for the caller.
   *
   * Null on reports written before it was recorded — the client omits the line
   * rather than showing a figure it would have had to guess.
   */
  dominion: number | null;
  /** Damage the defender's Aegis soaked before anything reached a hull. Both sides watched it. */
  shieldAbsorbed: number;
  /** Immutable Aegis charge at contact and after the last round; null on legacy reports. */
  shieldBefore: number | null;
  shieldAfter: number | null;
  /**
   * The attacker's holds, not the defender's stock, capped the haul. D94.
   *
   * Already stored and never shown, which is the whole complaint: an attacker who
   * flew home under-loaded had no way to learn that the answer was more Haulers.
   * Attacker-only — it is a fact about their cargo, and the defender's copy of it
   * is `false` rather than a figure about somebody else's fleet.
   */
  cargoLimited: boolean;
  /**
   * Ground units rebuilt free from their own wreckage. DEFENDER ONLY.
   *
   * Ground defence is durable by design (60% salvage) and nothing in the game had
   * ever said so out loud, so "you lost 7 Bastions" read as seven gone forever.
   */
  defenceSalvage: Fleet;
  /**
   * Minutes the defender's works stand offline after this battle, from its instant.
   * Zero when the grade caused no disruption — a repelled raid never reports any.
   */
  disruptedMinutes: number;
  /** What the fight left in orbit for whoever gets there first. Zero when no field formed. */
  wreckValue: number;
  /** Public identities frozen when the attack left, not mutable current membership. */
  attackerClan: { id: string; name: string; tag: string } | null;
  defenderClan: { id: string; name: string; tag: string } | null;
}

type BattleReportRoundView = Omit<
  CombatRound,
  'attackerRoll' | 'defenderRoll' | 'shieldBefore' | 'shieldAfter' | 'attackerHullDamage'
> & {
  attackerRoll: number | null;
  defenderRoll: number | null;
  shieldBefore: number | null;
  shieldAfter: number | null;
  attackerHullDamage: number | null;
};

export interface StrategicReportView {
  kind: 'STRATEGIC';
  id: string;
  missionId: string;
  at: Date;
  attacking: boolean;
  opponentName: string;
  opponentPlanet: string;
  opponentPlanetId: string | null;
  yourPlanet: string;
  outcome: 'FIRST_STRIKE' | 'CAPTURED' | 'INEFFECTIVE' | 'INTERCEPTED';
  damage: number;
  destroyedFleet: Fleet;
  destroyedResources: Resources;
  levelChanges: StrategicLevelChange[];
  destroyedOrders: StrategicDestroyedOrder[];
  shieldDestroyed: number;
  trigger: 'RADAR' | 'TELESCOPE' | null;
  attackerClan: null;
  defenderClan: null;
}

export type ReportView = BattleReportView | StrategicReportView;

export interface RivalSummaryView {
  planetId: string;
  playerId: string;
  battles: number;
  attacks: number;
  defences: number;
  dominionGained: number;
  dominionLost: number;
  lastInteractionAt: Date;
  /** What was last confirmed destroyed, a floor on what they fielded. */
  lastKnownFleet: Fleet | null;
  lastKnownAt: Date | null;
}

export async function readBattleReports(
  db: Db,
  playerId: string,
  limit = 20,
): Promise<{ reports: ReportView[]; rivals: RivalSummaryView[] }> {
  return db.transaction(
    (tx) => readBattleReportsIn(tx, playerId, limit),
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}

async function readBattleReportsIn(
  tx: Tx,
  playerId: string,
  limit: number,
): Promise<{ reports: ReportView[]; rivals: RivalSummaryView[] }> {
  const mine = or(
    eq(battleReports.attackerPlayerId, playerId),
    eq(battleReports.defenderPlayerId, playerId),
  );
  const impactMine = or(
    eq(strategicImpacts.attackerPlayerId, playerId),
    eq(strategicImpacts.defenderPlayerId, playerId),
  );
  const [rows, history, impacts] = await Promise.all([
    tx
      .select()
      .from(battleReports)
      .where(mine)
      .orderBy(desc(battleReports.createdAt))
      .limit(Math.min(limit, 50)),
    // The full-season aggregate does not drag every combat round and loot JSON
    // through memory. Only the identity, ledger and observed-loss fields matter.
    tx
      .select({
        attackerPlayerId: battleReports.attackerPlayerId,
        defenderPlayerId: battleReports.defenderPlayerId,
        attackerLosses: battleReports.attackerLosses,
        defenderLosses: battleReports.defenderLosses,
        dominionSwing: battleReports.dominionSwing,
        createdAt: battleReports.createdAt,
      })
      .from(battleReports)
      .where(mine)
      .orderBy(desc(battleReports.createdAt)),
    tx
      .select()
      .from(strategicImpacts)
      .where(impactMine)
      .orderBy(desc(strategicImpacts.createdAt)),
  ]);

  if (history.length === 0 && impacts.length === 0) return { reports: [], rivals: [] };

  /*
    ONLY THE ROWS THAT HAVE A MISSION. A pirate report's `missionId` is NULL, and
    `inArray(column, [..., null])` is neither valid Drizzle nor valid SQL — a NULL
    in an IN list matches nothing and would have silently emptied the clan lookup
    for every other report on the page.
  */
  const missionIds = rows
    .map((row) => row.missionId)
    .filter((id): id is string => id !== null);
  const commitments = missionIds.length === 0
    ? []
    : await tx
        .select({
          missionId: attackCommitments.missionId,
          attackerClanId: attackCommitments.attackerClanId,
          defenderClanId: attackCommitments.defenderClanId,
        })
        .from(attackCommitments)
        .where(inArray(attackCommitments.missionId, missionIds));
  const clanIds = [...new Set(commitments.flatMap((commitment) => [
    commitment.attackerClanId,
    commitment.defenderClanId,
  ]).filter((id): id is string => id !== null))];
  const clanRows = clanIds.length === 0
    ? []
    : await tx.select({ id: clans.id, name: clans.name, tag: clans.tag })
        .from(clans).where(inArray(clans.id, clanIds));
  const clanById = new Map(clanRows.map((clan) => [clan.id, clan]));
  const commitmentByMission = new Map(commitments.map((commitment) => [
    commitment.missionId,
    commitment,
  ]));

  // One query for every opponent rather than one per report.
  const opponentIds = history
    .map((r) => r.attackerPlayerId === playerId ? r.defenderPlayerId : r.attackerPlayerId)
    .concat(impacts.map((r) =>
      r.attackerPlayerId === playerId ? r.defenderPlayerId : r.attackerPlayerId))
    .filter((id): id is string => id !== null);
  const opponents = await tx
    .select({ id: players.id, name: accounts.displayName, planet: planets.name, planetId: planets.id })
    .from(players)
    .innerJoin(
      planets,
      and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')),
    )
    .innerJoin(accounts, eq(players.accountId, accounts.id))
    .where(inArray(players.id, opponentIds));
  const byId = new Map(opponents.map((o) => [o.id, o]));

  /**
   * THE WORLD EACH BATTLE WAS ACTUALLY FOUGHT OVER.
   *
   * The opponent join above finds a commander's CAPITAL, because that is how this
   * game identifies a person. For the DEFENDER's copy of a report that is the
   * right answer and a deliberate one — a raider is named by their home world
   * everywhere else too, including the `raided` notification.
   *
   * For the ATTACKER's copy it was wrong, and wrong in a way that got worse as
   * D97 landed: raid somebody's colony and the report said their CAPITAL "did not
   * hold". Worse than a misleading sentence, `opponentPlanetId` is what the
   * dossier matches on (`fieldedAtLeast`), so the fleet destroyed at a colony was
   * being filed against the capital — a floor on the wrong world's defences.
   *
   * It also subsumes the neutral case, which needed this lookup anyway: a
   * caretaker world has no `defenderPlayerId`, fell straight through the join, and
   * read "someone" at "an unknown world" about a world with a name on the map.
   *
   * One query for every target in the page, not one per report.
   */
  /**
   * AND THE CALLER'S OWN WORLD IN EACH BATTLE, which the report could not name.
   *
   * With one world per commander this was implicit. D97 gave a commander up to
   * four, and "Raided by Sable" stopped telling a defender WHICH of their worlds
   * was hit — the single most actionable fact in the notification, missing from
   * the record of it. The defender's world is `targetPlanetId`; the attacker's is
   * the mission's origin, which is why the launch rows are read here.
   */
  const launchIds = [...missionIds, ...impacts.map((row) => row.missionId)];
  const originByMission = launchIds.length === 0
      ? new Map<string, string>()
      : new Map(
        (await tx
          .select({ id: missions.id, originPlanetId: missions.originPlanetId })
          .from(missions)
          .where(inArray(missions.id, launchIds)))
          .map((row) => [row.id, row.originPlanetId]),
      );

  /**
   * A PIRATE BATTLE STILL HAS ONE WORLD IN IT: the one that launched. D150.
   *
   * The half of the report the reader can act on is "which of MY worlds did this",
   * and a pirate raid answers that from its own origin rather than from a mission.
   * The pirate's level and callsign come off the season lane, which is derived —
   * nothing about it is stored on the report.
   */
  const raidIds = rows
    .map((row) => row.pirateRaidId)
    .filter((id): id is string => id !== null);
  const raidRows = raidIds.length === 0
    ? []
    : await tx
        .select({
          id: pirateRaids.id,
          planetId: pirateRaids.planetId,
          pirateIndex: pirateRaids.pirateIndex,
          capturedHull: pirateRaids.capturedHull,
          asteroidKey: seasons.asteroidKey,
        })
        .from(pirateRaids)
        .innerJoin(seasons, eq(seasons.id, pirateRaids.seasonId))
        .where(inArray(pirateRaids.id, raidIds));
  const raidById = new Map(raidRows.map((raid) => {
    const spec = privatePirateField(raid.asteroidKey)[raid.pirateIndex];
    return [raid.id, {
      planetId: raid.planetId,
      level: spec?.level ?? null,
      callsign: pirateCallsign(raid.asteroidKey, raid.pirateIndex),
      capturedHull: raid.capturedHull,
    }];
  }));

  const named = [...new Set([
    ...rows.map((row) => row.targetPlanetId),
    ...impacts.map((row) => row.targetPlanetId),
    ...originByMission.values(),
    ...raidRows.map((raid) => raid.planetId),
  ])].filter((id): id is string => id !== null);
  const worldNames = named.length === 0
    ? []
    : await tx
        .select({ id: planets.id, name: planets.name })
        .from(planets)
        .where(inArray(planets.id, named));
  const targetById = new Map(worldNames.map((world) => [world.id, world.name]));

  const viewOf = (row: (typeof rows)[number]): BattleReportView => {
    const attacking = row.attackerPlayerId === playerId;
    const opponentId = attacking ? row.defenderPlayerId : row.attackerPlayerId;
    const opponent = opponentId === null ? undefined : byId.get(opponentId);
    const neutral = row.targetKind === 'NEUTRAL';
    /*
      THE THIRD SHAPE. There is no world and no commander on the other side, so
      every field that names one has to answer something honest rather than reach
      through a null — a report that draws an empty box is worse than no report.
    */
    const raid = row.pirateRaidId === null ? undefined : raidById.get(row.pirateRaidId);

    const yourLosses = attacking ? row.attackerLosses : row.defenderLosses;
    const theirLosses = attacking ? row.defenderLosses : row.attackerLosses;
    /**
     * Dominion, read from the report rather than derived.
     *
     * The stored figure is the attacker's movement as the ledger actually took it.
     * Deriving it here from the loss lists would overstate it whenever ground
     * defence died, because a battle's `defenderLossValue` is net of the 60% that
     * salvages back — and a report that disagrees with the ladder is worse than a
     * report with one fewer line on it.
     */
    const dominion =
      row.dominionSwing === null ? null : attacking ? row.dominionSwing : -row.dominionSwing;
    const commitment = row.missionId === null
      ? undefined
      : commitmentByMission.get(row.missionId);
    const rounds: BattleReportRoundView[] = row.rounds.map((round) => ({
      ...round,
      // JSON reports are immutable. Missing means the battle predates detailed
      // calculation telemetry; null is honest where reconstructing would guess.
      attackerRoll: round.attackerRoll ?? null,
      defenderRoll: round.defenderRoll ?? null,
      shieldBefore: round.shieldBefore ?? null,
      shieldAfter: round.shieldAfter ?? null,
      attackerHullDamage: round.attackerHullDamage ?? null,
      // JSON reports written before Fleet V2 used the specialist's old product
      // name. Read it once at the persistence boundary; every response is current.
      shieldBreakerDamage: (() => {
        const stored = round as unknown as Record<string, unknown>;
        const current = stored.shieldBreakerDamage;
        if (typeof current === 'number') return current;
        const legacy = stored.breacherShieldDamage;
        return typeof legacy === 'number' ? legacy : 0;
      })(),
    }));
    const firstRound = rounds[0];
    const lastRound = rounds.at(-1);

    return {
      kind: 'BATTLE',
      id: row.id,
      missionId: row.missionId,
      pirateRaidId: row.pirateRaidId,
      /*
        THE CAPTURE IS WRITTEN AFTER THE REPORT AND READ WITH IT.

        `settleArrival` files this report and only then hands the towed hull to
        `turnForHome`, so the column is still null at the instant the row is
        created. It is joined at READ time, which is the only time anybody looks —
        so the report states the prize without the report needing to store it.
      */
      pirate: raid && raid.level !== null
        ? {
            level: raid.level,
            callsign: raid.callsign,
            damageMult: PIRATE.damageMult[raid.level],
            capturedHull: raid.capturedHull,
          }
        : null,
      at: row.createdAt,
      grade: row.grade,
      rounds,
      attacking,
      opponentName: raid
        ? `Pirate L${String(raid.level ?? '?')}-${raid.callsign}`
        : opponent?.name ?? 'someone',
      /*
        THE ATTACKER IS SHOWN THE WORLD THEY RAIDED; THE DEFENDER, THE WORLD THE
        RAID CAME FROM. Both are "the other side's world in this battle", which is
        what the field means — and only one of them is the opponent's capital.
      */
      opponentPlanet: raid
        ? ''
        : attacking
          ? (row.targetPlanetId === null ? undefined : targetById.get(row.targetPlanetId))
            ?? opponent?.planet ?? 'an unknown world'
          : opponent?.planet ?? 'an unknown world',
      // Null on a pirate row on purpose: the dossier matches worlds, and there is
      // no world here to file a floor against.
      opponentPlanetId: raid
        ? null
        : attacking
          ? row.targetPlanetId
          : opponent?.planetId ?? null,
      // Which of the CALLER's worlds this was: the one they launched from, or the
      // one that was hit. Empty only where the world has since ceased to exist.
      yourPlanet: raid
        ? targetById.get(raid.planetId) ?? ''
        : attacking
          ? targetById.get(originByMission.get(row.missionId ?? '') ?? '') ?? ''
          : targetById.get(row.targetPlanetId ?? '') ?? '',
      neutral,
      yourLosses,
      theirLosses,
      yourFleet: attacking ? row.attackerFleet : row.defenderFleet,
      // Signed from the caller's side: what you took, or what was taken.
      lootAlloy: attacking ? row.loot.alloy : -row.loot.alloy,
      lootCrystal: attacking ? row.loot.crystal : -row.loot.crystal,
      lootDeuterium: attacking ? deuteriumOf(row.loot) : -deuteriumOf(row.loot),
      dominion,
      shieldAbsorbed: row.shieldAbsorbed,
      shieldBefore: firstRound?.shieldBefore ?? null,
      shieldAfter: lastRound?.shieldAfter ?? null,
      // Two facts that belong to ONE side, so the other is told nothing rather
      // than handed a figure about somebody else's fleet or somebody else's guns.
      cargoLimited: attacking && row.cargoLimited,
      defenceSalvage: attacking ? {} : row.defenceSalvage,
      /*
        These two go to both, and neither is a disclosure. Downtime is a pure
        function of the grade, which both sides already have; the wreckage is a
        public field anyone in the galaxy can fly to.
      */
      disruptedMinutes: row.disruptedMinutes,
      wreckValue: row.wreckValue,
      attackerClan: commitment?.attackerClanId
        ? clanById.get(commitment.attackerClanId) ?? null
        : null,
      defenderClan: commitment?.defenderClanId
        ? clanById.get(commitment.defenderClanId) ?? null
        : null,
    };
  };

  const interceptionRows = impacts.length === 0
    ? []
    : await tx
        .select({
          missionId: strategicInterceptions.missionId,
          trigger: strategicInterceptions.trigger,
        })
        .from(strategicInterceptions)
        .where(inArray(strategicInterceptions.missionId, impacts.map((row) => row.missionId)));
  const triggerByMission = new Map(interceptionRows.map((row) => [row.missionId, row.trigger]));
  const strategicViewOf = (impact: (typeof impacts)[number]): StrategicReportView => {
    const attacking = impact.attackerPlayerId === playerId;
    const opponentId = attacking ? impact.defenderPlayerId : impact.attackerPlayerId;
    const opponent = opponentId === null ? undefined : byId.get(opponentId);
    return {
      kind: 'STRATEGIC',
      id: impact.id,
      missionId: impact.missionId,
      at: impact.createdAt,
      attacking,
      opponentName: opponent?.name ?? 'someone',
      opponentPlanet: attacking
        ? targetById.get(impact.targetPlanetId) ?? opponent?.planet ?? 'an unknown world'
        : opponent?.planet ?? 'an unknown world',
      opponentPlanetId: attacking ? impact.targetPlanetId : opponent?.planetId ?? null,
      yourPlanet: attacking
        ? targetById.get(originByMission.get(impact.missionId) ?? '') ?? ''
        : targetById.get(impact.targetPlanetId) ?? '',
      outcome: impact.outcome,
      damage: impact.damage,
      destroyedFleet: impact.destroyedFleet,
      destroyedResources: impact.destroyedResources,
      levelChanges: impact.levelChanges,
      destroyedOrders: impact.destroyedOrders,
      shieldDestroyed: impact.shieldDestroyed,
      trigger: triggerByMission.get(impact.missionId) ?? null,
      attackerClan: null,
      defenderClan: null,
    };
  };

  const rivals = new Map<string, RivalSummaryView>();
  for (const row of history) {
    const attacking = row.attackerPlayerId === playerId;
    const opponentId = attacking ? row.defenderPlayerId : row.attackerPlayerId;
    const opponent = opponentId === null ? undefined : byId.get(opponentId);
    if (!opponent) continue;
    const signed = row.dominionSwing === null ? 0 : attacking ? row.dominionSwing : -row.dominionSwing;
    const theirs = attacking ? row.defenderLosses : row.attackerLosses;
    const hasKnownFleet = Object.values(theirs).some((count) => count > 0);
    const current = rivals.get(opponent.planetId);
    if (!current) {
      rivals.set(opponent.planetId, {
        planetId: opponent.planetId,
        playerId: opponent.id,
        battles: 1,
        attacks: attacking ? 1 : 0,
        defences: attacking ? 0 : 1,
        dominionGained: Math.max(0, signed),
        dominionLost: Math.max(0, -signed),
        lastInteractionAt: row.createdAt,
        lastKnownFleet: hasKnownFleet ? theirs : null,
        lastKnownAt: hasKnownFleet ? row.createdAt : null,
      });
      continue;
    }
    current.battles += 1;
    current.attacks += attacking ? 1 : 0;
    current.defences += attacking ? 0 : 1;
    current.dominionGained += Math.max(0, signed);
    current.dominionLost += Math.max(0, -signed);
    // Rows are newest-first: fill this once with the latest useful composition.
    if (current.lastKnownFleet === null && hasKnownFleet) {
      current.lastKnownFleet = theirs;
      current.lastKnownAt = row.createdAt;
    }
  }

  for (const impact of impacts) {
    const attacking = impact.attackerPlayerId === playerId;
    const opponentId = attacking ? impact.defenderPlayerId : impact.attackerPlayerId;
    const opponent = opponentId === null ? undefined : byId.get(opponentId);
    if (!opponent) continue;
    const theirs = attacking ? impact.destroyedFleet : {};
    const hasKnownFleet = Object.values(theirs).some((count) => count > 0);
    const current = rivals.get(opponent.planetId);
    if (!current) {
      rivals.set(opponent.planetId, {
        planetId: opponent.planetId,
        playerId: opponent.id,
        battles: 1,
        attacks: attacking ? 1 : 0,
        defences: attacking ? 0 : 1,
        dominionGained: 0,
        dominionLost: 0,
        lastInteractionAt: impact.createdAt,
        lastKnownFleet: hasKnownFleet ? theirs : null,
        lastKnownAt: hasKnownFleet ? impact.createdAt : null,
      });
      continue;
    }
    current.battles += 1;
    current.attacks += attacking ? 1 : 0;
    current.defences += attacking ? 0 : 1;
    if (impact.createdAt > current.lastInteractionAt) current.lastInteractionAt = impact.createdAt;
    if (hasKnownFleet && (!current.lastKnownAt || impact.createdAt > current.lastKnownAt)) {
      current.lastKnownFleet = theirs;
      current.lastKnownAt = impact.createdAt;
    }
  }

  const reports: ReportView[] = [
    ...rows.map(viewOf),
    ...impacts.map(strategicViewOf),
  ]
    .toSorted((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, Math.min(limit, 50));
  return { reports, rivals: [...rivals.values()] };
}
