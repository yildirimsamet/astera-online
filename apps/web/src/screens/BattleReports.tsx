import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { COMBAT, fleetEntries, type Grade } from '@astera/rules';
import { useReports } from '../api/queries.js';
import type { BattleReport, Report, StrategicBattleReport } from '../api/schemas.js';
import i18n from '../i18n/index.js';
import { hullLabel } from '../i18n/names.js';
import { compact, decimal, full, signed } from '../lib/format.js';
import { duration, staleness, useNow } from '../lib/time.js';
import { HULL_ART, RESOURCE_ART, instrumentArt } from '../ui/assets.js';
import { SurvivorBar } from '../ui/SurvivorBar.js';
import { EmptyState, Section, Unreachable } from '../ui/kit/index.js';
import { Sheet } from '../ui/kit/index.js';

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
const GRADE = {
  DECISIVE: 'reports.gradeDecisive',
  PARTIAL: 'reports.gradePartial',
  REPELLED: 'reports.gradeRepelled',
} as const satisfies Record<Grade, string>;

const RESULT_EXPLANATION = {
  DECISIVE: 'reports.calculation.resultDecisive',
  PARTIAL: 'reports.calculation.resultPartial',
  REPELLED: 'reports.calculation.resultRepelled',
} as const satisfies Record<Grade, string>;

const gradeWord = (grade: Grade): string => i18n.t(GRADE[grade]);

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
const opponentOf = (report: OrdinaryReport): string =>
  report.neutral ? i18n.t('reports.neutralHolder') : report.opponentName;

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
    const report = reports.find((candidate) => candidate.missionId === requestedMissionId);
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
              className="flex w-full items-center gap-3 border-b border-line-soft p-3 text-left last:border-b-0"
            >
              <GradeMark report={report} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body text-bone">
                  {t(report.attacking ? 'reports.youRaided' : 'reports.raidedBy')}
                  {opponentClan ? (
                    <span className="mr-1 text-crystal" title={opponentClan.name}>[{opponentClan.tag}]</span>
                  ) : null}
                  <span className="text-dim">{opponentOf(report)}</span>
                </p>
                <p className="num mt-1 text-label text-faint">
                  {report.opponentPlanet} · {staleness((now - report.at.getTime()) / 60_000)} ·{' '}
                  {t('reports.rounds', { count: report.rounds.length })}
                </p>
              </div>
              {/*
                A SWING OF ZERO IS NOT A FIGURE. Every raid on a caretaker world
                moves nobody's score, and so does a raid repelled without losses —
                so the chip printed "0" on exactly the rows where the ladder had
                nothing to say. Shown when it moved; omitted when it did not.
              */}
              {report.dominion !== null && Math.round(report.dominion) !== 0 && (
                <span
                  className={`num text-body ${report.dominion >= 0 ? 'text-opportunity' : 'text-threat'}`}
                >
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
      className="flex w-full items-center gap-3 border-b border-line-soft p-3 text-left last:border-b-0"
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
          <div className="plate plate-inset grid grid-cols-2 gap-3 p-3">
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
  const won = report.attacking ? report.grade !== 'REPELLED' : report.grade === 'REPELLED';
  return (
    <span
      className={`chip shrink-0 ${won ? 'chip-opportunity' : 'chip-threat'}`}
      title={gradeWord(report.grade)}
    >
      {gradeWord(report.grade)}
    </span>
  );
}

function ReportSheet({ report, onClose }: { report: OrdinaryReport; onClose: () => void }) {
  const { t } = useTranslation();
  const looted = report.lootAlloy + report.lootCrystal + report.lootDeuterium;
  const yourClan = report.attacking ? report.attackerClan : report.defenderClan;
  const theirClan = report.attacking ? report.defenderClan : report.attackerClan;

  return (
    <Sheet
      eyebrow={t(report.attacking ? 'reports.sheetYouRaided' : 'reports.sheetTheyRaided', {
        opponent: opponentOf(report),
      })}
      title={gradeWord(report.grade)}
      onClose={onClose}
    >
      <BattleVerdict report={report} />
      <ShieldImpact report={report} />

      {yourClan || theirClan ? (
        <div className="plate plate-inset mb-4 px-3 py-3">
          <p className="legend text-crystal">{t('reports.clansAtLaunch')}</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <ClanAtLaunch label={t('reports.yourClan')} clan={yourClan} />
            <ClanAtLaunch label={t('reports.theirClan')} clan={theirClan} />
          </div>
        </div>
      ) : null}

      {/*
        WHERE IT HAPPENED, IN ONE LINE, BEFORE ANYTHING ELSE.

        A commander may hold four worlds since D97, and "Raided by Sable" stopped
        saying WHICH of theirs was hit — the most actionable fact there is, absent
        from the record of it. Said as a route rather than as two facts, because a
        battle has two ends and the reader is always at one of them.
      */}
      {report.yourPlanet && (
        <p className="num mb-3 flex items-center gap-2 text-label text-faint">
          <span className="text-bone">{report.yourPlanet}</span>
          <span aria-hidden>{report.attacking ? '→' : '←'}</span>
          <span>{report.opponentPlanet}</span>
        </p>
      )}

      <p className="text-body leading-relaxed text-dim">
        {report.attacking
          ? t(report.grade === 'REPELLED' ? 'reports.heldAgainstYou' : 'reports.brokenByYou', {
              planet: report.opponentPlanet,
            })
          : t(report.grade === 'REPELLED' ? 'reports.youHeld' : 'reports.youFell')}
      </p>

      {/*
        WHY THIS WORD, AND NOT THE OTHER TWO.

        DECISIVE, PARTIAL and REPELLED are printed in caps at the top of every
        report and nothing in the game had ever said what separates them. A player
        who reads "PARTIAL" twice and cannot tell whether they were close has been
        given a stamp, not a report — and the grade is what sets the loot share and
        how long the works stay down, so it is the single most consequential word
        on the surface.
      */}
      <p className="mt-2 text-caption leading-relaxed text-faint">
        {t(
          `reports.why.${report.attacking ? 'attacking' : 'defending'}.${
            report.grade === 'DECISIVE' && !shieldWasBroken(report)
              ? 'DECISIVE_WITHOUT_SHIELD'
              : report.grade
          }` as
            'reports.why.attacking.DECISIVE',
        )}
      </p>

      {/*
        THE THREE NUMBERS A PLAYER ACTUALLY FEELS: what came away, what it cost,
        and what it moved on the ladder.

        `Rounds` used to lead this row, and it is the least consequential figure on
        the surface — a fixed three at most, decided by the combat model rather than
        by anything the player chose. It is still in the list row and it is the whole
        of "How it went" below. What belongs beside the haul is its PRICE, which was
        buried two sections down in a table.
      */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Figure
          label={t('reports.shipsLost')}
          value={full(fleetEntries(report.yourLosses).reduce((sum, [, n]) => sum + n, 0))}
          tone={
            fleetEntries(report.yourLosses).length > 0 ? 'text-threat-ink' : 'text-dim'
          }
        />
        <Figure
          label={t(looted >= 0 ? 'reports.taken' : 'reports.lost')}
          value={compact(Math.abs(looted))}
          tone={looted >= 0 ? 'text-alloy' : 'text-threat'}
        />
        {report.dominion !== null && Math.round(report.dominion) !== 0 && (
          <Figure
            label={t('reports.dominion')}
            value={signed(report.dominion)}
            tone={report.dominion >= 0 ? 'text-opportunity' : 'text-threat'}
          />
        )}
      </div>

      {looted !== 0 && (
        <p className="legend mt-4">{t(looted >= 0 ? 'reports.haul' : 'reports.haulLost')}</p>
      )}
      {looted !== 0 && (
        <p className="num mt-1 flex items-center gap-3 text-caption">
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

      <Consequences report={report} />

      {/*
        THE PART THAT FEEDS THE NEXT DECISION.

        What they fielded is the most accurate reading anyone in this game ever
        gets — no bands, no staleness, no clarity gradient. It is what makes the
        fight you just had worth something the next time you look at that planet.
      */}
      <h3 className="legend mt-8">{t('reports.theirLosses')}</h3>
      <Losses fleet={report.theirLosses} tone="text-bone" empty={t('reports.theirsEmpty')} />

      {/*
        AND THE PART THAT GIVES YOUR OWN LOSSES A DENOMINATOR.

        "You lost 12 Wasp" is a disaster out of fifteen and a rounding error out
        of eighty, and until D121 the report could not tell those two apart. The
        roster is the caller's own board, so it discloses nothing: this is the one
        force in the fight the reader already commanded.
      */}
      <h3 className="legend mt-6">
        {t(fleetEntries(report.yourFleet).length > 0 ? 'reports.yourForce' : 'reports.yours')}
      </h3>
      {fleetEntries(report.yourFleet).length > 0 ? (
        <YourForce report={report} />
      ) : (
        <Losses fleet={report.yourLosses} tone="text-threat-ink" empty={t('reports.yoursEmpty')} />
      )}

      <h3 className="legend mt-8">{t('reports.howItWent')}</h3>
      {report.rounds.some(hasCalculationTelemetry) ? (
        <>
          <CombatFormula grade={report.grade} />
          <p className="mt-3 text-caption leading-relaxed text-dim">
            {t('reports.calculation.intro')}
          </p>
        </>
      ) : null}
      <div className="plate plate-inset mt-2">
        {report.rounds.map((round) => hasCalculationTelemetry(round) ? (
          <CombatRoundDetail key={round.round} report={report} round={round} />
        ) : (
          <div
            key={round.round}
            data-combat-round={round.round}
            className="border-b border-line-soft px-3 py-3 last:border-b-0"
          >
            <div className="grid grid-cols-[24px_1fr_auto] items-center gap-3">
              <span className="num w-6 text-label text-faint">{round.round}</span>
              <RoundBalance
                dealt={report.attacking ? round.attackerDamage : round.defenderDamage}
                took={report.attacking ? round.defenderDamage : round.attackerDamage}
              />
              <span className="sr-only">
                <Trans
                  i18nKey="reports.roundLine"
                  values={{
                    dealt: compact(report.attacking ? round.attackerDamage : round.defenderDamage),
                    took: compact(report.attacking ? round.defenderDamage : round.attackerDamage),
                  }}
                  components={[
                    <span key="d" className="text-bone" />,
                    <span key="t" className="text-bone" />,
                  ]}
                />
              </span>
              {round.shieldAbsorbed > 0 && (
                <span className="flex flex-col items-end gap-1">
                  <span className="num text-label text-crystal">
                    {t('reports.shield', { amount: compact(round.shieldAbsorbed) })}
                  </span>
                  {round.breacherShieldDamage > 0 && (
                    <span className="num text-micro text-deuterium">
                      {t('reports.breacherShield', {
                        amount: compact(round.breacherShieldDamage),
                      })}
                    </span>
                  )}
                </span>
              )}
            </div>
            {/*
              WHO ACTUALLY DIED, AND IN WHICH ROUND.

              The payload has carried this since combat existed and the surface
              drew two damage bars over it. Damage is an abstraction; a hull
              coming off the board is the event — and WHEN it happened is the
              whole story of a fight that turned in round two.
            */}
            <RoundCasualties
              yours={report.attacking ? round.attackerLosses : round.defenderLosses}
              theirs={report.attacking ? round.defenderLosses : round.attackerLosses}
            />
          </div>
        ))}
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
  if (report.wreckValue >= 1) {
    /*
      THE WRECKAGE IS ALWAYS OVER THE WORLD THAT WAS ATTACKED, which is the
      OPPONENT's world only when the reader is the attacker. Said with
      `opponentPlanet` on both sides, a defender was told their own dead ships
      were drifting over the raider's homeworld — and sent to the wrong end of the
      disc to collect them.
    */
    lines.push({
      key: 'wreck',
      tone: 'text-alloy',
      text: report.attacking
        ? t('reports.effects.wreck', {
            amount: compact(report.wreckValue),
            planet: report.opponentPlanet,
          })
        : t('reports.effects.wreckYours', { amount: compact(report.wreckValue) }),
    });
  }

  if (lines.length === 0) return null;

  return (
    <div className="plate plate-inset mt-6 px-3 py-3">
      <p className="legend">{t('reports.effects.heading')}</p>
      <ul className="mt-2 grid gap-2">
        {lines.map((line) => (
          <li key={line.key} className={`text-caption leading-snug ${line.tone}`}>
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

/** The resolver's fixed recipe, beside the battle's actual numbers. */
function CombatFormula({ grade }: { grade: Grade }) {
  const { t } = useTranslation();
  return (
    <section data-combat-formula className="plate plate-inset mt-2 px-3 py-3">
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
              {t(RESULT_EXPLANATION[result], {
                threshold: full(COMBAT.partialThreshold * 100),
                decisiveLoot: full(COMBAT.lootDecisive * 100),
                partialLoot: full(COMBAT.lootPartial * 100),
              })}
            </li>
          ))}
        </ul>
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
  const status = after <= 0 ? 'broken' : after < before ? 'damaged' : 'held';

  return (
    <section className="plate plate-inset relative mb-4 overflow-hidden p-3">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-crystal/80 to-transparent"
      />
      <div className="flex items-center gap-3">
        <span className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-cell border border-crystal/25 bg-crystal/5">
          <span aria-hidden className="absolute inset-2 rounded-full bg-crystal/10 blur-lg" />
          <img
            src={instrumentArt('AEGIS', 1) ?? ''}
            alt={t('reports.aegis.aria')}
            className={`relative size-16 object-contain ${status === 'broken' ? 'opacity-45 grayscale' : ''}`}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="legend text-crystal">{t('reports.aegis.label')}</p>
            <span className={`chip ${status === 'broken' ? 'chip-threat' : 'chip-opportunity'}`}>
              {t(`reports.aegis.${status}`)}
            </span>
          </div>
          <p className="mt-2 text-caption leading-relaxed text-dim">
            {t('reports.aegis.note')}
          </p>
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
        <div className="h-2 overflow-hidden rounded-cell bg-threat/25">
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

function CombatRoundDetail({ report, round }: { report: OrdinaryReport; round: Round }) {
  const { t } = useTranslation();
  const yourRoll = report.attacking ? round.attackerRoll! : round.defenderRoll!;
  const theirRoll = report.attacking ? round.defenderRoll! : round.attackerRoll!;
  const yourPower = report.attacking ? round.attackerDamage : round.defenderDamage;
  const theirPower = report.attacking ? round.defenderDamage : round.attackerDamage;
  const before = round.shieldBefore!;
  const after = round.shieldAfter!;

  return (
    <section
      data-combat-round={round.round}
      className="border-b border-line-soft px-3 py-4 last:border-b-0"
      aria-label={t('reports.calculation.round', { round: round.round })}
    >
      <div className="flex items-center gap-2">
        <span className="num grid size-7 place-items-center rounded-full border border-line text-label text-bone">
          {round.round}
        </span>
        <p className="legend text-bone">{t('reports.calculation.fire')}</p>
      </div>
      <p className="mt-2 pl-9 text-label leading-relaxed text-faint">
        {t('reports.calculation.fireNote')}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 pl-9">
        <ShotCard label={t('reports.calculation.yourShot')} power={yourPower} roll={yourRoll} />
        <ShotCard label={t('reports.calculation.theirShot')} power={theirPower} roll={theirRoll} />
      </div>

      <div className="mt-4 border-t border-line-soft pt-3">
        <p className="legend text-crystal">
          {t(before > 0 ? 'reports.calculation.aegis' : 'reports.calculation.noAegis')}
        </p>
        {before > 0 ? (
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
              {round.breacherShieldDamage > 0 ? (
                <p className="mt-1 text-label text-deuterium">
                  {t('reports.calculation.breacher', { amount: full(round.breacherShieldDamage) })}
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

      <div className="mt-4 border-t border-line-soft pt-3">
        <p className="legend text-bone">{t('reports.calculation.losses')}</p>
        <RoundCasualties
          yours={report.attacking ? round.attackerLosses : round.defenderLosses}
          theirs={report.attacking ? round.defenderLosses : round.attackerLosses}
        />
      </div>
    </section>
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
        <div
          key={hull}
          className="flex items-center gap-3 border-b border-line-soft px-3 py-2 last:border-b-0"
        >
          <span className="flex w-28 min-w-0 shrink-0 items-center gap-2">
            {HULL_ART[hull] ? (
              <img src={HULL_ART[hull]} alt="" aria-hidden className="size-6 object-contain" />
            ) : (
              <span aria-hidden className="legend w-6 text-center">GRD</span>
            )}
            <span className="truncate text-caption text-bone">{hullLabel(hull)}</span>
          </span>
          <SurvivorBar
            sent={count}
            lost={report.yourLosses[hull] ?? 0}
            rebuilt={report.defenceSalvage[hull] ?? 0}
          />
        </div>
      ))}
      {/*
        THE SAME PICTURE FOR THE WHOLE FORCE, which is the line a player reads
        first and the one the table only ever had as a sentence.
      */}
      <div className="flex items-center gap-3 border-t border-line px-3 py-2">
        <span className="legend w-28 shrink-0">
          {t('reports.verdict.total')}
        </span>
        <SurvivorBar sent={brought} lost={lost} rebuilt={rebuilt} />
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
  if (mine.length === 0 && others.length === 0) {
    return <p className="mt-2 pl-9 text-label text-faint">{t('reports.roundNoLosses')}</p>;
  }

  const line = (label: string, entries: ReturnType<typeof fleetEntries>, tone: string) => (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span className="legend w-10 shrink-0">{label}</span>
      {entries.map(([hull, count]) => (
        <span key={hull} className={`num text-label ${tone}`}>
          −{full(count)} {hullLabel(hull)}
        </span>
      ))}
    </span>
  );

  return (
    <div className="mt-2 grid gap-1 pl-9">
      {others.length > 0 && line(t('reports.roundTheirs'), others, 'text-bone')}
      {mine.length > 0 && line(t('reports.roundYours'), mine, 'text-threat-ink')}
    </div>
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
  const won = report.attacking ? report.grade !== 'REPELLED' : report.grade === 'REPELLED';
  const starting = fleetEntries(report.yourFleet).reduce((sum, [, count]) => sum + count, 0);
  const yours = fleetEntries(report.yourLosses).reduce((sum, [, count]) => sum + count, 0);
  const theirs = fleetEntries(report.theirLosses).reduce((sum, [, count]) => sum + count, 0);
  const rebuilt = fleetEntries(report.defenceSalvage).reduce((sum, [, count]) => sum + count, 0);
  const remaining = Math.max(0, starting - yours) + rebuilt;
  const hasRoster = starting > 0;
  const bars = report.grade === 'DECISIVE' ? 3 : report.grade === 'PARTIAL' ? 2 : 1;

  return (
    <section
      data-battle-verdict={report.grade}
      className={`plate relative mb-4 overflow-hidden p-4 ${
        won ? 'plate-opportunity' : 'plate-threat'
      }`}
      aria-label={gradeWord(report.grade)}
    >
      <span
        aria-hidden
        className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${
          won ? 'via-opportunity/80' : 'via-threat/80'
        } to-transparent`}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`legend ${won ? 'text-opportunity' : 'text-threat-ink'}`}>
            {t('reports.verdict.label')}
          </p>
          <p className="headline mt-1 text-figure text-bone">{gradeWord(report.grade)}</p>
        </div>
        <div
          className={`relative grid size-14 shrink-0 place-items-center rounded-full border ${
            won
              ? 'border-opportunity/55 bg-opportunity/10 text-opportunity'
              : 'border-threat/55 bg-threat/10 text-threat'
          }`}
          aria-hidden
        >
          <span className="absolute inset-2 rounded-full border border-current/20" />
          <span className="flex items-end gap-1">
            {[1, 2, 3].map((bar) => (
              <i
                key={bar}
                className={`w-1.5 skew-x-[-12deg] border border-current ${
                  bar <= bars ? 'bg-current/65' : 'bg-transparent opacity-25'
                }`}
                style={{ height: `${String(8 + bar * 6)}px` }}
              />
            ))}
          </span>
        </div>
      </div>

      <div className="plate plate-inset mt-4 p-3">
        <p className="legend text-crystal">
          {t(hasRoster ? 'reports.verdict.yourForce' : 'reports.verdict.yourLosses')}
        </p>
        <div className={`mt-3 grid ${hasRoster ? 'grid-cols-3' : 'grid-cols-1'} divide-x divide-line-soft`}>
          {hasRoster ? (
            <BattleMetric
              label={t(report.attacking ? 'reports.verdict.sent' : 'reports.verdict.held')}
              value={starting}
            />
          ) : null}
          <BattleMetric label={t('reports.verdict.lost')} value={yours} tone="text-threat-ink" />
          {hasRoster ? (
            <BattleMetric
              label={t(report.attacking ? 'reports.verdict.returned' : 'reports.verdict.standing')}
              value={remaining}
              tone="text-opportunity"
            />
          ) : null}
        </div>
        {hasRoster ? (
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

      <div className="mt-3 flex items-end justify-between gap-3 border-t border-line-soft pt-3">
        <p className="legend text-faint">{t('reports.verdict.destroyed')}</p>
        <p className={`num text-figure leading-none ${theirs > 0 ? 'text-bone' : 'text-dim'}`}>
          {full(theirs)}
        </p>
      </div>
    </section>
  );
}

function RoundBalance({ dealt, took }: { dealt: number; took: number }) {
  const { t } = useTranslation();
  const top = Math.max(1, dealt, took);
  return (
    <span className="grid gap-2">
      <span className="grid grid-cols-[auto_1fr_40px] items-center gap-2">
        <span className="legend min-w-14 text-opportunity">{t('reports.roundDealt')}</span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-cell bg-line-soft">
          <span className="block h-full bg-opportunity" style={{ width: `${String((dealt / top) * 100)}%` }} />
        </span>
        <span className="num w-10 text-right text-label text-bone">{compact(dealt)}</span>
      </span>
      <span className="grid grid-cols-[auto_1fr_40px] items-center gap-2">
        <span className="legend min-w-14 text-threat-ink">{t('reports.roundTook')}</span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-cell bg-line-soft">
          <span className="block h-full bg-threat" style={{ width: `${String((took / top) * 100)}%` }} />
        </span>
        <span className="num w-10 text-right text-label text-bone">{compact(took)}</span>
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
      <p className="legend truncate text-faint">{label}</p>
      <p className={`num mt-1 text-title ${tone}`}>{full(value)}</p>
    </div>
  );
}

function Losses({ fleet, tone, empty }: { fleet: OrdinaryReport['yourLosses']; tone: string; empty: string }) {
  const entries = fleetEntries(fleet);
  if (entries.length === 0) {
    return <p className="mt-2 text-body text-faint">{empty}</p>;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-3">
      {entries.map(([hull, count]) => (
        <div key={hull} className="plate plate-inset flex items-center gap-3 px-3 py-2">
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

function Figure({ label, value, tone = 'text-bone' }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="legend">{label}</p>
      <p className={`readout mt-1 text-title ${tone}`}>{value}</p>
    </div>
  );
}
