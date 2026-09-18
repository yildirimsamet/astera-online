import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ABUSE, COMBAT, HULLS, fleetEntries, type Grade, type HullId } from '@astera/rules';
import { useReports } from '../api/queries.js';
import type { BattleReport, Report, StrategicBattleReport } from '../api/schemas.js';
import i18n from '../i18n/index.js';
import { hullLabel } from '../i18n/names.js';
import { compact, decimal, full, signed } from '../lib/format.js';
import { duration, staleness, useNow } from '../lib/time.js';
import { HULL_ART, RESOURCE_ART, instrumentArt } from '../ui/assets.js';
import { HullMark } from '../ui/icons/hulls.js';
import { SurvivorBar } from '../ui/SurvivorBar.js';
import { EmptyState, Section, Unreachable } from '../ui/kit/index.js';
import { Sheet } from '../ui/kit/index.js';
import './battle-report.css';

/**
 * THE CLOSING LINK OF THE LOOP.
 *
 * `game-design.md`: "the battle report is the most accurate intel in the game",
 * and step 9 feeds step 3 — every fight teaches you about someone you will fight
 * again. The server had been writing these since Phase 1 and showing nobody, so
 * combat resolved, a single line appeared in the return overlay, and nothing a
 * player learned survived into their next decision.
 *
 * The list is a verdict per row. The detail is the thing worth reading: what they
 * fielded, what it cost you, and what the fight moved on the ladder.
 */
/**
 * DECISIVE, PARTIAL, REPELLED — the three outcomes, as keys.
 *
 * The grade is a stamp: it is printed in caps and it is the first thing a player
 * looks for, so it has to be a WORD in their language rather than the enum the
 * combat model happens to use.
 */
const RESULT_EXPLANATION = {
  DECISIVE: 'reports.calculation.resultDecisive',
  PARTIAL: 'reports.calculation.resultPartial',
  REPELLED: 'reports.calculation.resultRepelled',
} as const satisfies Record<Grade, string>;

const VERDICT_TITLE = {
  attacking: {
    DECISIVE: 'reports.verdict.title.attacking.DECISIVE',
    PARTIAL: 'reports.verdict.title.attacking.PARTIAL',
    REPELLED: 'reports.verdict.title.attacking.REPELLED',
  },
  defending: {
    DECISIVE: 'reports.verdict.title.defending.DECISIVE',
    PARTIAL: 'reports.verdict.title.defending.PARTIAL',
    REPELLED: 'reports.verdict.title.defending.REPELLED',
  },
} as const;

const verdictTitle = (report: BattleReport): string => {
  if (report.attacking && ownFleetWiped(report)) {
    if (report.grade === 'DECISIVE') {
      return i18n.t('reports.verdict.title.attacking.DECISIVE_WIPED');
    }
    if (report.grade === 'PARTIAL') {
      return i18n.t('reports.verdict.title.attacking.PARTIAL_WIPED');
    }
  }
  return i18n.t(VERDICT_TITLE[report.attacking ? 'attacking' : 'defending'][report.grade]);
};

const unitCount = (fleet: BattleReport['yourFleet']): number =>
  fleetEntries(fleet).reduce((sum, [, count]) => sum + count, 0);

const ownFleetWiped = (report: BattleReport): boolean => {
  const starting = unitCount(report.yourFleet);
  return starting > 0 && unitCount(report.yourLosses) >= starting;
};

/** Historical counts only; research cannot turn an unarmed hull into a firing unit. */
function forceAfterRound(report: BattleReport, round: Round, enemy = false) {
  const start = enemy ? report.theirFleet : report.yourFleet;
  const entries = fleetEntries(start);
  if (entries.length === 0) return null;
  const lost: BattleReport['yourLosses'] = {};
  for (const completed of report.rounds) {
    if (completed.round > round.round) continue;
    const losses = report.attacking !== enemy
      ? completed.attackerLosses
      : completed.defenderLosses;
    for (const [hull, count] of fleetEntries(losses)) {
      lost[hull] = (lost[hull] ?? 0) + count;
    }
  }
  let combat = 0;
  let support = 0;
  for (const [hull, count] of entries) {
    const left = Math.max(0, count - (lost[hull] ?? 0));
    if (HULLS[hull].atk > 0) combat += left;
    else support += left;
  }
  return { combat, support };
}

type OrdinaryReport = BattleReport;
type StrategicReport = StrategicBattleReport;

/**
 * Who the other side was.
 *
 * A neutral world has no commander, so the server sends no name and the report
 * used to read "You raided someone" at "an unknown world" — about a world whose
 * name is printed on the disc. The world itself is named in the line below this
 * one; what belongs here is WHAT it was.
 */
const opponentOf = (report: OrdinaryReport): string => {
  /*
    A PIRATE IS NAMED FROM THE LOCALE FILES. D150.

    The server carries a plain fallback in `opponentName` for the same reason it
    carries "someone" — a payload has to say something — but the sentence a player
    reads belongs in the translations, so the structured field wins whenever it is
    there.
  */
  if (report.pirate) {
    return i18n.t('pirate.name', {
      level: report.pirate.level,
      callsign: report.pirate.callsign,
    });
  }
  return report.neutral ? i18n.t('reports.neutralHolder') : report.opponentName;
};

/**
 * THE ONE FIGHT A NOTIFICATION'S `refId` NAMES. D150 · owner correction.
 *
 * A raid at a pirate has no mission row, so its notification carries the RAID id —
 * matching only on `missionId` sent every pirate notification to a list that then
 * opened nothing. Both binders are matched, which is safe because the ids are
 * uuids from disjoint tables.
 *
 * Exported because two surfaces ask the same question now: the list's deep link,
 * and the report door a battle notification opens directly (`BattleReportDoor`).
 */
export const reportFor = (
  reports: readonly Report[],
  id: string,
): Report | undefined => reports.find((candidate) =>
  candidate.missionId === id
  || (candidate.kind !== 'STRATEGIC' && candidate.pirateRaidId === id));

/**
 * A BATTLE NOTIFICATION OPENS THE BATTLE, NOT THE FILING CABINET. Owner
 * instruction, correcting D121's answer to the same complaint.
 *
 * D121 sent "you were raided" to the Intel centre and made it land on the battles
 * shelf rather than beside it, which was the right fix for the room and the wrong
 * altitude for the news: the reader tapped one fight and got a list with that
 * fight somewhere in it. This is the door that skips the room.
 *
 * IT CANNOT ALWAYS OPEN. The reports list is a request, and the row for a fight
 * that has just resolved may not be in the cache the instant the notification is
 * tapped — and a `refId` from a kind this build cannot match resolves to nothing
 * at all. Rather than show an empty sheet, it hands back to `onUnavailable`, which
 * is the Intel centre on the battles shelf: the old destination, kept as the
 * fallback it should always have been. Nothing is drawn while the answer is still
 * unknown, so the reader never sees a flash of the wrong surface.
 */
export function BattleReportDoor({
  missionId,
  onClose,
  onUnavailable,
}: {
  missionId: string;
  onClose: () => void;
  /** No such report, or the request failed: fall back to the list. */
  onUnavailable: () => void;
}) {
  const { data, isPending, isError } = useReports();
  const report = data ? reportFor(data.reports, missionId) : undefined;
  const missing = !isPending && !report;

  useEffect(() => {
    if (missing || isError) onUnavailable();
  }, [isError, missing, onUnavailable]);

  if (!report) return null;
  return report.kind === 'STRATEGIC'
    ? <StrategicReportSheet report={report} onClose={onClose} />
    : <ReportSheet report={report} onClose={onClose} />;
}

export function BattleReports({
  open: requested,
}: {
  open?: { missionId: string; request: number };
} = {}) {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useReports();
  const [open, setOpen] = useState<Report | null>(null);
  const now = useNow(30_000);
  const reports = data?.reports ?? [];
  const requestedMissionId = requested?.missionId;
  const requestedSequence = requested?.request;

  useEffect(() => {
    if (!requestedMissionId) return;
    const report = reportFor(reports, requestedMissionId);
    if (report) setOpen(report);
  }, [reports, requestedMissionId, requestedSequence]);

  return (
    <Section
      label={t('reports.heading')}
      aside={reports.length > 0 ? t('reports.newest') : undefined}
    >
      {/*
        AN EMPTY LIST AND A FAILED ONE ARE NOT THE SAME SENTENCE.
        
        Both left `reports` empty, so a request that never arrived was reported as
        "nothing has been fought over yet" — the interface stating a fact about the
        season on the strength of a network error.
      */}
      {isError ? (
        <Unreachable
          what={t('surface.whatReports')}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : isPending ? null : reports.length === 0 ? (
        <EmptyState title={t('reports.empty')} />
      ) : (
        <div className="plate plate-inset">
          {reports.map((report) => {
            if (report.kind === 'STRATEGIC') {
              return (
                <StrategicReportRow
                  key={report.id}
                  report={report}
                  now={now}
                  onOpen={() => { setOpen(report); }}
                />
              );
            }
            const opponentClan = report.attacking ? report.defenderClan : report.attackerClan;
            return (
              <button
              key={report.id}
              type="button"
              onClick={() => {
                setOpen(report);
              }}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-2 border-b border-line-soft p-3 text-left last:border-b-0 hover:bg-crystal/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-crystal"
            >
              <GradeMark report={report} />
              <div className="col-span-2 min-w-0">
                <p className="break-words text-body text-bone">
                  {t(report.attacking ? 'reports.youRaided' : 'reports.raidedBy')}
                  {opponentClan ? (
                    <span className="mr-1 text-crystal" title={opponentClan.name}>[{opponentClan.tag}]</span>
                  ) : null}
                  <span className="text-dim">{opponentOf(report)}</span>
                </p>
                {/*
                  THE SAME EMPTY WORLD, IN THE ROW. A pirate battle has no world on
                  the far side, so this opened with a blank and a dangling
                  separator. The world it launched FROM is the one fact of the three
                  that a pirate row can still offer, so it stands in.
                */}
                <p className="num mt-1 text-label text-faint">
                  {report.pirate ? report.yourPlanet : report.opponentPlanet}
                  {(report.pirate ? report.yourPlanet : report.opponentPlanet) !== '' && ' · '}
                  {staleness((now - report.at.getTime()) / 60_000)} ·{' '}
                  {t('reports.rounds', { count: report.rounds.length })}
                </p>
              </div>
              {/*
                A SWING OF ZERO IS NOT A FIGURE. Every raid on a caretaker world
                moves nobody's score, and so does a raid repelled without losses —
                so the chip printed "0" on exactly the rows where the ladder had
                nothing to say. Shown when it moved; omitted when it did not.
              */}
              {report.dominion !== null && report.dominion !== 0 && (
                <span
                  className={`num col-start-2 row-start-1 text-right text-body ${report.dominion >= 0 ? 'text-opportunity' : 'text-threat-ink'}`}
                >
                  <span className="mb-1 block text-caption text-dim">{t('reports.dominion')}</span>
                  {signed(report.dominion)}
                </span>
              )}
              </button>
            );
          })}
        </div>
      )}

      {open && (
        open.kind === 'STRATEGIC' ? (
          <StrategicReportSheet report={open} onClose={() => { setOpen(null); }} />
        ) : (
          <ReportSheet report={open} onClose={() => { setOpen(null); }} />
        )
      )}
    </Section>
  );
}

const STRATEGIC_OUTCOME = {
  FIRST_STRIKE: 'reports.strategicFirstStrike',
  CAPTURED: 'reports.strategicCaptured',
  INEFFECTIVE: 'reports.strategicIneffective',
  INTERCEPTED: 'reports.strategicIntercepted',
} as const;

function StrategicReportRow({
  report,
  now,
  onOpen,
}: {
  report: StrategicReport;
  now: number;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const stopped = report.outcome === 'INTERCEPTED';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2 border-b border-line-soft p-3 text-left last:border-b-0"
    >
      <span className={`chip shrink-0 ${stopped ? 'chip-opportunity' : 'chip-threat'}`}>
        {t(STRATEGIC_OUTCOME[report.outcome])}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body text-bone">
          {t(report.attacking ? 'reports.strategicYouAttacked' : 'reports.strategicAttackedBy')}
          <span className="text-dim">{report.opponentName}</span>
        </p>
        <p className="num mt-1 text-label text-faint">
          {report.opponentPlanet} · {staleness((now - report.at.getTime()) / 60_000)}
        </p>
      </div>
      {report.damage > 0 ? <span className="num text-body text-threat">{compact(report.damage)}</span> : null}
    </button>
  );
}

function StrategicReportSheet({
  report,
  onClose,
}: {
  report: StrategicReport;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const resourcesLost = report.destroyedResources.alloy
    + report.destroyedResources.crystal
    + report.destroyedResources.deuterium;
  const ordersLost = report.destroyedOrders.reduce(
    (sum, order) => sum + order.cost.alloy + order.cost.crystal + order.cost.deuterium,
    0,
  );

  return (
    <Sheet
      eyebrow={t(report.attacking ? 'reports.strategicYouAttacked' : 'reports.strategicAttackedBy', {
        opponent: report.opponentName,
      })}
      title={t(STRATEGIC_OUTCOME[report.outcome])}
      onClose={onClose}
    >
      {report.yourPlanet ? (
        <p className="num mb-3 flex items-center gap-2 text-label text-faint">
          <span className="text-bone">{report.yourPlanet}</span>
          <span aria-hidden>{report.attacking ? '→' : '←'}</span>
          <span>{report.opponentPlanet}</span>
        </p>
      ) : null}

      {report.outcome === 'INTERCEPTED' ? (
        <div className="plate plate-inset p-3">
          <p className="legend text-opportunity">{t('reports.strategicDestroyedInFlight')}</p>
          <p className="mt-2 text-body text-dim">
            {t(report.trigger === 'TELESCOPE'
              ? 'reports.strategicTelescopeTrigger'
              : 'reports.strategicRadarTrigger')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="plate plate-inset grid grid-cols-2 gap-2 p-3">
            <StrategicMetric label={t('reports.strategicTotalDamage')} value={full(report.damage)} />
            <StrategicMetric label={t('reports.strategicShieldLost')} value={full(report.shieldDestroyed)} />
            <StrategicMetric label={t('reports.strategicResourcesLost')} value={full(resourcesLost)} />
            <StrategicMetric label={t('reports.strategicOrdersLost')} value={full(ordersLost)} />
          </div>

          <div className="plate plate-inset p-3">
            <p className="legend text-crystal">{t('reports.strategicResourceBreakdown')}</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-label text-dim">
              <span>{t('vocabulary.resource.alloy')} <b className="num text-bone">{full(report.destroyedResources.alloy)}</b></span>
              <span>{t('vocabulary.resource.crystal')} <b className="num text-bone">{full(report.destroyedResources.crystal)}</b></span>
              <span>{t('vocabulary.resource.deuterium')} <b className="num text-bone">{full(report.destroyedResources.deuterium)}</b></span>
            </div>
          </div>

          <Losses
            fleet={report.destroyedFleet}
            tone="text-threat"
            empty={t('reports.strategicNoFleetLost')}
          />

          <div className="plate plate-inset p-3">
            <p className="legend text-crystal">{t('reports.strategicLevelLosses')}</p>
            {report.levelChanges.length === 0 ? (
              <p className="mt-2 text-body text-faint">{t('reports.strategicNoLevelLoss')}</p>
            ) : (
              <div className="mt-2 space-y-1">
                {report.levelChanges.map((change, index) => (
                  <p key={`${change.kind}-${change.id}-${index}`} className="flex justify-between text-body text-dim">
                    <span>{change.id.replaceAll('_', ' ')}</span>
                    <span className="num text-threat">L{change.before} → L{change.after}</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="plate plate-inset p-3">
            <p className="legend text-crystal">{t('reports.strategicDestroyedOrders')}</p>
            {report.destroyedOrders.length === 0 ? (
              <p className="mt-2 text-body text-faint">{t('reports.strategicNoOrdersLost')}</p>
            ) : report.destroyedOrders.map((order, index) => (
              <p key={`${order.subject}-${index}`} className="mt-2 flex justify-between text-body text-dim">
                <span>{order.subject.replaceAll('_', ' ')} ×{order.count}</span>
                <span className="num text-threat">
                  {full(order.cost.alloy + order.cost.crystal + order.cost.deuterium)}
                </span>
              </p>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}

function StrategicMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="legend text-faint">{label}</p>
      <p className="num mt-1 text-title text-bone">{value}</p>
    </div>
  );
}

/**
 * The grade, as a mark rather than a word.
 *
 * DECISIVE, PARTIAL and REPELLED are the three outcomes the whole combat model
 * produces, and which one you got is the first thing a player looks for.
 */
function GradeMark({ report }: { report: OrdinaryReport }) {
  const starting = unitCount(report.yourFleet);
  const won = report.attacking
    ? report.grade !== 'REPELLED' && (starting === 0 || unitCount(report.yourLosses) < starting)
    : report.grade === 'REPELLED';
  return (
    <span
      className={`w-fit max-w-full rounded-cell border px-2 py-1 text-body font-semibold ${won ? 'border-opportunity/30 text-opportunity' : 'border-threat/30 text-threat-ink'}`}
      title={verdictTitle(report)}
    >
      {verdictTitle(report)}
    </span>
  );
}

function ReportSheet({ report, onClose }: { report: OrdinaryReport; onClose: () => void }) {
  const { t } = useTranslation();
  const perspective = report.attacking ? 'attacking' : 'defending';
  const whyGrade = report.grade === 'DECISIVE' && report.rounds.length === 0
    ? 'WALKOVER'
    : report.attacking && ownFleetWiped(report) && report.grade === 'DECISIVE'
      ? 'DECISIVE_WIPED'
      : report.attacking && ownFleetWiped(report) && report.grade === 'PARTIAL'
        ? 'PARTIAL_WIPED'
        : report.grade === 'DECISIVE' && !shieldWasBroken(report)
          ? 'DECISIVE_WITHOUT_SHIELD'
          : report.grade;

  const looted = report.lootAlloy + report.lootCrystal + report.lootDeuterium;
  const salvage = report.salvage;
  const lifted = salvage ? salvage.alloy + salvage.crystal + salvage.deuterium : 0;
  const yourClan = report.attacking ? report.attackerClan : report.defenderClan;
  const theirClan = report.attacking ? report.defenderClan : report.attackerClan;

  return (
    <Sheet
      eyebrow={t(
        report.pirate
          ? 'reports.sheetYouRaidedPirate'
          : report.attacking
            ? 'reports.sheetYouRaided'
            : 'reports.sheetTheyRaided',
        {
          opponent: opponentOf(report),
          planet: report.opponentPlanet,
        },
      )}
      title={verdictTitle(report)}
      reading
      onClose={onClose}
    >
      <div data-battle-report className="battle-report">
      {/*
        THE FOUR QUESTIONS A READER ARRIVES WITH, IN THE ORDER THEY ASK THEM.
        Owner report · `docs/battle-reports.md`.

        *"Savaşta ne oldu, karşıda neler vardı, yer savunması var mıydı varsa ne
        yaptı, hangi round'da neler hayatta kaldı neler öldü."*

        Every one of those was already on this sheet and the surface still could not
        be read, because the order was almost exactly inverted: the two things the
        reader came for — what was on the other side, and who died when — were
        twelfth and fourteenth, under a bookkeeping block about Dominion and clans
        that only matters once the fight is understood.

        So the sheet is four headed sections and nothing else:

          1 · WHAT HAPPENED      the verdict, where, and why that word
          2 · WHAT WAS THERE     their board, their wall, their shield
          3 · WHO DIED, AND WHEN your survivors and the round-by-round
          4 · WHAT IT CHANGED    haul, Dominion, wreck, consequences

        Outcomes, losses and remaining forces never fold. Calculation recipes are
        optional details: understand the battle first, inspect the arithmetic next.
      */}
      <h2
        data-report-section="happened"
        className="legend mt-1 text-crystal"
      >
        {t('reports.q.happened')}
      </h2>
      <BattleVerdict report={report} />
      <time dateTime={report.at.toISOString()} className="mb-2 block text-body text-dim">
        {new Intl.DateTimeFormat(t('units.numberLocale'), {
          dateStyle: 'medium', timeStyle: 'short',
        }).format(report.at)}
      </time>
      {/*
        WHERE IT HAPPENED, IN ONE LINE, BEFORE ANYTHING ELSE.

        A commander may hold four worlds since D97, and "Raided by Sable" stopped
        saying WHICH of theirs was hit — the most actionable fact there is, absent
        from the record of it. Said as a route rather than as two facts, because a
        battle has two ends and the reader is always at one of them.

        A ROUTE NEEDS TWO ENDS. A pirate battle has one: the far end is a
        rendezvous in open space, so the server sends an empty `opponentPlanet` and
        this drew an arrow pointing at nothing. The launching world alone is still
        the actionable half and is still named.
      */}
      {report.yourPlanet && (
        <p className="num mb-3 flex items-center gap-2 text-label text-faint">
          <span className="text-bone">{report.yourPlanet}</span>
          {report.opponentPlanet !== '' && (
            <>
              <span aria-hidden>{report.attacking ? '→' : '←'}</span>
              <span>{report.opponentPlanet}</span>
            </>
          )}
        </p>
      )}
      {/*
        THE HANDICAP THAT PRODUCED EVERY DAMAGE FIGURE BELOW. D124 · D150.

        A pirate's entire difference from a player fleet of the same roster is a
        per-level cut to its ATTACK, and nothing on this surface said so — the
        reader was being asked to check the arithmetic against a rule the interface
        never states. The same sentence the launch rail shows before committing, so
        what a commander priced the fight with is what the report explains it with.
      */}
      {report.pirate && (
        <p className="mt-2 border-l border-crystal/60 pl-3 text-caption leading-snug text-crystal">
          {t('pirate.damagePenalty', {
            percent: Math.round((1 - report.pirate.damageMult) * 100),
          })}
        </p>
      )}
      {/*
        WHY THIS WORD, AND NOT THE OTHER TWO.

        DECISIVE, PARTIAL and REPELLED are printed in caps at the top of every
        report and nothing in the game had ever said what separates them. A player
        who reads "PARTIAL" twice and cannot tell whether they were close has been
        given a stamp, not a report — and the grade is what sets the loot share and
        how long the works stay down, so it is the single most consequential word
        on the surface.
      */}
      <section data-battle-reason className="plate plate-inset mt-3 p-3">
      <h3 className="text-title font-semibold text-bone">{t('reports.reasonHeading')}</h3>
      <p className="mt-2 text-body leading-relaxed text-dim">
        {/*
          ONE LINE IN THIRTEEN QUOTES THE THRESHOLD, AND THE TYPES SAY SO.

          A repelled attacker is the only reading that has to name the bar it
          missed; the other twelve describe what happened without a number in
          them. Handing the whole key union an interpolation value none of them
          declare is what the compiler refuses, and it is right to — the option
          would be silently dropped on twelve of the thirteen.
        */}
        {perspective === 'attacking' && whyGrade === 'REPELLED'
          ? t('reports.why.attacking.REPELLED',
              { threshold: full(COMBAT.partialThreshold * 100) })
          : t(`reports.why.${perspective}.${whyGrade}`)}
      </p>
      <CombatTurningPoint report={report} />
      </section>

      <h2
        data-report-section="there"
        className="legend mt-5 text-crystal"
      >
        {t(
          report.attacking
            ? report.grade === 'DECISIVE'
              ? 'reports.q.enemyForce'
              : 'reports.q.enemyLosses'
            : 'reports.q.incomingForce',
        )}
      </h2>
      {/*
        THE PART THAT FEEDS THE NEXT DECISION — AND IT NOW SAYS HOW FAR IT GOES.

        What they fielded is the most accurate reading anyone in this game ever
        gets, but HOW MUCH of their force it represents depends entirely on the
        grade, and the sheet never said which of the two readings the player was
        holding:

          · DECISIVE — nothing survived, so their losses ARE their whole board.
          · anything else — a FLOOR. `reports.ts` withholds the opponent's roster
            because roster minus losses is survivors, which is the one subtraction
            fog exists to refuse. Rendering that bound as a bare short list is what
            made a deliberately bounded report read as a broken one.
      */}
      <TheirBoard report={report} />
      {/*
        THE AEGIS IS ALWAYS THE DEFENDER'S, so which section it belongs to depends
        on which end of the battle the reader is standing at.
        
        Raiding, it is part of the wall they flew into and belongs here. Being
        raided, it is their OWN board — filing it under "what was on the other
        side" would tell a defender their attacker brought a planet shield.
      */}
      {report.attacking && <ShieldImpact report={report} />}

      <h2
        data-report-section="who"
        className="legend mt-5 text-crystal"
      >
        {t('reports.q.who')}
      </h2>
      {/* Defending, the Aegis is part of the reader's own board — see above. */}
      {!report.attacking && <ShieldImpact report={report} />}

      {/*
        AND THE PART THAT GIVES YOUR OWN LOSSES A DENOMINATOR.

        "You lost 12 Wasp" is a disaster out of fifteen and a rounding error out
        of eighty, and until D121 the report could not tell those two apart. The
        roster is the caller's own board, so it discloses nothing: this is the one
        force in the fight the reader already commanded.
      */}
      <h3 className="legend mt-4">
        {t(fleetEntries(report.yourFleet).length > 0 ? 'reports.yourForce' : 'reports.yours')}
      </h3>
      {fleetEntries(report.yourFleet).length > 0 ? (
        <YourForce report={report} />
      ) : (
        <Losses fleet={report.yourLosses} tone="text-threat-ink" empty={t('reports.yoursEmpty')} />
      )}
      {/*
        THE WALKOVER, WHICH IS THE MOST COMMON RAID IN THE GAME AND THE ONE THE
        SHEET SAID LEAST ABOUT. Owner report · `docs/battle-reports.md`.

        `resolveCombat` breaks before round one when no defending units stand,
        even with an idle Aegis, so the report arrives with `rounds: []`. That drew a
        "How it went" heading over an EMPTY PLATE — a reader who flew a real fleet
        at a real world and came home to a box with nothing in it, on the surface
        that is supposed to be the whole product of the trip.

        There was no fight, so the honest report is a sentence rather than a table.
        Everything that DID happen — the haul, the wreck, the Dominion — is above
        this and unaffected.
      */}
      {report.rounds.length === 0 ? (
        <section data-walkover className="plate plate-inset mt-3 px-3 py-2">
          <p className="legend text-crystal">{t('reports.walkoverHeading')}</p>
          <p className="mt-2 text-body leading-relaxed text-dim">
            {t(report.attacking ? 'reports.walkoverBody' : 'reports.walkoverDefendingBody')}
          </p>
        </section>
      ) : (
      <>
      <h3 className="legend mt-4">{t('reports.howItWent')}</h3>
      <p className="mt-2 text-body leading-relaxed text-dim">{t('reports.calculation.fireNote')}</p>
      {!report.pirate ? <p className="mt-1 text-body leading-relaxed text-dim">{t('reports.roundDamageNote')}</p> : null}
      <div className="plate plate-inset mt-2">
        {report.rounds.map((round) => (
          <BattleRound key={round.round} report={report} round={round} />
        ))}
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer py-3 text-body font-semibold text-crystal focus-visible:outline focus-visible:outline-2 focus-visible:outline-crystal">
          {t('reports.rulesToggle')}
        </summary>
        <CombatFormula grade={report.grade} pirate={report.pirate != null} />
      </details>
      </>
      )}

      <h2
        data-report-section="changed"
        className="legend mt-5 text-crystal"
      >
        {t('reports.q.changed')}
      </h2>
      {/* The opening verdict already states losses, loot and Dominion. This section
          expands only the figures that have more to explain. */}
      {report.dominion !== null ? (
        <p className="mt-3 text-body leading-relaxed text-dim">{t('reports.dominionReason')}</p>
      ) : null}
      {report.dominion !== null && report.dominion !== 0 ? (
        <p
          data-dominion-summary
          className={`mt-3 border-l-2 pl-3 text-body leading-relaxed ${
            report.dominion >= 0
              ? 'border-opportunity text-opportunity'
              : 'border-threat text-threat-ink'
          }`}
        >
          {t(
            report.dominion >= 0
              ? 'reports.dominionSummaryGained'
              : 'reports.dominionSummaryLost',
            { amount: full(Math.abs(report.dominion)) },
          )}
        </p>
      ) : null}
      {report.dominionBreakdown && (
        <section
          className="plate plate-inset mt-3 p-3"
          data-dominion-ruleset={report.dominionBreakdown.ruleVersion}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="legend text-crystal">{t('reports.dominionBreakdown.title')}</h3>
            <span className="num text-micro text-faint">
              v{report.dominionBreakdown.ruleVersion}
            </span>
          </div>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-caption">
            <dt className="text-dim">
              {t(report.dominionBreakdown.lootValue >= 0
                ? 'reports.dominionBreakdown.lootGained'
                : 'reports.dominionBreakdown.lootLost')}
            </dt>
            <dd className={report.dominionBreakdown.lootValue >= 0
              ? 'num text-alloy'
              : 'num text-threat'}>
              {signed(report.dominionBreakdown.lootValue)}
            </dd>
            <dt className="text-dim">{t('reports.dominionBreakdown.enemyLosses')}</dt>
            <dd className="num text-opportunity">
              {signed(report.dominionBreakdown.enemyPermanentLossValue)}
            </dd>
            <dt className="text-dim">{t('reports.dominionBreakdown.ownLosses')}</dt>
            <dd className="num text-threat">
              {signed(-report.dominionBreakdown.ownPermanentLossValue)}
            </dd>
            <dt className="mt-1 border-t border-line-soft pt-2 text-bone">
              {t('reports.dominionBreakdown.total')}
            </dt>
            <dd className={`num mt-1 border-t border-line-soft pt-2 ${
              report.dominionBreakdown.rawExchange >= 0
                ? 'text-opportunity'
                : 'text-threat'
            }`}>
              {signed(report.dominionBreakdown.rawExchange)}
            </dd>
          </dl>
        </section>
      )}
      {looted !== 0 && (
        <p className="legend mt-2">{t(looted >= 0 ? 'reports.haul' : 'reports.haulLost')}</p>
      )}
      {looted !== 0 && (
        <p className="num mt-1 flex items-center gap-2 text-caption">
          <span className="flex items-center gap-1 text-alloy">
            <img
              src={RESOURCE_ART.alloy}
              alt={t('vocabulary.resource.alloy')}
              className="size-4 object-contain"
            />
            {signed(report.lootAlloy)}
          </span>
          <span className="flex items-center gap-1 text-crystal">
            <img
              src={RESOURCE_ART.crystal}
              alt={t('vocabulary.resource.crystal')}
              className="size-4 object-contain"
            />
            {signed(report.lootCrystal)}
          </span>
          {report.lootDeuterium !== 0 && (
            <span className="flex items-center gap-1 text-opportunity">
              <img
                src={RESOURCE_ART.deuterium}
                alt={t('vocabulary.resource.deuterium')}
                className="size-4 object-contain"
              />
              {signed(report.lootDeuterium)}
            </span>
          )}
        </p>
      )}
      {/*
        WHAT THE COLLECTORS LIFTED, UNDER THE HAUL AND NEVER INSIDE IT. D200.

        It came home with the fleet, so it belongs beside "what came home" — but it
        is not loot: it was never the defender's and it moved no Dominion, and a sum
        that folded the two together would print a haul the equation above cannot
        account for. Attacker's copy only; the defender reads it as a consequence.
      */}
      {report.attacking && lifted > 0 && salvage && (
        <>
          <p className="legend mt-2">{t('reports.salvageHaul')}</p>
          <p data-testid="report-salvage" className="num mt-1 flex items-center gap-2 text-caption">
            <span className="flex items-center gap-1 text-alloy">
              <img
                src={RESOURCE_ART.alloy}
                alt={t('vocabulary.resource.alloy')}
                className="size-4 object-contain"
              />
              {signed(salvage.alloy)}
            </span>
            <span className="flex items-center gap-1 text-crystal">
              <img
                src={RESOURCE_ART.crystal}
                alt={t('vocabulary.resource.crystal')}
                className="size-4 object-contain"
              />
              {signed(salvage.crystal)}
            </span>
            {salvage.deuterium !== 0 && (
              <span className="flex items-center gap-1 text-opportunity">
                <img
                  src={RESOURCE_ART.deuterium}
                  alt={t('vocabulary.resource.deuterium')}
                  className="size-4 object-contain"
                />
                {signed(salvage.deuterium)}
              </span>
            )}
          </p>
        </>
      )}
      <Consequences report={report} />
      {/*
        AND THE PRIZE, WHICH IS WHY ANYONE FLIES AT ONE OF THESE AT ALL.

        A DECISIVE win may hand over one of the pirate's own hulls — the only door
        in the game into a ship you did not build. It reached the player as a toast
        and as a line in a return notification, both long gone by the time they open
        the report. Drawn as the ship rather than written as a name, for the reason
        the launch sheet draws its pickers: this is a hull, and a hull is a picture.
      */}
      {report.pirate?.capturedHull && <CapturedHull hull={report.pirate.capturedHull} />}
      {yourClan || theirClan ? (
        <div className="plate plate-inset mb-2 px-3 py-2">
          <p className="legend text-crystal">{t('reports.clansAtLaunch')}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <ClanAtLaunch label={t('reports.yourClan')} clan={yourClan} />
            <ClanAtLaunch label={t('reports.theirClan')} clan={theirClan} />
          </div>
        </div>
      ) : null}
      </div>
    </Sheet>
  );
}

/**
 * The consequences a battle had beyond the loot line, each stated only when true.
 *
 * Every one of these was already decided by the server and thrown away on the way
 * to the screen, which is what "the reports are not explanatory enough" turned out
 * to mean: a raider could not learn that their holds — not the defence — capped
 * the haul, and a defender could not learn that most of the guns they "lost" were
 * standing again by the time they read about it.
 */
function Consequences({ report }: { report: OrdinaryReport }) {
  const { t } = useTranslation();
  const salvaged = fleetEntries(report.defenceSalvage).reduce((sum, [, n]) => sum + n, 0);
  const lines: { key: string; tone: string; text: string }[] = [];

  // A current report gets the drawn before→after Aegis card above. Keep this
  // sentence only for a legacy report whose old payload knows the absorbed total
  // but cannot honestly reconstruct either endpoint.
  if (report.shieldAbsorbed >= 1 && shieldState(report).before === null) {
    lines.push({
      key: 'shield',
      tone: 'text-crystal',
      text: t(report.attacking ? 'reports.effects.shieldTheirs' : 'reports.effects.shieldYours', {
        amount: compact(report.shieldAbsorbed),
      }),
    });
  }
  if (report.cargoLimited) {
    lines.push({
      key: 'cargo',
      tone: 'text-alloy',
      text: t('reports.effects.cargoLimited'),
    });
  }
  if (salvaged > 0) {
    lines.push({
      key: 'salvage',
      tone: 'text-opportunity',
      text: t('reports.effects.salvaged', { count: salvaged }),
    });
  }
  if (report.disruptedMinutes >= 1) {
    lines.push({
      key: 'works',
      tone: report.attacking ? 'text-opportunity' : 'text-threat-ink',
      text: t(report.attacking ? 'reports.effects.worksTheirs' : 'reports.effects.worksYours', {
        duration: duration(report.disruptedMinutes),
      }),
    });
  }
  /*
    THE DEFENDER IS TOLD WHERE THE REST OF THE WRECK WENT. D200.

    A defender who lost a fleet reads the wreck line below — and without this, it is
    far smaller than the fleet with nothing to say why. The collectors were in the
    roster that arrived over their world (D164), so naming what they lifted crosses
    no line. The attacker reads the same figure as its own haul row instead.
  */
  const lifted = report.salvage
    ? report.salvage.alloy + report.salvage.crystal + report.salvage.deuterium
    : 0;
  if (!report.attacking && lifted >= 1) {
    lines.push({
      key: 'collected',
      tone: 'text-alloy',
      text: t('reports.effects.salvageTheirs', { amount: compact(lifted) }),
    });
  }
  if (report.wreckValue >= 1) {
    /*
      THE WRECKAGE IS ALWAYS OVER THE WORLD THAT WAS ATTACKED, which is the
      OPPONENT's world only when the reader is the attacker. Said with
      `opponentPlanet` on both sides, a defender was told their own dead ships
      were drifting over the raider's homeworld — and sent to the wrong end of the
      disc to collect them.
    */
    /*
      AND A PIRATE FIGHT HAS NO WORLD TO NAME. The field is real, harvestable and
      public — `Wrecks` draws it as an amber ring in open space and anyone may race
      for it — but it orbits nothing, so this line was sending the player to collect
      their salvage "over ." with the empty `opponentPlanet` interpolated into it.
    */
    lines.push({
      key: 'wreck',
      tone: 'text-alloy',
      text: report.pirate
        ? t('reports.effects.wreckVoid', { amount: compact(report.wreckValue) })
        : report.attacking
          ? t('reports.effects.wreck', {
              amount: compact(report.wreckValue),
              planet: report.opponentPlanet,
            })
          : t('reports.effects.wreckYours', { amount: compact(report.wreckValue) }),
    });
  }

  /*
    WHAT THE DEFEAT BROKE ON THE READER'S COLONY. Koloni arızaları, owner decision.

    Here rather than as notifications: those arrived beside "you were raided", did not fold,
    and never said the raid had caused them. On this page the cause and the effect are the
    same read. Named with the world, because a commander holding four worlds needs to know
    WHICH one to open.

    The `attacking` guard is belt and braces — the server already sends an attacker an
    empty list — because telling a raider which systems just went dark would be handing
    them a probe's product for free.
  */
  const broken = report.attacking ? [] : report.colonyFaults ?? [];
  if (broken.length > 0) {
    lines.push({
      key: 'faults',
      tone: 'text-threat-ink',
      text: t('reports.effects.colonyFaults', {
        planet: report.yourPlanet,
        faults: broken.map((kind) => t(`faults.name.${kind}`)).join(' · '),
      }),
    });
  }

  /*
    WHERE THIS DEFEAT LEFT THE READER AGAINST THE RECOVERY SHIELD. Owner instruction,
    2026-09-18: the bar is the NET loss of the last six hours, so a player needs to see
    how close the raids so far have brought them — the rule stated beside the figure,
    one tap from the defeat that moved it. Defender only; the server sends an attacker
    null, and the guard here keeps it that way on its own.
  */
  const recovery = report.attacking ? null : report.recovery ?? null;
  if (recovery && recovery.lossHours > 0) {
    const values = {
      hours: recovery.lossHours >= 999 ? '999+' : decimal(recovery.lossHours),
      bar: ABUSE.recoveryLossHours,
      window: ABUSE.recoveryLookbackHours,
      shield: ABUSE.recoveryShieldHours,
    };
    lines.push({
      key: 'recovery',
      tone: recovery.shielded ? 'text-opportunity' : 'text-dim',
      text: recovery.shielded
        ? t('reports.effects.recoveryEarned', values)
        : recovery.lossHours >= ABUSE.recoveryLossHours
          ? t('reports.effects.recoveryRefused', values)
          : t('reports.effects.recoveryProgress', values),
    });
  }

  if (lines.length === 0) return null;

  return (
    <div className="plate plate-inset mt-3 px-3 py-2">
      <p className="legend">{t('reports.effects.heading')}</p>
      <ul className="mt-2 grid gap-2">
        {lines.map((line) => (
          <li
            key={line.key}
            className={`text-caption leading-snug ${line.tone}`}
            {...(line.key === 'faults' ? { 'data-colony-faults': '' } : {})}
            {...(line.key === 'recovery' ? { 'data-recovery-shield': '' } : {})}
          >
            {line.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

type Round = OrdinaryReport['rounds'][number];

const hasCalculationTelemetry = (round: Round): boolean =>
  round.attackerRoll !== null
  && round.attackerRoll !== undefined
  && round.defenderRoll !== null
  && round.defenderRoll !== undefined
  && round.shieldBefore !== null
  && round.shieldBefore !== undefined
  && round.shieldAfter !== null
  && round.shieldAfter !== undefined
  && round.attackerHullDamage !== null
  && round.attackerHullDamage !== undefined;

function shieldState(report: OrdinaryReport): { before: number | null; after: number | null } {
  const first = report.rounds.find((round) => round.shieldBefore != null);
  const last = report.rounds.findLast((round) => round.shieldAfter != null);
  return {
    before: report.shieldBefore ?? first?.shieldBefore ?? null,
    after: report.shieldAfter ?? last?.shieldAfter ?? null,
  };
}

const shieldWasBroken = (report: OrdinaryReport): boolean => {
  const shield = shieldState(report);
  return shield.before !== null && shield.before > 0 && shield.after === 0;
};

/**
 * The resolver's fixed recipe, beside the battle's actual numbers.
 *
 * `pirate` swaps ONE line: the DECISIVE rule names a shield at zero, and a shield
 * is a structure on a world. Out at a rendezvous that clause describes a condition
 * the reader could never have met or failed, which is a legend teaching a rule that
 * does not exist here. Everything else — the counter cycle, the roll band, how
 * damage is split — is the model and applies to every fight there is.
 */
function CombatFormula({ grade, pirate = false }: { grade: Grade; pirate?: boolean }) {
  const { t } = useTranslation();
  return (
    <section data-combat-formula className="plate plate-inset mt-2 px-3 py-2">
      <p className="legend text-crystal">{t('reports.calculation.formulaHeading')}</p>
      <ol className="mt-2 grid gap-2 text-caption leading-relaxed text-dim">
        <li>{t('reports.calculation.formulaBase')}</li>
        <li>
          {t('reports.calculation.formulaCounter', {
            strong: decimal(COMBAT.strongMult, 1),
            weak: decimal(COMBAT.weakMult, 3),
          })}
        </li>
        <li>
          {t('reports.calculation.formulaRoll', {
            min: full(Math.abs((COMBAT.varianceMin - 1) * 100)),
            max: full((COMBAT.varianceMax - 1) * 100),
          })}
        </li>
      </ol>
      <div className="mt-3 grid gap-1 border-t border-line-soft pt-3 text-label leading-relaxed text-faint">
        <p>{t('reports.calculation.formulaHp')}</p>
        <p>{t('reports.calculation.formulaCarry')}</p>
        <p>{t('reports.calculation.formulaSupport')}</p>
      </div>
      <div className="mt-3 border-t border-line-soft pt-3">
        <p className="legend text-crystal">{t('reports.calculation.resultHeading')}</p>
        <ul className="mt-2 grid gap-2 text-label leading-relaxed text-dim">
          {(['DECISIVE', 'PARTIAL', 'REPELLED'] as const).map((result) => (
            <li
              key={result}
              className={result === grade ? 'text-bone' : undefined}
            >
              {t(
                pirate && result === 'DECISIVE'
                  ? 'reports.calculation.resultDecisivePirate'
                  : RESULT_EXPLANATION[result],
                {
                  threshold: full(COMBAT.partialThreshold * 100),
                  decisiveLoot: full(COMBAT.lootDecisive * 100),
                  partialLoot: full(COMBAT.lootPartial * 100),
                },
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * THE HULL A RAID TOWED HOME. D133 · D150.
 *
 * Given a combatant's portrait for the same reason the Aegis gets one: it is the
 * consequence the reader opened the report for. Everything else in a pirate report
 * is an accounting of what a fight cost; this is the one line that is a gain, and
 * it is a gain the shipyard could not have sold them.
 */
function CapturedHull({ hull }: { hull: HullId }) {
  const { t } = useTranslation();
  const art = HULL_ART[hull];

  return (
    <section
      data-captured-hull={hull}
      className="plate plate-inset relative mt-2 overflow-hidden p-3"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-opportunity/80 to-transparent"
      />
      <div className="flex items-center gap-2">
        <span className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-cell border border-opportunity/25 bg-opportunity/5">
          <span aria-hidden className="absolute inset-2 rounded-full bg-opportunity/10 blur-lg" />
          {art ? (
            <img src={art} alt="" aria-hidden className="relative size-16 object-contain" />
          ) : (
            <HullMark hull={hull} className="relative size-10 text-opportunity" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="legend text-opportunity">{t('reports.pirateCaptured')}</p>
          <p className="name mt-1 text-title text-bone">{hullLabel(hull)}</p>
          <p className="mt-2 text-caption leading-relaxed text-dim">
            {t('reports.pirateCapturedNote')}
          </p>
        </div>
      </div>
    </section>
  );
}

/** The Aegis is a combatant in the calculation, so it gets a combatant's portrait. */
function ShieldImpact({ report }: { report: OrdinaryReport }) {
  const { t } = useTranslation();
  const { before, after } = shieldState(report);
  if (before === null || after === null || before <= 0) return null;

  const remaining = Math.max(0, Math.min(100, Math.round(after / before * 100)));
  const status = after <= 0
    ? report.grade === 'DECISIVE' ? 'broken' : 'roundedZero'
    : after < before ? 'damaged' : 'held';
  // PARTIAL can mean surviving units OR a surviving shield. Rounded shield
  // telemetry alone is not proof of the unit state; only REPELLED proves it.
  const defendersRemain = report.grade === 'REPELLED';

  return (
    <section className="plate plate-inset relative mb-2 overflow-hidden p-3 mt-3">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-crystal/80 to-transparent"
      />
      <div className="flex items-center gap-2">
        <span className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-cell border border-crystal/25 bg-crystal/5">
          <span aria-hidden className="absolute inset-2 rounded-full bg-crystal/10 blur-lg" />
          <img
            src={instrumentArt('AEGIS', 1) ?? ''}
            alt={t('reports.aegis.aria')}
            width={64}
            height={64}
            loading="lazy"
            className={`relative size-16 object-contain ${after <= 0 ? 'opacity-45 grayscale' : ''}`}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-caption font-semibold text-crystal">
              {t(report.attacking ? 'reports.aegis.labelTheirs' : 'reports.aegis.labelYours')}
            </p>
            <span
              data-aegis-status={status}
              className={`chip ${
                status === 'broken' ? 'chip-threat'
                  : status === 'held' ? 'chip-opportunity' : 'chip-alloy'
              }`}
            >
              {t(`reports.aegis.${status}`)}
            </span>
          </div>
          <p className="mt-2 text-body leading-relaxed text-dim">
            {t('reports.aegis.note')}
          </p>
          {after <= 0 ? (
            <p
              data-aegis-outcome
              className={`mt-2 text-body font-semibold leading-relaxed ${
                defendersRemain ? 'text-alloy' : 'text-bone'
              }`}
            >
              {t(
                defendersRemain
                  ? 'reports.aegis.brokenUnitsRemain'
                  : report.grade === 'DECISIVE'
                    ? 'reports.aegis.brokenDefenceGone'
                    : 'reports.aegis.brokenMeaning',
              )}
            </p>
          ) : null}
        </div>
      </div>
      <div className="relative mt-3 grid grid-cols-2 gap-6 border-t border-line-soft pt-3">
        <div>
          <p className="legend text-faint">{t('reports.aegis.before')}</p>
          <p className="num mt-1 text-title text-bone">{full(before)}</p>
        </div>
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 -translate-x-1/2 text-caption text-faint"
        >
          →
        </span>
        <div className="text-right">
          <p className="legend text-faint">{t('reports.aegis.after')}</p>
          <p className={`num mt-1 text-title ${after <= 0 ? 'text-threat-ink' : 'text-crystal'}`}>
            {full(after)}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <div className="h-2 overflow-hidden rounded-cell bg-line-soft">
          <span
            data-shield-remaining={remaining}
            className="block h-full bg-gradient-to-r from-crystal/65 to-crystal"
            style={{ width: `${String(remaining)}%` }}
          />
        </div>
        <p className="num mt-2 text-right text-label text-crystal">
          {t('reports.aegis.absorbed', { amount: full(report.shieldAbsorbed) })}
        </p>
      </div>
    </section>
  );
}

function BattleRound({ report, round }: { report: OrdinaryReport; round: Round }) {
  const { t } = useTranslation();
  return (
    <section
      data-combat-round={round.round}
      className="border-b border-line-soft p-3 last:border-b-0"
      aria-label={t('reports.calculation.round', { round: round.round })}
    >
      <h4 className="mb-3 text-title font-semibold text-bone">
        {t('reports.calculation.round', { round: round.round })}
      </h4>
      <RoundBalance
        dealt={report.attacking ? round.attackerDamage : round.defenderDamage}
        took={report.attacking ? round.defenderDamage : round.attackerDamage}
      />
      {round.shieldAbsorbed > 0 ? (
        <p className="mt-2 text-body text-crystal">
          {t('reports.roundShield', { amount: full(round.shieldAbsorbed) })}
        </p>
      ) : null}
      <RoundCasualties
        yours={report.attacking ? round.attackerLosses : round.defenderLosses}
        theirs={report.attacking ? round.defenderLosses : round.attackerLosses}
      />
      <RoundStanding report={report} round={round} />
      {hasCalculationTelemetry(round) ? (
        <details className="mt-2 border-t border-line-soft">
          <summary className="cursor-pointer py-3 text-body text-crystal focus-visible:outline focus-visible:outline-2 focus-visible:outline-crystal">
            {t('reports.roundCalculationToggle')}
          </summary>
          <RoundCalculation report={report} round={round} />
        </details>
      ) : null}
    </section>
  );
}

function RoundCalculation({ report, round }: { report: OrdinaryReport; round: Round }) {
  const { t } = useTranslation();
  const yourRoll = report.attacking ? round.attackerRoll! : round.defenderRoll!;
  const theirRoll = report.attacking ? round.defenderRoll! : round.attackerRoll!;
  const yourPower = report.attacking ? round.attackerDamage : round.defenderDamage;
  const theirPower = report.attacking ? round.defenderDamage : round.attackerDamage;
  const before = round.shieldBefore!;
  const after = round.shieldAfter!;

  return (
    <div data-round-calculation>
      <div className="grid grid-cols-2 gap-2">
        <ShotCard label={t('reports.calculation.yourShot')} power={yourPower} roll={yourRoll} />
        <ShotCard label={t('reports.calculation.theirShot')} power={theirPower} roll={theirRoll} />
      </div>

      {/*
        STEP 2 IS ABOUT A BUILDING, AND OUT HERE THERE IS NO BUILDING.

        An Aegis is a structure on a world; `settleArrival` passes `shield: 0` for
        exactly that reason. So a pirate report printed "No active Aegis" on every
        round — a verdict about the absence of a system that could not have been
        present, which tells the reader a shield was a thing that might have
        happened here. The step is real and stays; what it reports on is different.
      */}
      <div className="mt-2 border-t border-line-soft pt-3">
        <p className="legend text-crystal">
          {t(
            report.pirate
              ? 'reports.calculation.openSpace'
              : before > 0
                ? 'reports.calculation.aegis'
                : 'reports.calculation.noAegis',
          )}
        </p>
        {report.pirate ? (
          <p className="mt-2 text-caption leading-relaxed text-dim">
            {t('reports.calculation.openSpaceNote', { amount: full(round.attackerHullDamage!) })}
          </p>
        ) : before > 0 ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="plate px-3 py-2">
              <p className="legend text-faint">{t('reports.calculation.shieldCharge')}</p>
              <p className="num mt-1 text-title text-crystal">
                {full(before)} <span className="text-faint">→</span> {full(after)}
              </p>
              <p className="mt-1 text-label text-dim">
                {t('reports.calculation.absorbed', { amount: full(round.shieldAbsorbed) })}
              </p>
            </div>
            <div className="plate px-3 py-2">
              <p className="legend text-faint">{t('reports.calculation.reachedHulls')}</p>
              <p className="num mt-1 text-title text-bone">{full(round.attackerHullDamage!)}</p>
              {round.shieldBreakerDamage > 0 ? (
                <p className="mt-1 text-label text-deuterium">
                  {t('reports.calculation.shieldBreaker', { amount: full(round.shieldBreakerDamage) })}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-caption leading-relaxed text-dim">
            {t('reports.calculation.noAegisNote', { amount: full(round.attackerHullDamage!) })}
          </p>
        )}
      </div>

    </div>
  );
}

function ShotCard({ label, power, roll }: { label: string; power: number; roll: number }) {
  const { t } = useTranslation();
  const change = Math.round((roll - 1) * 100);
  const changeKey = change > 0
    ? 'reports.calculation.positivePercent'
    : change < 0
      ? 'reports.calculation.negativePercent'
      : 'reports.calculation.neutralPercent';
  return (
    <div className="plate px-3 py-2">
      <p className="legend text-faint">{label}</p>
      <p className="num mt-1 text-title text-bone">{full(power)}</p>
      <p className={`num mt-1 text-label ${change >= 0 ? 'text-opportunity' : 'text-threat-ink'}`}>
        <span className="text-faint">{t('reports.calculation.shotChange')} </span>
        {t(changeKey, { amount: full(Math.abs(change)) })}
      </p>
    </div>
  );
}

/**
 * The caller's own board: what went in, what died, what was standing at the end.
 *
 * `left` adds the ground units that rebuilt themselves, because a defender who is
 * told they lost seven Bastions and finds four still there is being told two
 * different things by the same game.
 */
/**
 * ONE HULL OF A FORCE: what it is, and what happened to it.
 *
 * Shared by both sides of the sheet — the reader's own board and, since D164, the
 * force that arrived at them. The two are the same reading of the same fight from
 * opposite ends, so they are the same row; only `side` differs, and it changes
 * nothing but which half of the bar is the good news.
 */
function ForceRow({
  hull,
  sent,
  lost,
  rebuilt = 0,
  side = 'yours',
  attacking = true,
}: {
  hull: HullId;
  sent: number;
  lost: number;
  rebuilt?: number;
  side?: 'yours' | 'theirs';
  attacking?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div data-force-row={hull} className="grid gap-2 border-b border-line-soft p-3 last:border-b-0 sm:grid-cols-[8rem_1fr] sm:items-center sm:gap-4">
      <span className="flex min-w-0 items-center gap-2">
        {HULL_ART[hull] ? (
          <img src={HULL_ART[hull]} alt="" aria-hidden width={32} height={32} className="size-8 object-contain" />
        ) : (
          <span aria-hidden className="legend w-6 text-center">GRD</span>
        )}
        <span className="min-w-0">
          <span className="block text-body font-semibold text-bone">{hullLabel(hull)}</span>
          <span className="mt-1 block text-label text-dim">{t(
            HULLS[hull].ground ? 'reports.force.groundType'
              : HULLS[hull].atk === 0 ? 'reports.force.supportType' : 'reports.force.combatType',
          )}</span>
        </span>
      </span>
      <SurvivorBar
        sent={sent} lost={lost} rebuilt={rebuilt} side={side}
        sentLabel={t(side === 'theirs' ? 'reports.force.arrived' : attacking ? 'reports.verdict.sent' : 'reports.force.held')}
        leftLabel={t(side === 'yours' && attacking && !HULLS[hull].ground ? 'reports.verdict.returned' : 'reports.force.left')}
      />
    </div>
  );
}

/**
 * THE CALLER'S OWN BOARD — what went in, what died, what is standing.
 *
 * THIS WAS A FOUR-COLUMN TABLE: hull, sent, lost, left, once per row, with a
 * summary sentence under it. Every figure was right, and the one question a player
 * opens a report holding — *did I get away with it* — had to be assembled out of
 * three of them and then compared against the row above. The owner's report was
 * that they could not read it.
 *
 * Now each hull is a `SurvivorBar`: the proportion that came home, drawn. A raid
 * that cost half the fleet looks like half the fleet, and the rows can be compared
 * down the column by shape rather than by arithmetic.
 *
 * `left` still adds the ground units that rebuilt themselves, because a defender
 * told they lost seven Bastions who finds four still standing is being told two
 * different things by the same screen — and salvage is its own colour on the bar
 * for exactly that reason.
 */
function YourForce({ report }: { report: OrdinaryReport }) {
  const { t } = useTranslation();
  const entries = fleetEntries(report.yourFleet);
  const brought = entries.reduce((sum, [, n]) => sum + n, 0);
  const lost = fleetEntries(report.yourLosses).reduce((sum, [, n]) => sum + n, 0);
  const rebuilt = fleetEntries(report.defenceSalvage).reduce((sum, [, n]) => sum + n, 0);

  return (
    <div className="plate plate-inset mt-2">
      {entries.map(([hull, count]) => (
        <ForceRow
          key={hull}
          hull={hull}
          sent={count}
          lost={report.yourLosses[hull] ?? 0}
          rebuilt={report.defenceSalvage[hull] ?? 0}
          attacking={report.attacking}
        />
      ))}
      {/*
        THE SAME PICTURE FOR THE WHOLE FORCE, which is the line a player reads
        first and the one the table only ever had as a sentence.
      */}
      <div className="grid gap-2 border-t border-line p-3 sm:grid-cols-[8rem_1fr] sm:items-center sm:gap-4">
        <span className="text-body font-semibold text-bone">
          {t('reports.verdict.total')}
        </span>
        <SurvivorBar sent={brought} lost={lost} rebuilt={rebuilt}
          sentLabel={t(report.attacking ? 'reports.verdict.sent' : 'reports.force.held')}
          leftLabel={t(report.attacking ? 'reports.verdict.returned' : 'reports.force.left')}
        />
      </div>
    </div>
  );
}

/**
 * Hulls that came off the board this round, each side on its own labelled line.
 *
 * THE LABEL IS NOT DECORATION. Both sides fly Wasps, so a round in which each lost
 * some rendered as "−11 Wasp −3 Wasp" — two identical phrases separated by nothing
 * but a colour, which on a phone in daylight reads as a typo rather than as two
 * facts. Whose casualty it is has to be a WORD.
 */
function RoundCasualties({
  yours,
  theirs,
}: {
  yours: OrdinaryReport['yourLosses'];
  theirs: OrdinaryReport['yourLosses'];
}) {
  const { t } = useTranslation();
  const mine = fleetEntries(yours);
  const others = fleetEntries(theirs);
  const line = (label: string, entries: ReturnType<typeof fleetEntries>, tone: string) => (
    <div className="min-w-0">
      <p className="text-body font-semibold text-bone">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
      {entries.map(([hull, count]) => (
        <span key={hull} className={`rounded-cell border border-line-soft px-2 py-1 text-body ${tone}`}>
          {full(count)} {hullLabel(hull)}
        </span>
      ))}
      {entries.length === 0 ? <span className="text-body text-dim">{t('reports.roundNoCasualties')}</span> : null}
      </div>
    </div>
  );

  return (
    <div data-round-losses className="mt-3 grid gap-3 border-t border-line-soft pt-3 sm:grid-cols-2">
      {line(t('reports.roundLossesYours'), mine, 'text-threat-ink')}
      {line(t('reports.roundLossesTheirs'), others, 'text-bone')}
    </div>
  );
}

/**
 * The casualty list says what left the board; this line says what that meant for
 * the next round. Support craft cannot fire, so keeping them visually inside one
 * undifferentiated "remaining" total is the exact ambiguity that made a stranded
 * cargo wing look like a surviving attack force.
 */
function RoundStanding({ report, round }: { report: OrdinaryReport; round: Round }) {
  const { t } = useTranslation();
  const standing = forceAfterRound(report, round);
  const enemy = !report.attacking ? forceAfterRound(report, round, true) : null;
  if (!standing && !enemy) return null;
  const noForce = standing?.combat === 0 && standing.support === 0;
  const supportExposed = standing?.combat === 0 && standing.support > 0;

  return (
    <div
      data-round-standing={round.round}
      className={`mt-3 border-l-2 pl-3 ${
        noForce || supportExposed ? 'border-threat' : 'border-line'
      }`}
    >
      <p className="text-caption font-semibold text-bone">
        {t('reports.roundStanding.heading', { round: round.round })}
      </p>
      <p className="mt-1 text-body leading-relaxed text-dim">
        {standing ? t('reports.roundStanding.summary', {
          combat: full(standing.combat), support: full(standing.support),
        }) : t('reports.roundStanding.unknownOwn')}
      </p>
      {supportExposed ? (
        <p className="mt-1 text-body font-semibold leading-relaxed text-threat-ink">
          {t('reports.roundStanding.supportExposed')}
        </p>
      ) : noForce ? (
        <p className="mt-1 text-body font-semibold leading-relaxed text-threat-ink">
          {t('reports.roundStanding.noneLeft')}
        </p>
      ) : null}
      {enemy ? (
        <div data-enemy-round-standing className="mt-2 border-t border-line-soft pt-2">
          <p className="text-caption font-semibold text-bone">
            {t('reports.roundStanding.enemyHeading', { round: round.round })}
          </p>
          <p className="mt-1 text-body text-dim">
            {t('reports.roundStanding.summary', { combat: full(enemy.combat), support: full(enemy.support) })}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function CombatTurningPoint({ report }: { report: OrdinaryReport }) {
  const { t } = useTranslation();
  if (!report.attacking || !fleetEntries(report.yourFleet).some(([hull]) => HULLS[hull].atk > 0)) return null;
  const depleted = report.rounds.find((round) => forceAfterRound(report, round)?.combat === 0);
  if (!depleted) return null;
  const standing = forceAfterRound(report, depleted);
  if (!standing) return null;
  return (
    <p data-combat-turning-point className="mt-2 text-body font-semibold leading-relaxed text-bone">
      {t(standing.support > 0 ? 'reports.turningPointSupport' : 'reports.turningPointWiped', {
        round: depleted.round,
        support: full(standing.support),
      })}
    </p>
  );
}

function ClanAtLaunch({
  label,
  clan,
}: {
  label: string;
  clan: OrdinaryReport['attackerClan'];
}) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0">
      <p className="legend">{label}</p>
      {clan ? (
        <p className="mt-1 truncate text-caption text-bone" title={clan.name}>
          <span className="text-crystal">[{clan.tag}]</span> {clan.name}
        </p>
      ) : (
        <p className="mt-1 text-caption text-faint">{t('reports.noClan')}</p>
      )}
    </div>
  );
}

function BattleVerdict({ report }: { report: OrdinaryReport }) {
  const { t } = useTranslation();
  const starting = unitCount(report.yourFleet);
  const yours = unitCount(report.yourLosses);
  const theirs = unitCount(report.theirLosses);
  const rebuilt = unitCount(report.defenceSalvage);
  const remaining = Math.max(0, starting - yours) + rebuilt;
  // A no-round decisive defence with an empty roster is a known zero: the
  // resolver only produces that shape when no defending unit stood at contact.
  // Other empty rosters remain unknown because historical cached reports used
  // the same empty-object fallback for an unrecorded starting force.
  const rosterKnown = starting > 0
    || (!report.attacking && report.grade === 'DECISIVE' && report.rounds.length === 0);
  const won = report.attacking
    ? report.grade !== 'REPELLED' && (!rosterKnown || remaining > 0)
    : report.grade === 'REPELLED';
  const title = verdictTitle(report);

  return (
    <section
      data-battle-verdict={report.grade}
      className={`plate relative mb-3 overflow-hidden p-3 mt-2 ${
        won ? 'plate-opportunity' : 'plate-threat'
      }`}
      aria-label={title}
    >
      <span
        aria-hidden
        className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${
          won ? 'via-opportunity/80' : 'via-threat/80'
        } to-transparent`}
      />

      <div>
        <h3 className="text-title font-semibold text-bone">
          {t(rosterKnown ? 'reports.verdict.yourForce' : 'reports.verdict.yourLosses')}
        </h3>
        <div className={`mt-3 grid ${rosterKnown ? 'grid-cols-3' : 'grid-cols-1'} divide-x divide-line-soft`}>
          {rosterKnown ? (
            <BattleMetric
              label={t(report.attacking ? 'reports.verdict.sent' : 'reports.verdict.held')}
              value={starting}
            />
          ) : null}
          <BattleMetric label={t('reports.verdict.lost')} value={yours} tone="text-threat-ink" />
          {rosterKnown ? (
            <BattleMetric
              label={t(report.attacking ? 'reports.verdict.returned' : 'reports.verdict.standing')}
              value={remaining}
              tone={remaining > 0 ? 'text-opportunity' : 'text-threat-ink'}
            />
          ) : null}
        </div>
        {rosterKnown ? (
          <div className="mt-3 border-t border-line-soft pt-3">
            <SurvivorBar
              sent={starting}
              lost={yours}
              rebuilt={rebuilt}
              showFigures={false}
            />
          </div>
        ) : null}
      </div>
      {!rosterKnown ? (
        <p data-own-roster-unknown className="mt-2 text-body leading-relaxed text-alloy">
          {t('reports.verdict.rosterUnknown')}
        </p>
      ) : null}

      <div
        data-verdict-summary
        className={`mt-3 border-l-2 pl-3 ${won ? 'border-opportunity' : 'border-threat'}`}
      >
        <p className="text-body font-semibold leading-relaxed text-bone">
          {t(report.rounds.length === 0
            ? 'reports.verdict.walkoverSummary'
            : report.pirate && report.grade === 'PARTIAL'
              ? 'reports.verdict.piratePartialSummary'
              : `reports.verdict.summary.${report.attacking ? 'attacking' : 'defending'}.${report.grade}`)}
        </p>
        {report.attacking && rosterKnown ? (
          <p className={`mt-1 text-body leading-relaxed ${remaining === 0 ? 'text-threat-ink' : 'text-dim'}`}>
            {t(
              remaining === 0
                ? 'reports.verdict.noneReturned'
                : 'reports.verdict.someReturned',
              { count: remaining },
            )}
          </p>
        ) : null}
        {!report.attacking && rebuilt > 0 ? (
          <p className="mt-2 text-body leading-relaxed text-opportunity">
            {t('reports.force.rebuiltNote', { count: full(rebuilt) })}
          </p>
        ) : null}
      </div>

      <dl data-verdict-payoff className="mt-3 grid grid-cols-2 gap-3 border-t border-line-soft pt-3">
        <div>
          <dt className="text-body text-dim">{t(report.attacking ? 'reports.verdict.loot' : 'reports.haulLost')}</dt>
          <dd className="num mt-1 text-title text-alloy">
            {full(Math.abs(report.lootAlloy + report.lootCrystal + report.lootDeuterium))}
          </dd>
        </div>
        {report.dominion !== null ? (
          <div>
            <dt className="text-body text-dim">{t('reports.dominion')}</dt>
            <dd className={`num mt-1 text-title ${report.dominion < 0 ? 'text-threat-ink' : 'text-bone'}`}>
              {signed(report.dominion)}
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-3 border-t border-line-soft pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-caption font-semibold text-dim">
            {t(report.attacking ? 'reports.verdict.enemyDestroyed' : 'reports.verdict.attackerDestroyed')}
          </p>
          <p className={`num text-title leading-none ${theirs > 0 ? 'text-bone' : 'text-dim'}`}>
            {full(theirs)}
          </p>
        </div>
        {report.attacking && report.grade !== 'DECISIVE' ? (
          <p className="mt-2 text-body font-semibold leading-relaxed text-alloy">
            {t(report.grade === 'REPELLED' ? 'reports.verdict.enemySurvivedNote' : 'reports.verdict.enemyUnknownNote')}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function RoundBalance({ dealt, took }: { dealt: number; took: number }) {
  const { t } = useTranslation();
  const top = Math.max(1, dealt, took);
  return (
    <span className="grid gap-2">
      <span className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
        <span className="text-body text-bone">{t('reports.roundDealt')}</span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-cell bg-line-soft">
          <span className="block h-full bg-opportunity" style={{ width: `${String((dealt / top) * 100)}%` }} />
        </span>
        <span className="num min-w-14 text-right text-body text-bone">{full(dealt)}</span>
      </span>
      <span className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
        <span className="text-body text-threat-ink">{t('reports.roundTook')}</span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-cell bg-line-soft">
          <span className="block h-full bg-threat" style={{ width: `${String((took / top) * 100)}%` }} />
        </span>
        <span className="num min-w-14 text-right text-body text-bone">{full(took)}</span>
      </span>
    </span>
  );
}

function BattleMetric({
  label,
  value,
  tone = 'text-bone',
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="min-w-0 px-2 first:pl-0 last:pr-0">
      <p className="text-body text-dim">{label}</p>
      <p className={`num mt-1 text-figure ${tone}`}>{full(value)}</p>
    </div>
  );
}

function Losses({ fleet, tone, empty }: { fleet: OrdinaryReport['yourLosses']; tone: string; empty: string }) {
  const entries = fleetEntries(fleet);
  if (entries.length === 0) {
    return <p className="mt-2 text-body text-faint">{empty}</p>;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {entries.map(([hull, count]) => (
        <div key={hull} className="plate plate-inset flex items-center gap-2 px-3 py-2">
          {HULL_ART[hull] ? (
            <img src={HULL_ART[hull]} alt="" aria-hidden className="size-8 object-contain" />
          ) : (
            <span className="legend">GRD</span>
          )}
          <div>
            <p className={`num text-title leading-none ${tone}`}>{full(count)}</p>
            <p className="legend mt-1">{hullLabel(hull)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * WHAT WAS ON THE OTHER SIDE, AND HOW FAR THE READING GOES. Owner report.
 *
 * Two questions a commander comes home with, and the sheet answered neither in a
 * way they could act on: *what did they have*, and *was there a wall*.
 *
 * THE BOUND IS THE HEADING. On DECISIVE the losses are the whole board — nothing
 * survived, so the subtraction fog refuses has no secret left in it — and the
 * reader may treat the list as total. On PARTIAL or REPELLED it is a floor, and
 * the note says so and names the instrument that closes the gap. A short list with
 * no bound on it is what made a bounded report read as a broken one.
 *
 * THE WALL IS ITS OWN GROUP. A Bastion listed beside a Dart looks like one more
 * hull the defender flew; it cannot fly, cannot loot, takes no Dominion, is priced
 * at 1.6x for exactly that reason, and 60% of it walks back out of its own
 * wreckage. "Was there ground defence" is one of the three questions an attacker
 * returns with, and until now it was answerable only by recognising two hull names.
 *
 * ABSENCE IS ONLY CLAIMED FROM A COMPLETE READING. "No ground defence" off a
 * PARTIAL would be the report inventing the single fact a commander would bet
 * their next fleet on.
 */
function TheirBoard({ report }: { report: OrdinaryReport }) {
  const { t } = useTranslation();
  /*
    THE DEFENDER IS NOT READING WRECKAGE. D164.

    When the server sent the force that arrived, that force IS the answer to "what
    was on the other side" — so the floor framing below is not softened here, it is
    replaced. "At least this much" is a statement about a reading with a bound, and
    this reading has none: the reader stood under this squadron while it fired.

    Empty for an attacker, and for any report written before the roster was stored,
    both of which fall through to the wreckage exactly as before.
  */
  const arrived = fleetEntries(report.theirFleet);
  if (!report.attacking && arrived.length > 0) return <IncomingForce report={report} entries={arrived} />;

  // A decisive result proves completeness only to the attacker. On a legacy
  // defender report without `theirFleet`, the casualty list is still not the
  // attacker's complete arriving roster.
  const complete = report.attacking && report.grade === 'DECISIVE';
  const entries = fleetEntries(report.theirLosses);
  const emptyAtStart = complete && report.rounds.length === 0 && entries.length === 0;
  const ground = entries.filter(([hull]) => HULLS[hull].ground);
  const ships = entries.filter(([hull]) => !HULLS[hull].ground);

  const asFleet = (rows: [HullId, number][]): OrdinaryReport['theirLosses'] =>
    Object.fromEntries(rows);

  return (
    <section data-their-board={complete ? 'complete' : 'floor'} className="mt-3">
      <div className={complete ? '' : 'border-l-2 border-alloy pl-3'}>
        <h3 className="text-body font-semibold text-bone">
          {emptyAtStart
            ? t('reports.theirBoardEmptyAtStart')
            : entries.length === 0 && !complete
            ? t('reports.theirBoardNothing')
            : t(complete ? 'reports.theirBoardComplete' : 'reports.theirBoardFloor')}
        </h3>
        <p className={`mt-1 text-body leading-relaxed ${complete ? 'text-dim' : 'text-alloy'}`}>
          {t(emptyAtStart ? 'reports.theirBoardEmptyAtStartNote'
            : complete ? 'reports.theirBoardCompleteNote'
            : report.attacking ? 'reports.theirBoardFloorNote' : 'reports.theirBoardMissingRosterNote')}
        </p>
      </div>

      {ships.length > 0 && (
        <>
          <p className="legend mt-2 text-crystal/85">{t('reports.shipsHeading')}</p>
          <Losses fleet={asFleet(ships)} tone="text-bone" empty={t('reports.theirsEmpty')} />
        </>
      )}

      {ground.length > 0 ? (
        <div data-ground-group className="mt-2">
          <p className="legend text-alloy">{t('reports.groundHeading')}</p>
          <p className="mt-1 text-body leading-relaxed text-dim">
            {t('reports.groundNote', { percent: full(COMBAT.defenceSalvage * 100) })}
          </p>
          <Losses fleet={asFleet(ground)} tone="text-alloy" empty={t('reports.theirsEmpty')} />
        </div>
      ) : complete && !emptyAtStart ? (
        /* Only a DECISIVE proves a negative. See the docblock. */
        <div data-no-ground className="mt-2 border-l border-line-soft pl-3">
          <p className="legend text-faint">{t('reports.noGroundHeading')}</p>
          <p className="mt-1 text-caption leading-snug text-faint">{t('reports.noGroundNote')}</p>
        </div>
      ) : null}
    </section>
  );
}

/**
 * WHAT CAME AT YOU, AND HOW MUCH OF IT WENT HOME. D164.
 *
 * The same shape as the reader's own force above, read from the other end, and
 * that symmetry is the point: one bar per hull, the width of what arrived, with
 * the part of it that died drawn on the bar. A defender's two questions about a
 * raid are *what did they bring* and *did I hurt them*, and they are the same
 * picture.
 *
 * THE COLOURS ARE REVERSED, BECAUSE THE SIDE IS. On the reader's own force, solid
 * means survived and red means lost. Here the survivors are the half that matters
 * and the half that is bad news — a squadron flying home with your ore, which will
 * come back — so they carry the threat colour, and what the defence destroyed is
 * drawn in the green this interface uses for a gain. The bar never changes what it
 * measures; it changes whose it is.
 */
function IncomingForce({
  report,
  entries,
}: {
  report: OrdinaryReport;
  entries: [HullId, number][];
}) {
  const { t } = useTranslation();
  const arrived = entries.reduce((sum, [, count]) => sum + count, 0);
  const destroyed = fleetEntries(report.theirLosses).reduce((sum, [, n]) => sum + n, 0);

  return (
    <section data-their-board="arrived" className="mt-3">
      <h3 className="text-body font-semibold text-bone">{t('reports.theirBoardArrived')}</h3>
      <p className="mt-1 text-body leading-relaxed text-dim">
        {t('reports.theirBoardArrivedNote')}
      </p>
      <div className="plate plate-inset mt-2">
        {entries.map(([hull, count]) => (
          <ForceRow
            key={hull}
            hull={hull}
            sent={count}
            lost={report.theirLosses[hull] ?? 0}
            side="theirs"
          />
        ))}
        <div className="grid gap-2 border-t border-line p-3 sm:grid-cols-[8rem_1fr] sm:items-center sm:gap-4">
          <span className="text-body font-semibold text-bone">{t('reports.verdict.total')}</span>
          <SurvivorBar sent={arrived} lost={destroyed} side="theirs" sentLabel={t('reports.force.arrived')} />
        </div>
      </div>
    </section>
  );
}
