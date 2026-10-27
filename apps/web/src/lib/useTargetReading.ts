import { useDeferredValue, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  clanDefenseApplies,
  dominantClass,
  escapeVerdict,
  exactPowerRange,
  fleetEscapeApplies,
  fleetEscapeMinimumApplies,
  ESCAPE,
  matchupsAgainst,
  readPowerRange,
  shieldHp,
  type Fleet,
  type HpDamageLots,
  type LineReading,
  type PowerRange,
  type TechLevels,
} from '@astera/rules';
import type { AdmiralBonuses } from '@astera/rules/arena';
import type { IntelView, Report } from '../api/schemas.js';
import { combatClassLabel } from '../i18n/names.js';
import { serverNow } from './clock.js';
import { fieldedAtLeast, sourceLabel } from './dossier.js';
import { matchupHint } from './matchup.js';
import type { ForceReading } from './ruler.js';
import { factorLabel, raiderFactorCeiling } from './supportFactor.js';
import type { LaunchTarget } from '../screens/LaunchSheet.js';

/**
 * WHAT IS KNOWN ABOUT THE TARGET, MEASURED AGAINST ONE WING. F3.5a.
 *
 * Lifted verbatim out of `useLaunchPlan` so the launch and the target dossier (E2) read one
 * statement of it: the two sides' power and their ratio (combat v3, `readPowerRange`), the
 * counter matchups and their hint, the escape verdict and the notes on what the reading could
 * not see. The launch passes the fleet being packed; the dossier passes what stands home and
 * could be sent. It draws nothing and fetches nothing.
 */
export function useTargetReading({
  target,
  intel,
  reports,
  tech,
  wing,
  damage,
  rulesetVersion,
  escort,
}: {
  target: LaunchTarget;
  intel?: IntelView | undefined;
  reports: readonly Report[];
  /** The commander's research, frozen at launch (`flightModifiers(planet).tech`). */
  tech: TechLevels;
  wing: Fleet;
  damage?: HpDamageLots;
  /** The season's ruleset, which decides whether the escape rule applies. */
  rulesetVersion: number;
  /** The commander ship flying with the wing (Y9): its bonus fights in the power range as on the server. */
  escort?: AdmiralBonuses | null | undefined;
}) {
  const { t } = useTranslation();

  /**
   * WHERE THE READING OF THE TARGET CAME FROM, AND HOW OLD IT IS.
   *
   * THE TWO TARGET KINDS ARE HONESTLY DIFFERENT HERE, and the difference is the
   * whole economy of the intel layer:
   *
   *   · A WORLD is a memory. The probe read it in ranges (80% at best) and the world
   *     has moved on since, so both the width and the age are drawn.
   *   · A PIRATE is current sight. An IDENTIFIED contact hands over its exact roster,
   *     so the reading has no width and no age — which is what paying for a look buys.
   *
   * Null in every other case, and null weighs the wing alone. A wall drawn from a guess
   * would say the target is weaker than anyone knows, on the one screen where that
   * mistake cannot be taken back.
   */
  const report = target.kind === 'world'
    ? intel?.probeReports.find((r) => r.spatiallyCurrent !== false && r.targetPlanetId === target.world.id)
    : undefined;
  const pirateCrew = target.kind === 'pirate' ? target.pirate.fleet : undefined;
  const pirateHandicap = target.kind === 'pirate' ? target.pirate.damageMult : undefined;
  const opposing: ForceReading | null = pirateCrew
    ? { source: sourceLabel('public'), ageMinutes: null }
    : report
      ? { source: sourceLabel('probe'), ageMinutes: Math.max(0, (serverNow() - report.at.getTime()) / 60_000) }
      : null;

  /*
    AN UNMEASURED DOME IS ANYTHING UP TO THE MOST THIS WORLD CAN HOLD. The dome is
    public and so is the Core that caps its Aegis (a caretaker's Aegis stops at 3,
    under every tier's Core), so a charge nobody read runs from empty to that.
  */
  const domeCeiling = target.kind === 'world' && target.world.shielded ? shieldHp(target.world.coreLevel) : 0;
  /*
    A CARETAKER HOLDS NO RESEARCH, and the server reads none for it. Any other world whose
    report predates the windows was read as exact doctrine levels, or not at all — and an
    unread ladder is anything it allows, never nothing.
  */
  const caretaker = target.kind === 'world' && target.world.kind === 'NEUTRAL';
  const wingState = useMemo(() => ({ wing, damage }), [wing, damage]);
  const { wing: settled, damage: settledDamage } = useDeferredValue(wingState);

  /**
   * EACH SIDE'S POWER AGAINST THE OTHER, AND THEIR RATIO. Combat v3, owner 2026-10-25.
   *
   * Everything this commander holds about the wall, as the battle reads it: their own ships,
   * wounds and research, and whatever the probe brought home — the value, the class ranges,
   * the research windows, the Aegis, the clan's support beside the host. What is missing is
   * left open to the whole range rather than guessed, so the range holds the wall as it stood
   * at the look. A pirate under Telescope sight is the crew itself: one figure.
   *
   * KEYED ON WHAT IT READS, NOT ON THE TARGET OBJECT. The parent builds `target` as a fresh
   * literal every render and a pirate's entry is rebuilt on every poll as it moves; its crew
   * is kept by the query's structural sharing while it is unchanged, and so is the report.
   */
  // The commander ship flying with the wing (Y9) fights in the range as on the server (`withAdmiral`).
  const escortDamage = escort?.damage ?? 1; const escortHull = escort?.hull ?? 1;
  const power = useMemo<PowerRange | null>(() => {
    const flying = { fleet: settled, tech, ...(settledDamage?.length ? { damage: settledDamage } : {}),
      ...(escortDamage === 1 ? {} : { damageMult: escortDamage }), ...(escortHull === 1 ? {} : { hullMult: escortHull }) };
    // The wing alone, at neutral counters: what it holds before anybody has looked. Null for no ships.
    const alone = readPowerRange(flying, [], { low: 0, high: 0 });
    if (alone === null) return null;
    if (pirateCrew) {
      return exactPowerRange(flying, pirateCrew, { tech: {}, ...(pirateHandicap === undefined ? {} : { damageMult: pirateHandicap }) });
    }
    if (!report) return alone;
    const research: LineReading['research'] = report.research
      ?? (report.doctrines
        ? Object.fromEntries(Object.entries(report.doctrines).map(([id, level]) => [id, { low: level, high: level }]))
        : caretaker ? {} : undefined);
    const lines: LineReading[] = [{ value: report.defence, shape: report.classReading, research }];
    // KLAN SAVUNMA DESTEĞİ (K9): the raid meets the whole line; the supporters' research is unread.
    if (report.support && report.support.defence.high > 0) {
      lines.push({ value: report.support.defence, shape: report.support.classReading });
    }
    return readPowerRange(flying, lines, report.shield ?? { low: 0, high: domeCeiling });
  }, [settled, settledDamage, tech, pirateCrew, pirateHandicap, report, caretaker, domeCeiling, escortDamage, escortHull]);

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

  /**
   * TAKTİK GERİ ÇEKİLME, DRAWN WHERE THE WING IS SIZED. Owner decision, 2026-09-23.
   *
   * Only at another commander's world in a season dealt the rule: a caretaker and a
   * pirate never run. Combat v3 reads it on the matchup ratio (`ESCAPE.ratio`); the
   * verdict is the rule applied to the reading's ratio range, and the tank and the wipe
   * stay the raider's unknowns, which the copy says rather than the sheet guessing. From
   * ruleset 13 the probe also cannot establish whether five combat ships stand there; an
   * otherwise certain RUN stays UNSURE until the actual fight.
   */
  /*
    A WORLD THAT CANNOT RETREAT DRAWS NO RETREAT LINE (K4). From ruleset 15 the probe
    reads the posture exactly; SUPPORT and HOLD never lift off, so the tick would mark a
    ratio at which nothing happens. A report that never read a posture keeps the mark.
  */
  const held = clanDefenseApplies(rulesetVersion) && report?.posture != null && report.posture !== 'ESCAPE'
    ? report.posture
    : null;
  const escapeRuled = target.kind === 'world'
    && target.world.kind !== 'NEUTRAL'
    && fleetEscapeApplies(rulesetVersion)
    && held === null;
  const read = opposing !== null;
  const escape = useMemo(() => {
    if (!escapeRuled || power === null) return null;
    const minimum = fleetEscapeMinimumApplies(rulesetVersion);
    return {
      minimumCombatShips: minimum ? ESCAPE.minimumCombatShips : 0,
      verdict: read ? escapeVerdict(power.ratio, minimum) : null,
    };
  }, [escapeRuled, power, read, rulesetVersion]);

  /**
   * WHAT THE READING COULD NOT SEE, AND WHAT THIS COMMANDER ALREADY PAID TO KNOW.
   * D199.
   *
   * Each phrase changes how the ratio is read and none opens anything new: the probe
   * says whether it was caught and whether ships were out, the Telescope says where
   * they are now, and the last raid here says what died. The gaps are stated so a
   * narrow range is never mistaken for a certain one.
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
      if (held !== null) notes.push(t(`clanSupport.postureRead.${held}`));
      if (report.support && report.support.supporters > 0) {
        notes.push(t('clanSupport.noteSupport', { count: report.support.supporters }));
        // The most a win here could be multiplied by (owner, 2026-10-02): a ceiling, since the probe sees no guns.
        notes.push(t('clanSupport.noteFactor', {
          factor: factorLabel(raiderFactorCeiling(report.defence, report.support.defence)),
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
    report, opposing, power, matchups, hint, escape, notes,
    /** What the probe read of the wall, for the matchup line (B6); null where nobody looked. */
    classReading: report?.classReading ?? null,
  };
}
