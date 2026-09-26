import { useDeferredValue, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  combatValue,
  dominantClass,
  escapeLine,
  escapeVerdict,
  fleetCount,
  fleetEscapeApplies,
  fleetEscapeMinimumApplies,
  ESCAPE,
  forecastLines,
  forecastLoss,
  matchupsAgainst,
  shieldHp,
  wallKnowledgeOf,
  type Fleet,
  type ForecastInput,
  type TechLevels,
} from '@astera/rules';
import type { IntelView, Report } from '../api/schemas.js';
import { combatClassLabel } from '../i18n/names.js';
import { serverNow } from './clock.js';
import { fieldedAtLeast, sourceLabel } from './dossier.js';
import { matchupHint } from './matchup.js';
import type { ForceReading } from '../ui/ForceCompare.js';
import type { LaunchTarget } from '../screens/LaunchSheet.js';

/**
 * WHAT IS KNOWN ABOUT THE TARGET, MEASURED AGAINST ONE WING. F3.5a.
 *
 * Lifted verbatim out of `useLaunchPlan` so the launch and the target dossier (E2) read one
 * statement of it: the probe's band on the wing's axis, the forecast lines, the counter
 * matchups and their hint, the loss band, the escape line and the notes on what the lines
 * could not see. The launch passes the fleet being packed; the dossier passes what stands
 * home and could be sent. It draws nothing and fetches nothing.
 */
export function useTargetReading({
  target,
  intel,
  reports,
  tech,
  wing,
  rulesetVersion,
}: {
  target: LaunchTarget;
  intel?: IntelView | undefined;
  reports: readonly Report[];
  /** The commander's research, frozen into the forecast (`flightModifiers(planet).tech`). */
  tech: TechLevels;
  wing: Fleet;
  /** The season's ruleset, which decides whether the escape rule applies. */
  rulesetVersion: number;
}) {
  const { t } = useTranslation();

  /**
   * WHAT IS STANDING AT THE TARGET, ON THE AXIS THE FLEET IS MEASURED IN.
   *
   * `combatValue` on both sides, because that is the one quantity a commander can
   * already read of somebody else's world: a probe's defence band IS
   * `combatValue(homeFleet)`, fuzzed at the look. Until now nothing in the game
   * expressed the player's own ships in the same units, so the band was a figure
   * with nothing to be compared to.
   *
   * WHAT CAN FIRE, NOT WHAT IT COST. D183, owner report: *"Yük gemisi ekliyorum
   * gücüm artıyor ama yük gemilerinin saldırısı 0."* Both sides read `fleetValue`
   * until then — resources sunk in — so packing an Atlas for the loot grew the bar
   * labelled "Sending" without adding a shot to what was sent. `combatValue` is the
   * same resource scale over the hulls that fire, on both sides at once: changing
   * one of them alone would have made the comparison a category error instead of a
   * misleading one.
   *
   * THE TWO TARGET KINDS ARE HONESTLY DIFFERENT HERE, and the difference is the
   * whole economy of the intel layer:
   *
   *   · A WORLD is a memory. The band has width (the probe fuzzed it) and an age
   *     (the world has moved on), and both are drawn.
   *   · A PIRATE is current sight. An IDENTIFIED contact hands over its exact
   *     roster, so the reading has no width and no age — a solid bar beside the
   *     world's hatched one, which is what paying for a look buys.
   *
   * Null in every other case, and null draws NO enemy bar. An empty bar would say
   * the target is undefended, on the one screen where that mistake cannot be taken
   * back.
   */
  const report = target.kind === 'world'
    ? intel?.probeReports.find((r) => r.spatiallyCurrent !== false && r.targetPlanetId === target.world.id)
    : undefined;
  const opposing: ForceReading | null = (() => {
    if (target.kind === 'pirate') {
      const roster = target.pirate.fleet;
      if (!roster) return null;
      // The same axis as the wing's, so the two bars are one comparison. D183.
      const exact = combatValue(roster);
      return { low: exact, high: exact, source: sourceLabel('public'), ageMinutes: null };
    }
    if (!report) return null;
    return {
      low: report.defence.low,
      high: report.defence.high,
      source: sourceLabel('probe'),
      ageMinutes: Math.max(0, (serverNow() - report.at.getTime()) / 60_000),
    };
  })();

  /**
   * EVERYTHING THIS COMMANDER HOLDS ABOUT THE WALL, AS THE BATTLE ENGINE READS IT.
   * D199.
   *
   * Their own research (frozen at launch, so today's is the one), and whatever the
   * probe brought home: the wall's shape, the Aegis charge, the transports in the
   * line and the doctrine. A pirate under Telescope sight is the crew itself. What
   * is missing is left to the forecast's own range rather than guessed — an unread
   * wall widens the lines, it does not move them.
   */
  /*
    KEYED ON WHAT IT READS, NOT ON THE TARGET OBJECT. The parent builds `target` as a
    fresh literal every render and a pirate's entry is rebuilt on every poll as it
    moves; its crew is kept by the query's structural sharing while it is unchanged,
    and so is the probe report.
  */
  const isPirate = target.kind === 'pirate';
  const pirateCrew = target.kind === 'pirate' ? target.pirate.fleet : undefined;
  const pirateHandicap = target.kind === 'pirate' ? target.pirate.damageMult : undefined;
  /*
    AN UNMEASURED DOME IS ANYTHING UP TO THE MOST THIS WORLD CAN HOLD. The dome is
    public and so is the Core that caps its Aegis (a caretaker's Aegis stops at 3,
    under every tier's Core), so a charge nobody read runs from empty to that. It
    was counted as empty, which drew the kindest lines while a note said "not
    measured".
  */
  const domeCeiling = target.kind === 'world' && target.world.shielded ? shieldHp(target.world.coreLevel) : 0;
  const forecastInput = useMemo<ForecastInput>(() => {
    const none = { low: 0, high: 0 };
    if (isPirate) {
      return {
        attackerTech: tech,
        defenderTech: {},
        ...(pirateHandicap === undefined ? {} : { defenderDamageMult: pirateHandicap }),
        shield: none,
        unarmed: none,
        wall: pirateCrew ? { kind: 'EXACT', fleet: pirateCrew } : { kind: 'UNKNOWN' },
      };
    }
    return {
      attackerTech: tech,
      defenderTech: report?.doctrines ?? {},
      shield: report?.shield ?? { low: 0, high: domeCeiling },
      unarmed: report?.unarmed ?? none,
      wall: wallKnowledgeOf(report?.classReading),
    };
  }, [isPirate, pirateCrew, pirateHandicap, report, tech, domeCeiling]);

  /*
    A FEW DOZEN BATTLES PER READING, SO IT WAITS FOR THE THUMB. The picker renders
    the new count first and the lines follow in the deferred pass; on a phone a "+"
    must never stall behind a forecast.

    AND ONLY AGAINST A READING. With nobody having looked, every input about the
    wall — research, dome, transports — is a guess, and the guess was always the
    kindest wall there is. The lines are what a probe buys; before one, the box says
    "never measured" and nothing else.
  */
  const settled = useDeferredValue(wing);
  const hasReading = opposing !== null;
  const lines = useMemo(
    () => (hasReading && fleetCount(settled) > 0 ? forecastLines(settled, forecastInput) : null),
    [hasReading, settled, forecastInput],
  );
  /**
   * WHAT THE WING'S CLASSES DO AGAINST THE WALL THE PROBE READ — AND WHAT IT DID NOT READ.
   *
   * The counter cycle decides the fight: measured, the correct class loses a quarter of what a
   * mirror loses against the same wall. Until now its numbers lived only in the battle report,
   * which a commander reads after the fleet is gone.
   *
   * IT CARRIES THE UNREAD SHARE ON PURPOSE. A par probe names only the majority, so a pure wall
   * and a 51/49 wall read identically — and the same advice against those two costs 256,277 and
   * 504,946 alloy-equivalent. The surface states what was bought and never more.
   */
  const matchups = useMemo(
    () => matchupsAgainst(settled, report?.classReading),
    [settled, report?.classReading],
  );

  /** The single most useful next action, or nothing when the wing already covers what was read. */
  const hint = useMemo(() => {
    const said = matchups ? matchupHint(matchups) : null;
    if (said === null) return null;
    if (said.kind === 'BRING') return t('counter.matchupBring', { class: combatClassLabel(said.cls) });
    return t(said.kind === 'SINGLE' ? 'counter.matchupSingle' : 'counter.matchupProbe');
  }, [matchups, t]);

  const loss = useMemo(
    () => (lines !== null && opposing !== null
      ? forecastLoss(settled, { low: opposing.low, high: opposing.high }, forecastInput)
      : null),
    [lines, settled, opposing?.low, opposing?.high, forecastInput],
  );

  /**
   * TAKTİK GERİ ÇEKİLME, DRAWN WHERE THE WING IS SIZED. Owner decision, 2026-09-23.
   *
   * Only at another commander's world in a season dealt the rule: a caretaker and a
   * pirate never run, and a live season keeps the battle it was dealt. The line is a
   * third of this wing's firepower on the enemy axis; the verdict is the rule applied
   * to the reading — outmatched AND cleared — and the tank stays the raider's unknown,
   * which the copy says rather than the sheet guessing. From ruleset 13 the probe
   * also cannot establish whether five combat ships stand there; an otherwise
   * certain RUN stays UNSURE until the actual fight.
   */
  const escapeRuled = target.kind === 'world'
    && target.world.kind !== 'NEUTRAL'
    && fleetEscapeApplies(rulesetVersion);
  const escape = useMemo(() => {
    if (!escapeRuled || fleetCount(settled) === 0) return null;
    const power = combatValue(settled);
    return {
      at: escapeLine(settled),
      minimumCombatShips: fleetEscapeMinimumApplies(rulesetVersion) ? ESCAPE.minimumCombatShips : 0,
      verdict: opposing !== null && lines !== null
        ? escapeVerdict(power, { low: opposing.low, high: opposing.high }, lines.clears,
          fleetEscapeMinimumApplies(rulesetVersion))
        : null,
    };
  }, [escapeRuled, settled, opposing?.low, opposing?.high, lines, rulesetVersion]);

  /**
   * WHAT THE LINES COULD NOT SEE, AND WHAT THIS COMMANDER ALREADY PAID TO KNOW.
   * D199.
   *
   * Each phrase changes how the band is read and none opens anything new: the probe
   * says whether it was caught and whether ships were out, the Telescope says where
   * they are now, and the last raid here says what died. The gaps are stated so a
   * narrow line is never mistaken for a certain one.
   */
  const notes: string[] = [];
  if (target.kind === 'world') {
    const world = target.world;
    if (world.shielded && !report?.shield) notes.push(t('counter.noteShieldUnmeasured'));
    if (report) {
      const shape = report.classReading;
      if (!shape || shape.kind === 'UNREAD') notes.push(t('counter.noteShapeUnread'));
      if (!report.unarmed) notes.push(t('counter.noteUnarmedUnknown'));
      else if (report.unarmed.high > 0) {
        const { low, high } = report.unarmed;
        notes.push(t('counter.noteUnarmed', {
          count: high,
          band: low === high ? String(high) : `${String(low)}${t('units.rangeJoin')}${String(high)}`,
        }));
      }
      if (report.detected) notes.push(t('counter.noteSeen'));
      if (!report.fleetHome) notes.push(t('counter.noteSomeAway'));
    }
    if (world.fleet?.status === 'AWAY') notes.push(t('counter.noteTelescopeAway'));
    else if (world.fleet?.status === 'HOME') notes.push(t('counter.noteTelescopeHome'));
    const fought = fieldedAtLeast(reports, world.id);
    const mostly = fought ? dominantClass(fought.fleet) : null;
    if (mostly !== null && mostly !== 'SUPPORT') {
      notes.push(t('counter.noteLastRaid', { class: combatClassLabel(mostly) }));
    }
  }

  return {
    report, opposing, lines, matchups, hint, loss, escape, notes,
    /** What the probe read of the wall, for the matchup line (B6); null where nobody looked. */
    classReading: report?.classReading ?? null,
  };
}
