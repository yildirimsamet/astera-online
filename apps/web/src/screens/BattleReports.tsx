import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ABUSE, COMBAT, DEATH_STAR, HULLS, fleetCount, fleetEntries, type Fleet, type Grade, type HullId } from '@astera/rules';
import { useReports } from '../api/queries.js';
import type { BattleReport, Report, StrategicBattleReport } from '../api/schemas.js';
import i18n from '../i18n/index.js';
import { hullLabel, monumentName } from '../i18n/names.js';
import { compact, decimal, full, signed } from '../lib/format.js';
import { factorLabel } from '../lib/supportFactor.js';
import { duration, staleness, useNow } from '../lib/time.js';
import { HULL_ART, RESOURCE_ART, instrumentArt } from '../ui/assets.js';
import { HullMark } from '../ui/icons/hulls.js';
import { SurvivorBar } from '../ui/SurvivorBar.js';
import { EmptyState, Section, Unreachable } from '../ui/kit/index.js';
import { ReportScene } from '../v2/hud/ReportScene.js';
import { Sheet as V2Sheet } from '../v2/kit/Sheet.js';
import './battle-report.css';
import { MonumentReportSheet } from './MonumentReportSheet.js';

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
  // A supporter stood in a clanmate's line: the verdict is the line's, never "your defence".
  if (report.supportedAt) return i18n.t(`clanSupport.verdict.${report.grade}`);
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
  candidate.kind === 'MONUMENT' ? candidate.id === id : candidate.missionId === id
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
/** What the galaxy hands a report: the ways out of it, and what the disc knows of the other side. */
export interface ReportDoors {
  onFocusMonument?: (monumentId: string) => void;
  /** Fly to a world named by a report, from the list or its detail. */
  onFocusPlanet?: (planetId: string) => void;
  /** E6: back to the raided world's dossier. */
  onAttackAgain?: (planetId: string) => void;
  /** Whether a world on the disc is a colony, for the scene's loyalty line. */
  colonyOf?: (planetId: string) => boolean;
  /** The mark the other side's world wears (D183), for their name's colour. */
  rivalOf?: (planetId: string) => number | null;
  /** Tell the clan: clan chat, opened with the report's line as a draft (M4). Offered in a clan only. */
  onShare?: (line: string) => void;
}

export function BattleReportDoor({
  missionId,
  onClose,
  onUnavailable,
  ...doors
}: {
  missionId: string;
  onClose: () => void;
  /** No such report, or the request failed: fall back to the list. */
  onUnavailable: () => void;
} & ReportDoors) {
  const { data, isPending, isError } = useReports();
  const report = data ? reportFor(data.reports, missionId) : undefined;
  const missing = !isPending && !report;

  useEffect(() => {
    if (missing || isError) onUnavailable();
  }, [isError, missing, onUnavailable]);

  if (!report) return null;
  if (report.kind === 'MONUMENT') return <MonumentReportSheet report={report} onClose={onClose} onFocusMonument={doors.onFocusMonument} />;
  return report.kind === 'STRATEGIC'
    ? <StrategicReportSheet report={report} onClose={onClose} onFocusPlanet={doors.onFocusPlanet} />
    : (
      <ReportSheet report={report} onClose={onClose} {...doors} />
    );
}

export function BattleReports({
  open: requested,
  ...doors
}: {
  open?: { missionId: string; request: number };
} & ReportDoors = {}) {
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
        <div className="rounded-control border border-v2-line bg-v2-deep/40">
          {reports.map((report) => {
            if (report.kind === 'MONUMENT') return <button type="button" key={report.id} data-report-row=""
              onClick={() => { setOpen(report); }} className="grid w-full gap-1 border-b border-v2-line/60 px-3 py-3 text-left text-caption last:border-b-0">
              <span className="font-semibold text-v2-ink">{monumentName(report.monument.ordinal)} · {t(`monument.reportControl.${report.control}`)}</span>
              <span className="text-micro text-v2-ink-2">{t('monument.reportOwn', { sent: fleetCount(report.yourFleet), left: fleetCount(report.yourSurvivors), lost: fleetCount(report.yourLosses) })}</span>
              <span className="font-v2-mono text-micro text-v2-ink-3">{staleness((now - report.at.getTime()) / 60_000)} · {t('reports.dominion')} {signed(report.dominion)}</span>
            </button>;
            if (report.kind === 'STRATEGIC') {
              return (
                <StrategicReportRow
                  key={report.id}
                  report={report}
                  now={now}
                  onOpen={() => { setOpen(report); }}
                  onFocusPlanet={doors.onFocusPlanet}
                />
              );
            }
            const opponentClan = report.attacking ? report.defenderClan : report.attackerClan;
            // A supporter's row names the clanmate's world their ships stood at.
            const listedPlanetId = report.supportedAt?.planetId ?? (report.pirate
              ? report.yourPlanetId
              : report.attacking ? report.opponentPlanetId : report.yourPlanetId);
            const listedPlanet = report.supportedAt?.planetName ?? (report.pirate
              ? report.yourPlanet
              : report.attacking ? report.opponentPlanet : report.yourPlanet);
            return (
              <div key={report.id} className="border-b border-v2-line/60 last:border-b-0">
                <button
                  type="button"
                  data-report-row=""
                  onClick={() => { setOpen(report); }}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-2 px-3 pb-1 pt-3 text-left hover:bg-v2-self/5 focus-visible:outline-2 focus-visible:outline-v2-self"
                >
                  <GradeMark report={report} />
                  <div className="col-span-2 min-w-0">
                    <p className="break-words text-caption text-v2-ink">
                      {report.supportedAt
                        ? t('clanSupport.rowRaidedBy', { host: report.supportedAt.hostName })
                        : t(report.attacking ? 'reports.youRaided' : 'reports.raidedBy')}
                      {opponentClan ? (
                        <span className="mr-1 text-v2-crystal" title={opponentClan.name}>[{opponentClan.tag}]</span>
                      ) : null}
                      <span className="text-v2-ink-2">{opponentOf(report)}</span>
                    </p>
                  </div>
                  {/* A swing of zero moves nobody's score, so it has no figure. */}
                  {report.dominion !== null && report.dominion !== 0 && (
                    <span
                      className={`font-v2-mono tabular-nums col-start-2 row-start-1 text-right text-caption ${report.dominion >= 0 ? 'text-v2-self' : 'text-v2-hostile'}`}
                    >
                      <span className="mb-1 block text-micro text-v2-ink-2">{t('reports.dominion')}</span>
                      {signed(report.dominion)}
                    </span>
                  )}
                </button>
                <p className="flex flex-wrap items-center gap-x-1 px-3 pb-2 font-v2-mono tabular-nums text-micro text-v2-ink-3">
                {listedPlanet !== '' && (listedPlanetId && doors.onFocusPlanet ? (
                  <button type="button" data-report-planet onClick={() => { doors.onFocusPlanet?.(listedPlanetId); }} className="font-v2-ui font-semibold text-v2-self underline decoration-v2-self/40 underline-offset-2 focus-visible:outline-2 focus-visible:outline-v2-self">
                    {listedPlanet}
                  </button>
                ) : <span>{listedPlanet}</span>)}
                {listedPlanet !== '' && <span aria-hidden>·</span>}
                <span>{staleness((now - report.at.getTime()) / 60_000)}</span>
                {report.rounds.length > 0 && <span>· {t('reports.rounds', { count: report.rounds.length })}</span>}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        open.kind === 'MONUMENT' ? <MonumentReportSheet report={open} onClose={() => { setOpen(null); }} onFocusMonument={doors.onFocusMonument} /> : open.kind === 'STRATEGIC' ? (
          <StrategicReportSheet report={open} onClose={() => { setOpen(null); }} onFocusPlanet={doors.onFocusPlanet} />
        ) : (
          <ReportSheet report={open} onClose={() => { setOpen(null); }} {...doors} />
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
  onFocusPlanet,
}: {
  report: StrategicReport;
  now: number;
  onOpen: () => void;
  onFocusPlanet?: (planetId: string) => void;
}) {
  const { t } = useTranslation();
  const stopped = report.outcome === 'INTERCEPTED';
  return (
    <div className="border-b border-v2-line/60 last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-2 px-3 pb-1 pt-3 text-left hover:bg-v2-self/5 focus-visible:outline-2 focus-visible:outline-v2-self"
      >
        <span className={`inline-flex items-center rounded-chip border px-1.5 py-0.5 text-micro font-semibold shrink-0 ${stopped ? 'border-v2-self/50 text-v2-self' : 'border-v2-hostile/50 text-v2-hostile'}`}>
          {t(STRATEGIC_OUTCOME[report.outcome])}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-caption text-v2-ink">
            {t(report.attacking ? 'reports.strategicYouAttacked' : 'reports.strategicAttackedBy')}
            <span className="text-v2-ink-2">{report.opponentName}</span>
          </p>
        </div>
        {report.damage > 0 ? <span className="font-v2-mono tabular-nums text-caption text-v2-hostile">{compact(report.damage)}</span> : null}
      </button>
      <p className="flex flex-wrap items-center gap-x-1 px-3 pb-2 font-v2-mono tabular-nums text-micro text-v2-ink-3">
        {report.opponentPlanetId && onFocusPlanet ? (
          <button type="button" data-report-planet onClick={() => { if (report.opponentPlanetId) onFocusPlanet(report.opponentPlanetId); }} className="font-v2-ui font-semibold text-v2-self underline decoration-v2-self/40 underline-offset-2 focus-visible:outline-2 focus-visible:outline-v2-self">
            {report.opponentPlanet}
          </button>
        ) : <span>{report.opponentPlanet}</span>}
        <span aria-hidden>·</span>
        <span>{staleness((now - report.at.getTime()) / 60_000)}</span>
        {report.loyalty?.after === 0 && (
          <>
            <span aria-hidden>·</span>
            <span className="font-v2-ui text-v2-hostile">{t('reports.strategicSecededShort')}</span>
          </>
        )}
      </p>
    </div>
  );
}

/**
 * WHAT THE HIT DID TO A COLONY'S LOYALTY. Owner, 2026-10-01.
 *
 * Rounded up, like every loyalty figure a player reads, so "20%" always means a colony
 * one hit takes. Below the figures the one sentence that makes them a decision: it fell,
 * or how close the next hit brings it.
 */
function LoyaltyHit({ loyalty, attacking }: {
  loyalty: { before: number; after: number };
  attacking: boolean;
}) {
  const { t } = useTranslation();
  const seceded = loyalty.after <= 0;
  return (
    <div data-report-loyalty className="mt-2 rounded-control border border-v2-line bg-v2-deep/40 p-3">
      <p className="flex items-baseline justify-between gap-2 text-caption">
        <span className="text-v2-ink-2">{t('reports.strategicLoyalty')}</span>
        <span className="font-v2-mono tabular-nums text-v2-hostile">
          {t('reports.strategicLoyaltyChange', {
            before: Math.ceil(loyalty.before),
            after: Math.ceil(Math.max(0, loyalty.after)),
          })}
        </span>
      </p>
      <p className={`mt-1 text-micro leading-snug ${seceded ? 'font-semibold text-v2-hostile' : 'text-v2-ink-3'}`}>
        {seceded
          ? t(attacking ? 'reports.strategicSecededAttacker' : 'reports.strategicSecededDefender')
          : t('reports.strategicLoyaltyNext', { loss: DEATH_STAR.colonyLoyaltyLoss })}
      </p>
    </div>
  );
}

/** Exported for the v2 gallery's camera, as `StrikeSheet` is. */
export function StrategicReportSheet({
  report,
  onClose,
  onFocusPlanet,
}: {
  report: StrategicReport;
  onClose: () => void;
  onFocusPlanet?: (planetId: string) => void;
}) {
  const { t } = useTranslation();
  const resourcesLost = report.destroyedResources.alloy
    + report.destroyedResources.crystal
    + report.destroyedResources.deuterium;
  const ordersLost = report.destroyedOrders.reduce(
    (sum, order) => sum + order.cost.alloy + order.cost.crystal + order.cost.deuterium,
    0,
  );
  const emp = report.outcome === 'FIRST_STRIKE' && report.damage === 0;

  return (
    <V2Sheet
      detents={['full']}
      eyebrow={t(report.attacking ? 'reports.strategicYouAttacked' : 'reports.strategicAttackedBy', {
        opponent: report.opponentName,
      })}
      title={t(STRATEGIC_OUTCOME[report.outcome])}
      onClose={onClose}
    >
      {report.yourPlanet ? (
        <p className="font-v2-mono tabular-nums mb-3 flex items-center gap-2 text-micro text-v2-ink-3">
          {report.yourPlanetId && onFocusPlanet ? (
            <button type="button" onClick={() => { if (report.yourPlanetId) onFocusPlanet(report.yourPlanetId); }} className="text-v2-self underline decoration-v2-self/50 underline-offset-2">
              {report.yourPlanet}
            </button>
          ) : <span className="text-v2-ink">{report.yourPlanet}</span>}
          <span aria-hidden>{report.attacking ? '→' : '←'}</span>
          {report.opponentPlanetId && onFocusPlanet ? (
            <button type="button" onClick={() => { if (report.opponentPlanetId) onFocusPlanet(report.opponentPlanetId); }} className="text-v2-self underline decoration-v2-self/50 underline-offset-2">
              {report.opponentPlanet}
            </button>
          ) : <span>{report.opponentPlanet}</span>}
        </p>
      ) : null}

      {report.outcome === 'INTERCEPTED' ? (
        <div className="rounded-control border border-v2-line bg-v2-deep/40 p-3">
          <p className="text-caption font-semibold text-v2-self">{t('reports.strategicDestroyedInFlight')}</p>
          <p className="mt-2 text-caption text-v2-ink-2">
            {t(report.trigger === 'TELESCOPE'
              ? 'reports.strategicTelescopeTrigger'
              : 'reports.strategicRadarTrigger')}
          </p>
        </div>
      ) : emp ? (
        <>
          <div className="rounded-control border border-v2-line bg-v2-deep/40 p-3 text-caption text-v2-ink">
            {t('reports.strategicEmpEffect')}
          </div>
          {report.loyalty && <LoyaltyHit loyalty={report.loyalty} attacking={report.attacking} />}
        </>
      ) : (
        <div className="space-y-3">
          <div className="rounded-control border border-v2-line bg-v2-deep/40 grid grid-cols-2 gap-2 p-3">
            <StrategicMetric label={t('reports.strategicTotalDamage')} value={full(report.damage)} />
            <StrategicMetric label={t('reports.strategicShieldLost')} value={full(report.shieldDestroyed)} />
            <StrategicMetric label={t('reports.strategicResourcesLost')} value={full(resourcesLost)} />
            <StrategicMetric label={t('reports.strategicOrdersLost')} value={full(ordersLost)} />
          </div>

          <div className="rounded-control border border-v2-line bg-v2-deep/40 p-3">
            <p className="text-caption font-semibold text-v2-ink">{t('reports.strategicResourceBreakdown')}</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-micro text-v2-ink-2">
              <span>{t('vocabulary.resource.alloy')} <b className="font-v2-mono tabular-nums text-v2-ink">{full(report.destroyedResources.alloy)}</b></span>
              <span>{t('vocabulary.resource.crystal')} <b className="font-v2-mono tabular-nums text-v2-ink">{full(report.destroyedResources.crystal)}</b></span>
              <span>{t('vocabulary.resource.deuterium')} <b className="font-v2-mono tabular-nums text-v2-ink">{full(report.destroyedResources.deuterium)}</b></span>
            </div>
          </div>

          <Losses
            fleet={report.destroyedFleet}
            tone="text-v2-hostile"
            empty={t('reports.strategicNoFleetLost')}
          />

          <div className="rounded-control border border-v2-line bg-v2-deep/40 p-3">
            <p className="text-caption font-semibold text-v2-ink">{t('reports.strategicLevelLosses')}</p>
            {report.levelChanges.length === 0 ? (
              <p className="mt-2 text-caption text-v2-ink-3">{t('reports.strategicNoLevelLoss')}</p>
            ) : (
              <div className="mt-2 space-y-1">
                {report.levelChanges.map((change, index) => (
                  <p key={`${change.kind}-${change.id}-${index}`} className="flex justify-between text-caption text-v2-ink-2">
                    <span>{change.id.replaceAll('_', ' ')}</span>
                    <span className="font-v2-mono tabular-nums text-v2-hostile">L{change.before} → L{change.after}</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-control border border-v2-line bg-v2-deep/40 p-3">
            <p className="text-caption font-semibold text-v2-ink">{t('reports.strategicDestroyedOrders')}</p>
            {report.destroyedOrders.length === 0 ? (
              <p className="mt-2 text-caption text-v2-ink-3">{t('reports.strategicNoOrdersLost')}</p>
            ) : report.destroyedOrders.map((order, index) => (
              <p key={`${order.subject}-${index}`} className="mt-2 flex justify-between text-caption text-v2-ink-2">
                <span>{order.subject.replaceAll('_', ' ')} ×{order.count}</span>
                <span className="font-v2-mono tabular-nums text-v2-hostile">
                  {full(order.cost.alloy + order.cost.crystal + order.cost.deuterium)}
                </span>
              </p>
            ))}
          </div>
        </div>
      )}
    </V2Sheet>
  );
}

function StrategicMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="v2-legend text-v2-ink-3">{label}</p>
      <p className="font-v2-mono tabular-nums mt-1 text-caption font-semibold text-v2-ink">{value}</p>
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
      className={`w-fit max-w-full rounded-cell border px-2 py-1 text-caption font-semibold ${won ? 'border-v2-self/30 text-v2-self' : 'border-threat/30 text-v2-hostile'}`}
      title={verdictTitle(report)}
    >
      {verdictTitle(report)}
    </span>
  );
}

function ReportSheet({
  report,
  onClose,
  onAttackAgain,
  onFocusPlanet,
  colonyOf,
  rivalOf,
  onShare,
}: {
  report: OrdinaryReport;
  onClose: () => void;
} & ReportDoors) {
  const { t } = useTranslation();
  /** "Watch" (the mock's İzle): the round by round, further down this sheet. */
  const rounds = useRef<HTMLHeadingElement>(null);
  const target = report.attacking ? report.opponentPlanetId ?? null : null;
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
    <V2Sheet
      detents={['full']}
      quietTitle
      eyebrow={report.supportedAt
        ? t('clanSupport.reportEyebrow', {
          opponent: opponentOf(report),
          host: report.supportedAt.hostName,
          world: report.supportedAt.planetName,
        })
        : report.attacking || report.pirate
        ? t(report.pirate ? 'reports.sheetYouRaidedPirate' : 'reports.sheetYouRaided', {
          opponent: opponentOf(report),
          planet: report.opponentPlanet,
        })
        : `${t('reports.sheetTheyRaided', { opponent: opponentOf(report) })} · ${t('reports.attackedPlanet', { planet: report.yourPlanet })}`}
      title={verdictTitle(report)}
      onClose={onClose}
    >
      <div data-battle-report className="battle-report">
      {/*
        THE SCENE FIRST (B15, the mock's "KISMİ ZAFER"): the world, the haul, both sides, one
        sentence of why and the balance. The sheet's title already carries the verdict and is
        its accessible name, so the scene stands a dot in the verdict's colour in for the word.
        The four questions below are the scene's detail.
      */}
      <div className="mb-4">
        <ReportScene
          report={report}
          word={verdictTitle(report)}
          colonyTarget={target !== null && (colonyOf?.(target) ?? false)}
          rivalSlot={report.opponentPlanetId ? rivalOf?.(report.opponentPlanetId) ?? null : null}
          onWatch={() => { rounds.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
          {...(onShare ? { onShare } : {})}
          {...(onFocusPlanet ? { onFocusPlanet } : {})}
          {...(target !== null && onAttackAgain ? { onAttackAgain: () => { onAttackAgain(target); } } : {})}
        />
      </div>
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
        className="mt-4 border-t border-v2-line pt-3 text-micro font-semibold text-v2-ink"
      >
        {t('reports.q.happened')}
      </h2>
      <BattleVerdict report={report} />
      {/* The date and time are the hero's (the scene above); the route stays, pointing in or out. */}
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
        <p className="font-v2-mono tabular-nums mb-3 flex items-center gap-2 text-micro text-v2-ink-3">
          {report.yourPlanetId && onFocusPlanet ? (
            <button type="button" onClick={() => { if (report.yourPlanetId) onFocusPlanet(report.yourPlanetId); }} className="text-v2-self underline decoration-v2-self/50 underline-offset-2">
              {report.yourPlanet}
            </button>
          ) : <span className="text-v2-ink">{report.yourPlanet}</span>}
          {report.opponentPlanet !== '' && (
            <>
              <span aria-hidden>{report.attacking ? '→' : '←'}</span>
              {report.opponentPlanetId && onFocusPlanet ? (
                <button type="button" onClick={() => { if (report.opponentPlanetId) onFocusPlanet(report.opponentPlanetId); }} className="text-v2-self underline decoration-v2-self/50 underline-offset-2">
                  {report.opponentPlanet}
                </button>
              ) : <span>{report.opponentPlanet}</span>}
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
        <p className="mt-2 border-l border-v2-line-hi pl-3 text-micro leading-snug text-v2-crystal">
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
      <section data-battle-reason className="rounded-control border border-v2-line bg-v2-deep/40 mt-3 p-3">
      <h3 className="text-caption font-semibold font-semibold text-v2-ink">{t('reports.reasonHeading')}</h3>
      <p className="mt-2 text-caption leading-relaxed text-v2-ink-2">
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
        className="mt-4 border-t border-v2-line pt-3 text-micro font-semibold text-v2-ink"
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
        ref={rounds}
        data-report-section="who"
        className="mt-4 border-t border-v2-line pt-3 text-micro font-semibold text-v2-ink scroll-mt-12"
      >
        {t('reports.q.who')}
      </h2>
      {report.jointWar && <JointWarForces report={report} />}
      {report.defenseLine && <DefenseLineForces report={report} />}
      {/* Defending, the Aegis is part of the reader's own board — see above. */}
      {!report.attacking && <ShieldImpact report={report} />}

      {/*
        AND THE PART THAT GIVES YOUR OWN LOSSES A DENOMINATOR.

        "You lost 12 Wasp" is a disaster out of fifteen and a rounding error out
        of eighty, and until D121 the report could not tell those two apart. The
        roster is the caller's own board, so it discloses nothing: this is the one
        force in the fight the reader already commanded.
      */}
      <h3 className="mt-4 text-caption font-semibold text-v2-ink">
        {t(fleetEntries(report.yourFleet).length > 0 ? 'reports.yourForce' : 'reports.yours')}
      </h3>
      {fleetEntries(report.yourFleet).length > 0 ? (
        <YourForce report={report} />
      ) : (
        <Losses fleet={report.yourLosses} tone="text-v2-hostile" empty={t('reports.yoursEmpty')} />
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
        <section data-walkover className="rounded-control border border-v2-line bg-v2-deep/40 mt-3 px-3 py-2">
          <p className="text-caption font-semibold text-v2-ink">{t('reports.walkoverHeading')}</p>
          <p className="mt-2 text-caption leading-relaxed text-v2-ink-2">
            {t(report.attacking ? 'reports.walkoverBody' : 'reports.walkoverDefendingBody')}
          </p>
        </section>
      ) : (
      <>
      <h3 className="mt-4 text-caption font-semibold text-v2-ink">{t('reports.howItWent')}</h3>
      <p className="mt-2 text-caption leading-relaxed text-v2-ink-2">{t('reports.calculation.fireNote')}</p>
      {!report.pirate ? <p className="mt-1 text-caption leading-relaxed text-v2-ink-2">{t('reports.roundDamageNote')}</p> : null}
      <div className="rounded-control border border-v2-line bg-v2-deep/40 mt-2">
        {report.rounds.map((round) => (
          <BattleRound key={round.round} report={report} round={round} />
        ))}
      </div>
      {report.pirate && <HoldsTaken report={report} />}
      <details className="mt-3">
        <summary className="cursor-pointer py-3 text-caption font-semibold text-v2-crystal focus-visible:outline focus-visible:outline-2 focus-visible:outline-v2-self">
          {t('reports.rulesToggle')}
        </summary>
        <CombatFormula grade={report.grade} pirate={report.pirate != null} />
      </details>
      </>
      )}

      <h2
        data-report-section="changed"
        className="mt-4 border-t border-v2-line pt-3 text-micro font-semibold text-v2-ink"
      >
        {t('reports.q.changed')}
      </h2>
      {/* The opening verdict already states losses, loot and Dominion. This section
          expands only the figures that have more to explain. */}
      {report.dominion !== null ? (
        <p className="mt-3 text-caption leading-relaxed text-v2-ink-2">{t('reports.dominionReason')}</p>
      ) : null}
      {report.dominion !== null && report.dominion !== 0 ? (
        <p
          data-dominion-summary
          className={`mt-3 border-l-2 pl-3 text-caption leading-relaxed ${
            report.dominion >= 0
              ? 'border-v2-self text-v2-self'
              : 'border-threat text-v2-hostile'
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
          className="rounded-control border border-v2-line bg-v2-deep/40 mt-3 p-3"
          data-dominion-ruleset={report.dominionBreakdown.ruleVersion}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-caption font-semibold text-v2-ink">{t('reports.dominionBreakdown.title')}</h3>
            <span className="font-v2-mono tabular-nums text-micro text-v2-ink-3">
              v{report.dominionBreakdown.ruleVersion}
            </span>
          </div>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-micro">
            <dt className="text-v2-ink-2">
              {t(report.dominionBreakdown.lootValue >= 0
                ? 'reports.dominionBreakdown.lootGained'
                : 'reports.dominionBreakdown.lootLost')}
            </dt>
            <dd className={report.dominionBreakdown.lootValue >= 0
              ? 'font-v2-mono tabular-nums text-v2-alloy'
              : 'font-v2-mono tabular-nums text-v2-hostile'}>
              {signed(report.dominionBreakdown.lootValue)}
            </dd>
            <dt className="text-v2-ink-2">{t('reports.dominionBreakdown.enemyLosses')}</dt>
            <dd className="font-v2-mono tabular-nums text-v2-self">
              {signed(report.dominionBreakdown.enemyPermanentLossValue)}
            </dd>
            <dt className="text-v2-ink-2">{t('reports.dominionBreakdown.ownLosses')}</dt>
            <dd className="font-v2-mono tabular-nums text-v2-hostile">
              {signed(-report.dominionBreakdown.ownPermanentLossValue)}
            </dd>
            <dt className="mt-1 border-t border-v2-line/60 pt-2 text-v2-ink">
              {t('reports.dominionBreakdown.total')}
            </dt>
            <dd className={`font-v2-mono tabular-nums mt-1 border-t border-v2-line/60 pt-2 ${
              report.dominionBreakdown.rawExchange >= 0
                ? 'text-v2-self'
                : 'text-v2-hostile'
            }`}>
              {signed(report.dominionBreakdown.rawExchange)}
            </dd>
          </dl>
        </section>
      )}
      {looted !== 0 && (
        <p className="v2-legend mt-2">{t(looted >= 0 ? 'reports.haul' : 'reports.haulLost')}</p>
      )}
      {looted !== 0 && (
        <p className="font-v2-mono tabular-nums mt-1 flex items-center gap-2 text-micro">
          <span className="flex items-center gap-1 text-v2-alloy">
            <img
              src={RESOURCE_ART.alloy}
              alt={t('vocabulary.resource.alloy')}
              className="size-4 object-contain"
            />
            {signed(report.lootAlloy)}
          </span>
          <span className="flex items-center gap-1 text-v2-crystal">
            <img
              src={RESOURCE_ART.crystal}
              alt={t('vocabulary.resource.crystal')}
              className="size-4 object-contain"
            />
            {signed(report.lootCrystal)}
          </span>
          {report.lootDeuterium !== 0 && (
            <span className="flex items-center gap-1 text-v2-self">
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
          <p className="v2-legend mt-2">{t('reports.salvageHaul')}</p>
          <p data-testid="report-salvage" className="font-v2-mono tabular-nums mt-1 flex items-center gap-2 text-micro">
            <span className="flex items-center gap-1 text-v2-alloy">
              <img
                src={RESOURCE_ART.alloy}
                alt={t('vocabulary.resource.alloy')}
                className="size-4 object-contain"
              />
              {signed(salvage.alloy)}
            </span>
            <span className="flex items-center gap-1 text-v2-crystal">
              <img
                src={RESOURCE_ART.crystal}
                alt={t('vocabulary.resource.crystal')}
                className="size-4 object-contain"
              />
              {signed(salvage.crystal)}
            </span>
            {salvage.deuterium !== 0 && (
              <span className="flex items-center gap-1 text-v2-self">
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
        <div className="rounded-control border border-v2-line bg-v2-deep/40 mb-2 px-3 py-2">
          <p className="text-caption font-semibold text-v2-ink">{t('reports.clansAtLaunch')}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <ClanAtLaunch label={t('reports.yourClan')} clan={yourClan} />
            <ClanAtLaunch label={t('reports.theirClan')} clan={theirClan} />
          </div>
        </div>
      ) : null}
      </div>
    </V2Sheet>
  );
}

function JointWarForces({ report }: { report: OrdinaryReport }) {
  const { t } = useTranslation();
  const joint = report.jointWar;
  if (!joint) return null;
  return <section data-joint-war className="rounded-control border border-v2-line bg-v2-deep/40 mt-3 p-3">
    <h3 className="text-caption font-semibold font-semibold text-v2-ink">
      {t('clanWar.report.title', { tag: joint.clan.tag })}
    </h3>
    <p className="mt-1 text-micro text-v2-ink-2">
      {t('clanWar.report.summary', {
        count: joint.attackerCount,
        sent: unitCount(joint.sent),
        lost: unitCount(joint.losses),
        returned: unitCount(joint.survivors),
      })}
    </p>
    <p className="mt-1 text-micro text-v2-ink-3">
      {t('clanWar.report.ratio', {
        attackers: joint.attackerCount,
        // Only the host's Dominion moves against a supported line (owner, 2026-10-02): the
        // support is priced by power in the defending line's section, never as heads here.
        defenders: report.defenseLine ? 1 : joint.defenderCount,
      })}
    </p>
    {joint.baseExchange !== null && joint.adjustedTransfer !== null && (
      <p className="mt-1 text-micro text-v2-crystal">
        {t('clanWar.report.audit', {
          base: signed(joint.baseExchange),
          adjusted: signed(joint.adjustedTransfer),
        })}
      </p>
    )}
    {joint.participants.map((participant) => <div key={participant.playerId}
      className="mt-3 border-t border-v2-line pt-3">
      <p className="font-semibold text-v2-ink">{participant.name}</p>
      <p className="mt-1 text-micro text-v2-ink-2">
        {t('clanWar.report.participant', {
          sent: unitCount(participant.sent),
          lost: unitCount(participant.losses),
          returned: unitCount(participant.survivors),
          loot: full(participant.loot.alloy + participant.loot.crystal + participant.loot.deuterium),
          salvage: full(participant.salvage.alloy + participant.salvage.crystal
            + participant.salvage.deuterium),
          dominion: signed(participant.dominion),
        })}
      </p>
      <ul className="mt-2 space-y-1">
        {participant.waves.map((wave) => <li key={wave.id} className="text-micro text-v2-ink-3">
          {t('clanWar.report.wave', {
            world: wave.originPlanetName,
            sent: unitCount(wave.sent),
            lost: unitCount(wave.losses),
            returned: unitCount(wave.survivors),
          })}
          <span className="block text-v2-ink-2">{t('clanWar.report.waveRewards', {
            loot: full(wave.loot.alloy + wave.loot.crystal + wave.loot.deuterium),
            salvage: full(wave.salvage.alloy + wave.salvage.crystal + wave.salvage.deuterium),
          })}</span>
          <span className="block text-v2-ink-2">
            {wave.destinationPlanetName
              ? t('clanWar.report.waveState', {
                  status: t(`clanWar.status.${wave.status}`),
                  destination: wave.destinationPlanetName,
                })
              : t(`clanWar.status.${wave.status}`)}
          </span>
          {wave.returnAt && <span className="block text-v2-ink-2">
            {t('clanWar.report.returnAt', {
              time: new Intl.DateTimeFormat(t('units.numberLocale'), {
                dateStyle: 'short', timeStyle: 'short',
              }).format(wave.returnAt),
            })}
          </span>}
        </li>)}
      </ul>
    </div>)}
  </section>;
}

/**
 * KLAN SAVUNMA DESTEĞİ — THE DEFENDING LINE, ONE ROW PER COMMANDER IN IT.
 *
 * The host first, then each clanmate whose ships stood there: what each lost, what each
 * kept, and the Dominion each carried, with the split rule under the rows so the host's
 * larger share reads as the rule rather than as a mistake. The raider is sent names and
 * losses only — `survivors` arrives null — and the row says no more than it was sent.
 */
function DefenseLineForces({ report }: { report: OrdinaryReport }) {
  const { t } = useTranslation();
  const line = report.defenseLine;
  if (!line) return null;
  /*
    THE FACTOR, WITH NO DIRECTION ON IT. It multiplies the host's OWN fight; the total the host
    moved also carries the supporters' losses at face value, so its sign can belong to them —
    a host who won its own fight can still end down. The rule underneath says which way each
    part goes. A support with nothing that fires changed nothing.
  */
  const factor = line.dominionFactor;
  const factorLine = factor === undefined
    ? null
    : factor === 1
      ? t('clanSupport.lineFactorFlat')
      : t('clanSupport.lineFactor', { factor: factorLabel(factor) });
  return (
    <section data-defense-line aria-label={t('clanSupport.lineTitle')}
      className="mt-3 rounded-control border border-v2-line bg-v2-deep/40 p-3">
      <h3 className="flex items-baseline justify-between gap-2 text-caption font-semibold text-v2-ink">
        {t('clanSupport.lineTitle')}
        <span className="font-v2-mono text-micro font-normal text-v2-ink-3">
          {t('clanSupport.lineCount', { count: line.defenderCount })}
        </span>
      </h3>
      <ul className="mt-1 divide-y divide-v2-line/70">
        {line.members.map((member) => (
          <li key={member.playerId} className="flex items-center gap-2 py-1.5">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-caption font-semibold text-v2-ink">{member.name}</span>
                <span className={`shrink-0 rounded-cell border px-1 text-micro ${member.role === 'HOST'
                  ? 'border-v2-ink-3 text-v2-ink' : 'border-v2-line text-v2-ink-2'}`}>
                  {t(member.role === 'HOST' ? 'clanSupport.lineHost' : 'clanSupport.lineSupport')}
                </span>
              </span>
              <span className="block font-v2-mono text-micro text-v2-ink-2">
                {t('clanSupport.lineLost', { count: unitCount(member.losses) })}
                {member.survivors !== null && ` · ${t('clanSupport.lineKept', { count: unitCount(member.survivors) })}`}
              </span>
            </span>
            {/* Only the host's Dominion moves (owner, 2026-10-02): a supporter's row carries none. */}
            {member.role === 'HOST' && (
              <span className="shrink-0 font-v2-mono text-micro text-v2-ink">
                {t('clanSupport.lineDominion', { value: signed(member.dominion) })}
              </span>
            )}
          </li>
        ))}
      </ul>
      {factorLine && <p className="mt-1 text-micro font-semibold leading-snug text-v2-ink">{factorLine}</p>}
      <p className="mt-1 text-micro leading-snug text-v2-ink-3">{t('clanSupport.lineRule')}</p>
    </section>
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

  /*
    TAKTİK GERİ ÇEKİLME, FIRST, because it is why the rest of the page reads as it does:
    a defender whose losses say nothing and whose fleet is still at home, or a raider
    whose DECISIVE sank no ships. Owner decision, 2026-09-23.

    Each side is told what it saw. The defender reads what ran and what the lift burned,
    or what the lift needed against what the tank held. The raider reads only that the
    line emptied — and never a stranded record, which is a fact about somebody else's
    tank; the server already sends the raider none, and this guard keeps it that way.
  */
  const escape = report.fleetEscape ?? null;
  if (escape?.kind === 'ESCAPED' && report.attacking) {
    lines.push({ key: 'escape', tone: 'text-v2-alloy', text: t('reports.effects.fled') });
  } else if (escape?.kind === 'ESCAPED' && escape.ships !== undefined && escape.fuel !== undefined) {
    lines.push({
      key: 'escape',
      tone: 'text-v2-self',
      text: t('reports.effects.escaped', { count: fleetCount(escape.ships), fuel: escape.fuel }),
    });
  } else if (escape?.kind === 'STRANDED' && !report.attacking) {
    lines.push({
      key: 'escape',
      tone: 'text-v2-hostile',
      text: t('reports.effects.stranded', { fuel: escape.fuel, available: escape.available }),
    });
  }

  // A current report gets the drawn before→after Aegis card above. Keep this
  // sentence only for a legacy report whose old payload knows the absorbed total
  // but cannot honestly reconstruct either endpoint.
  if (report.shieldAbsorbed >= 1 && shieldState(report).before === null) {
    lines.push({
      key: 'shield',
      tone: 'text-v2-crystal',
      text: t(report.attacking ? 'reports.effects.shieldTheirs' : 'reports.effects.shieldYours', {
        amount: compact(report.shieldAbsorbed),
      }),
    });
  }
  if (report.cargoLimited) {
    lines.push({
      key: 'cargo',
      tone: 'text-v2-alloy',
      text: t('reports.effects.cargoLimited'),
    });
  }
  if (salvaged > 0) {
    lines.push({
      key: 'salvage',
      tone: 'text-v2-self',
      text: t('reports.effects.salvaged', { count: salvaged }),
    });
  }
  if (report.disruptedMinutes >= 1) {
    lines.push({
      key: 'works',
      tone: report.attacking ? 'text-v2-self' : 'text-v2-hostile',
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
      tone: 'text-v2-alloy',
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
      tone: 'text-v2-alloy',
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
      tone: 'text-v2-hostile',
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
      tone: recovery.shielded ? 'text-v2-self' : 'text-v2-ink-2',
      text: recovery.shielded
        ? t('reports.effects.recoveryEarned', values)
        : recovery.lossHours >= ABUSE.recoveryLossHours
          ? t('reports.effects.recoveryRefused', values)
          : t('reports.effects.recoveryProgress', values),
    });
  }

  if (lines.length === 0) return null;

  return (
    <div className="rounded-control border border-v2-line bg-v2-deep/40 mt-3 px-3 py-2">
      <p className="v2-legend">{t('reports.effects.heading')}</p>
      <ul className="mt-2 grid gap-2">
        {lines.map((line) => (
          <li
            key={line.key}
            className={`text-micro leading-snug ${line.tone}`}
            {...(line.key === 'faults' ? { 'data-colony-faults': '' } : {})}
            {...(line.key === 'escape' ? { 'data-fleet-escape': '' } : {})}
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
    <section data-combat-formula className="rounded-control border border-v2-line bg-v2-deep/40 mt-2 px-3 py-2">
      <p className="text-caption font-semibold text-v2-ink">{t('reports.calculation.formulaHeading')}</p>
      <ol className="mt-2 grid gap-2 text-micro leading-relaxed text-v2-ink-2">
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
      <div className="mt-3 grid gap-1 border-t border-v2-line/60 pt-3 text-micro leading-relaxed text-v2-ink-3">
        <p>{t('reports.calculation.formulaHp')}</p>
        <p>{t('reports.calculation.formulaCarry')}</p>
        <p>{t('reports.calculation.formulaSupport')}</p>
      </div>
      <div className="mt-3 border-t border-v2-line/60 pt-3">
        <p className="text-caption font-semibold text-v2-ink">{t('reports.calculation.resultHeading')}</p>
        <ul className="mt-2 grid gap-2 text-micro leading-relaxed text-v2-ink-2">
          {(['DECISIVE', 'PARTIAL', 'REPELLED'] as const).map((result) => (
            <li
              key={result}
              className={result === grade ? 'text-v2-ink' : undefined}
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
/**
 * UNESCORTED HOLDS DO NOT ESCAPE (owner report, 2026-10-06; `pirateOverrun`).
 *
 * The holds a pirate is left with once its last warship is down are taken AFTER the last round,
 * so no round lists them — they are exactly what the report's losses hold beyond the rounds'
 * sum. Named here, or a commander reads three rounds that killed warships and a ledger that
 * also lost an Atlas, with nothing between.
 */
function HoldsTaken({ report }: { report: OrdinaryReport }) {
  const { t } = useTranslation();
  const inRounds: Fleet = {};
  for (const round of report.rounds) {
    for (const [hull, n] of fleetEntries(round.defenderLosses)) inRounds[hull] = (inRounds[hull] ?? 0) + n;
  }
  const taken = fleetEntries(report.theirLosses)
    .map(([hull, n]) => [hull, n - (inRounds[hull] ?? 0)] as const)
    .filter(([, n]) => n > 0);
  if (taken.length === 0) return null;
  return (
    <p data-testid="pirate-overrun" className="mt-2 border-l-2 border-v2-self pl-3 text-caption leading-relaxed text-v2-ink-2">
      {t('reports.pirateOverrun', {
        fleet: taken.map(([hull, n]) => `${String(n)} ${hullLabel(hull)}`).join(t('counter.lineJoin')),
      })}
    </p>
  );
}

function CapturedHull({ hull }: { hull: HullId }) {
  const { t } = useTranslation();
  const art = HULL_ART[hull];

  return (
    <section
      data-captured-hull={hull}
      className="rounded-control border border-v2-line bg-v2-deep/40 relative mt-2 overflow-hidden p-3"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-v2-self/80 to-transparent"
      />
      <div className="flex items-center gap-2">
        <span className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-cell border border-v2-self/25 bg-v2-self/5">
          <span aria-hidden className="absolute inset-2 rounded-full bg-v2-self/10 blur-lg" />
          {art ? (
            <img src={art} alt="" aria-hidden className="relative size-16 object-contain" />
          ) : (
            <HullMark hull={hull} className="relative size-10 text-v2-self" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold text-v2-self">{t('reports.pirateCaptured')}</p>
          <p className="name mt-1 text-caption font-semibold text-v2-ink">{hullLabel(hull)}</p>
          <p className="mt-2 text-micro leading-relaxed text-v2-ink-2">
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
    <section className="rounded-control border border-v2-line bg-v2-deep/40 relative mb-2 overflow-hidden p-3 mt-3">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-v2-crystal/80 to-transparent"
      />
      <div className="flex items-center gap-2">
        <span className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-cell border border-v2-line bg-v2-raise/40">
          <span aria-hidden className="absolute inset-2 rounded-full bg-v2-raise/60 blur-lg" />
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
            <p className="text-micro font-semibold text-v2-crystal">
              {t(report.attacking ? 'reports.aegis.labelTheirs' : 'reports.aegis.labelYours')}
            </p>
            <span
              data-aegis-status={status}
              data-tone={status === 'broken' ? 'threat' : status === 'held' ? 'good' : 'neutral'}
              className={`inline-flex items-center rounded-chip border px-1.5 py-0.5 text-micro font-semibold ${
                status === 'broken' ? 'border-v2-hostile/50 text-v2-hostile'
                  : status === 'held' ? 'border-v2-self/50 text-v2-self' : 'border-v2-alloy/50 text-v2-alloy'
              }`}
            >
              {t(`reports.aegis.${status}`)}
            </span>
          </div>
          <p className="mt-2 text-caption leading-relaxed text-v2-ink-2">
            {t('reports.aegis.note')}
          </p>
          {after <= 0 ? (
            <p
              data-aegis-outcome
              className={`mt-2 text-caption font-semibold leading-relaxed ${
                defendersRemain ? 'text-v2-alloy' : 'text-v2-ink'
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
      <div className="relative mt-3 grid grid-cols-2 gap-6 border-t border-v2-line/60 pt-3">
        <div>
          <p className="v2-legend text-v2-ink-3">{t('reports.aegis.before')}</p>
          <p className="font-v2-mono tabular-nums mt-1 text-caption font-semibold text-v2-ink">{full(before)}</p>
        </div>
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 -translate-x-1/2 text-micro text-v2-ink-3"
        >
          →
        </span>
        <div className="text-right">
          <p className="v2-legend text-v2-ink-3">{t('reports.aegis.after')}</p>
          <p className={`font-v2-mono tabular-nums mt-1 text-caption font-semibold ${after <= 0 ? 'text-v2-hostile' : 'text-v2-crystal'}`}>
            {full(after)}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <div className="h-2 overflow-hidden rounded-cell bg-v2-line">
          <span
            data-shield-remaining={remaining}
            className="block h-full bg-gradient-to-r from-v2-crystal/65 to-v2-crystal"
            style={{ width: `${String(remaining)}%` }}
          />
        </div>
        <p className="font-v2-mono tabular-nums mt-2 text-right text-micro text-v2-crystal">
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
      className="border-b border-v2-line/60 p-3 last:border-b-0"
      aria-label={t('reports.calculation.round', { round: round.round })}
    >
      <h4 className="mb-3 text-caption font-semibold font-semibold text-v2-ink">
        {t('reports.calculation.round', { round: round.round })}
      </h4>
      <RoundBalance
        dealt={report.attacking ? round.attackerDamage : round.defenderDamage}
        took={report.attacking ? round.defenderDamage : round.attackerDamage}
      />
      {round.shieldAbsorbed > 0 ? (
        <p className="mt-2 text-caption text-v2-crystal">
          {t('reports.roundShield', { amount: full(round.shieldAbsorbed) })}
        </p>
      ) : null}
      <RoundCasualties
        yours={report.attacking ? round.attackerLosses : round.defenderLosses}
        theirs={report.attacking ? round.defenderLosses : round.attackerLosses}
      />
      <RoundStanding report={report} round={round} />
      {hasCalculationTelemetry(round) ? (
        <details className="mt-2 border-t border-v2-line/60">
          <summary className="cursor-pointer py-3 text-caption text-v2-crystal focus-visible:outline focus-visible:outline-2 focus-visible:outline-v2-self">
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
      <div className="mt-2 border-t border-v2-line/60 pt-3">
        <p className="text-caption font-semibold text-v2-ink">
          {t(
            report.pirate
              ? 'reports.calculation.openSpace'
              : before > 0
                ? 'reports.calculation.aegis'
                : 'reports.calculation.noAegis',
          )}
        </p>
        {report.pirate ? (
          <p className="mt-2 text-micro leading-relaxed text-v2-ink-2">
            {t('reports.calculation.openSpaceNote', { amount: full(round.attackerHullDamage!) })}
          </p>
        ) : before > 0 ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-control border border-v2-line bg-v2-panel px-3 py-2">
              <p className="v2-legend text-v2-ink-3">{t('reports.calculation.shieldCharge')}</p>
              <p className="font-v2-mono tabular-nums mt-1 text-caption font-semibold text-v2-crystal">
                {full(before)} <span className="text-v2-ink-3">→</span> {full(after)}
              </p>
              <p className="mt-1 text-micro text-v2-ink-2">
                {t('reports.calculation.absorbed', { amount: full(round.shieldAbsorbed) })}
              </p>
            </div>
            <div className="rounded-control border border-v2-line bg-v2-panel px-3 py-2">
              <p className="v2-legend text-v2-ink-3">{t('reports.calculation.reachedHulls')}</p>
              <p className="font-v2-mono tabular-nums mt-1 text-caption font-semibold text-v2-ink">{full(round.attackerHullDamage!)}</p>
              {round.shieldBreakerDamage > 0 ? (
                <p className="mt-1 text-micro text-v2-deut">
                  {t('reports.calculation.shieldBreaker', { amount: full(round.shieldBreakerDamage) })}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-micro leading-relaxed text-v2-ink-2">
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
    <div className="rounded-control border border-v2-line bg-v2-panel px-3 py-2">
      <p className="v2-legend text-v2-ink-3">{label}</p>
      <p className="font-v2-mono tabular-nums mt-1 text-caption font-semibold text-v2-ink">{full(power)}</p>
      <p className={`font-v2-mono tabular-nums mt-1 text-micro ${change >= 0 ? 'text-v2-self' : 'text-v2-hostile'}`}>
        <span className="text-v2-ink-3">{t('reports.calculation.shotChange')} </span>
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
    <div data-force-row={hull} className="grid gap-2 border-b border-v2-line/60 p-3 last:border-b-0 sm:grid-cols-[8rem_1fr] sm:items-center sm:gap-4">
      <span className="flex min-w-0 items-center gap-2">
        {HULL_ART[hull] ? (
          <img src={HULL_ART[hull]} alt="" aria-hidden width={32} height={32} className="size-8 object-contain" />
        ) : (
          <span aria-hidden className="v2-legend w-6 text-center">GRD</span>
        )}
        <span className="min-w-0">
          <span className="block text-caption font-semibold text-v2-ink">{hullLabel(hull)}</span>
          <span className="mt-1 block text-micro text-v2-ink-2">{t(
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
    <div className="rounded-control border border-v2-line bg-v2-deep/40 mt-2">
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
      <div className="grid gap-2 border-t border-v2-line p-3 sm:grid-cols-[8rem_1fr] sm:items-center sm:gap-4">
        <span className="text-caption font-semibold text-v2-ink">
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
      <p className="text-caption font-semibold text-v2-ink">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
      {entries.map(([hull, count]) => (
        <span key={hull} className={`rounded-cell border border-v2-line/60 px-2 py-1 text-caption ${tone}`}>
          {full(count)} {hullLabel(hull)}
        </span>
      ))}
      {entries.length === 0 ? <span className="text-caption text-v2-ink-2">{t('reports.roundNoCasualties')}</span> : null}
      </div>
    </div>
  );

  return (
    <div data-round-losses className="mt-3 grid gap-3 border-t border-v2-line/60 pt-3 sm:grid-cols-2">
      {line(t('reports.roundLossesYours'), mine, 'text-v2-hostile')}
      {line(t('reports.roundLossesTheirs'), others, 'text-v2-ink')}
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
        noForce || supportExposed ? 'border-threat' : 'border-v2-line'
      }`}
    >
      <p className="text-micro font-semibold text-v2-ink">
        {t('reports.roundStanding.heading', { round: round.round })}
      </p>
      <p className="mt-1 text-caption leading-relaxed text-v2-ink-2">
        {standing ? t('reports.roundStanding.summary', {
          combat: full(standing.combat), support: full(standing.support),
        }) : t('reports.roundStanding.unknownOwn')}
      </p>
      {supportExposed ? (
        <p className="mt-1 text-caption font-semibold leading-relaxed text-v2-hostile">
          {t('reports.roundStanding.supportExposed')}
        </p>
      ) : noForce ? (
        <p className="mt-1 text-caption font-semibold leading-relaxed text-v2-hostile">
          {t('reports.roundStanding.noneLeft')}
        </p>
      ) : null}
      {enemy ? (
        <div data-enemy-round-standing className="mt-2 border-t border-v2-line/60 pt-2">
          <p className="text-micro font-semibold text-v2-ink">
            {t('reports.roundStanding.enemyHeading', { round: round.round })}
          </p>
          <p className="mt-1 text-caption text-v2-ink-2">
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
    <p data-combat-turning-point className="mt-2 text-caption font-semibold leading-relaxed text-v2-ink">
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
      <p className="v2-legend">{label}</p>
      {clan ? (
        <p className="mt-1 truncate text-micro text-v2-ink" title={clan.name}>
          <span className="text-v2-crystal">[{clan.tag}]</span> {clan.name}
        </p>
      ) : (
        <p className="mt-1 text-micro text-v2-ink-3">{t('reports.noClan')}</p>
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
      /* The tone is stated, not implied by a class: a loss is red (K2) whatever else was won. */
      data-tone={won ? 'good' : 'threat'}
      className={`relative mb-3 mt-2 overflow-hidden rounded-control border p-3 ${
        won ? 'border-v2-self/40 bg-v2-self/5' : 'border-v2-hostile/40 bg-v2-hostile/5'
      }`}
      aria-label={title}
    >
      <span
        aria-hidden
        className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${
          won ? 'via-v2-self/80' : 'via-v2-hostile/80'
        } to-transparent`}
      />

      <div>
        <h3 className="text-caption font-semibold font-semibold text-v2-ink">
          {t(rosterKnown ? 'reports.verdict.yourForce' : 'reports.verdict.yourLosses')}
        </h3>
        <div className={`mt-3 grid ${rosterKnown ? 'grid-cols-3' : 'grid-cols-1'} divide-x divide-v2-line`}>
          {rosterKnown ? (
            <BattleMetric
              label={t(report.attacking ? 'reports.verdict.sent' : 'reports.verdict.held')}
              value={starting}
            />
          ) : null}
          <BattleMetric label={t('reports.verdict.lost')} value={yours} tone="text-v2-hostile" />
          {rosterKnown ? (
            <BattleMetric
              label={t(report.attacking ? 'reports.verdict.returned' : 'reports.verdict.standing')}
              value={remaining}
              tone={remaining > 0 ? 'text-v2-self' : 'text-v2-hostile'}
            />
          ) : null}
        </div>
        {rosterKnown ? (
          <div className="mt-3 border-t border-v2-line/60 pt-3">
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
        <p data-own-roster-unknown className="mt-2 text-caption leading-relaxed text-v2-alloy">
          {t('reports.verdict.rosterUnknown')}
        </p>
      ) : null}

      <div
        data-verdict-summary
        className={`mt-3 border-l-2 pl-3 ${won ? 'border-v2-self' : 'border-threat'}`}
      >
        <p className="text-caption font-semibold leading-relaxed text-v2-ink">
          {t(report.rounds.length === 0
            ? 'reports.verdict.walkoverSummary'
            : report.pirate && report.grade === 'PARTIAL'
              ? 'reports.verdict.piratePartialSummary'
              : `reports.verdict.summary.${report.attacking ? 'attacking' : 'defending'}.${report.grade}`)}
        </p>
        {report.attacking && rosterKnown ? (
          <p className={`mt-1 text-caption leading-relaxed ${remaining === 0 ? 'text-v2-hostile' : 'text-v2-ink-2'}`}>
            {t(
              remaining === 0
                ? 'reports.verdict.noneReturned'
                : 'reports.verdict.someReturned',
              { count: remaining },
            )}
          </p>
        ) : null}
        {!report.attacking && rebuilt > 0 ? (
          <p className="mt-2 text-caption leading-relaxed text-v2-self">
            {t('reports.force.rebuiltNote', { count: full(rebuilt) })}
          </p>
        ) : null}
      </div>

      <dl data-verdict-payoff className="mt-3 grid grid-cols-2 gap-3 border-t border-v2-line/60 pt-3">
        <div>
          <dt className="text-caption text-v2-ink-2">{t(report.attacking ? 'reports.verdict.loot' : 'reports.haulLost')}</dt>
          <dd className="font-v2-mono tabular-nums mt-1 text-caption font-semibold text-v2-alloy">
            {full(Math.abs(report.lootAlloy + report.lootCrystal + report.lootDeuterium))}
          </dd>
        </div>
        {report.dominion !== null ? (
          <div>
            <dt className="text-caption text-v2-ink-2">{t('reports.dominion')}</dt>
            <dd className={`font-v2-mono tabular-nums mt-1 text-caption font-semibold ${report.dominion < 0 ? 'text-v2-hostile' : 'text-v2-ink'}`}>
              {signed(report.dominion)}
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-3 border-t border-v2-line/60 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-micro font-semibold text-v2-ink-2">
            {t(report.attacking ? 'reports.verdict.enemyDestroyed' : 'reports.verdict.attackerDestroyed')}
          </p>
          <p className={`font-v2-mono tabular-nums text-caption font-semibold leading-none ${theirs > 0 ? 'text-v2-ink' : 'text-v2-ink-2'}`}>
            {full(theirs)}
          </p>
        </div>
        {report.attacking && report.grade !== 'DECISIVE' ? (
          <p className="mt-2 text-caption font-semibold leading-relaxed text-v2-alloy">
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
        <span className="text-caption text-v2-ink">{t('reports.roundDealt')}</span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-cell bg-v2-line">
          <span className="block h-full bg-v2-self" style={{ width: `${String((dealt / top) * 100)}%` }} />
        </span>
        <span className="font-v2-mono tabular-nums min-w-14 text-right text-caption text-v2-ink">{full(dealt)}</span>
      </span>
      <span className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
        <span className="text-caption text-v2-hostile">{t('reports.roundTook')}</span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-cell bg-v2-line">
          <span className="block h-full bg-v2-hostile" style={{ width: `${String((took / top) * 100)}%` }} />
        </span>
        <span className="font-v2-mono tabular-nums min-w-14 text-right text-caption text-v2-ink">{full(took)}</span>
      </span>
    </span>
  );
}

function BattleMetric({
  label,
  value,
  tone = 'text-v2-ink',
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="min-w-0 px-2 first:pl-0 last:pr-0">
      <p className="text-caption text-v2-ink-2">{label}</p>
      <p className={`font-v2-mono tabular-nums mt-1 text-figure ${tone}`}>{full(value)}</p>
    </div>
  );
}

function Losses({ fleet, tone, empty }: { fleet: OrdinaryReport['yourLosses']; tone: string; empty: string }) {
  const entries = fleetEntries(fleet);
  if (entries.length === 0) {
    return <p className="mt-2 text-caption text-v2-ink-3">{empty}</p>;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {entries.map(([hull, count]) => (
        <div key={hull} className="rounded-control border border-v2-line bg-v2-deep/40 flex items-center gap-2 px-3 py-2">
          {HULL_ART[hull] ? (
            <img src={HULL_ART[hull]} alt="" aria-hidden className="size-8 object-contain" />
          ) : (
            <span className="v2-legend">GRD</span>
          )}
          <div>
            <p className={`font-v2-mono tabular-nums text-caption font-semibold leading-none ${tone}`}>{full(count)}</p>
            <p className="v2-legend mt-1">{hullLabel(hull)}</p>
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
        <h3 className="text-caption font-semibold text-v2-ink">
          {emptyAtStart
            ? t('reports.theirBoardEmptyAtStart')
            : entries.length === 0 && !complete
            ? t('reports.theirBoardNothing')
            : t(complete ? 'reports.theirBoardComplete' : 'reports.theirBoardFloor')}
        </h3>
        <p className={`mt-1 text-caption leading-relaxed ${complete ? 'text-v2-ink-2' : 'text-v2-alloy'}`}>
          {t(emptyAtStart ? 'reports.theirBoardEmptyAtStartNote'
            : complete ? 'reports.theirBoardCompleteNote'
            : report.attacking ? 'reports.theirBoardFloorNote' : 'reports.theirBoardMissingRosterNote')}
        </p>
      </div>

      {ships.length > 0 && (
        <>
          <p className="v2-legend mt-2 text-v2-crystal/85">{t('reports.shipsHeading')}</p>
          <Losses fleet={asFleet(ships)} tone="text-v2-ink" empty={t('reports.theirsEmpty')} />
        </>
      )}

      {ground.length > 0 ? (
        <div data-ground-group className="mt-2">
          <p className="v2-legend text-v2-alloy">{t('reports.groundHeading')}</p>
          <p className="mt-1 text-caption leading-relaxed text-v2-ink-2">
            {t('reports.groundNote', { percent: full(COMBAT.defenceSalvage * 100) })}
          </p>
          <Losses fleet={asFleet(ground)} tone="text-v2-alloy" empty={t('reports.theirsEmpty')} />
        </div>
      ) : complete && !emptyAtStart ? (
        /* Only a DECISIVE proves a negative. See the docblock. */
        <div data-no-ground className="mt-2 border-l border-v2-line/60 pl-3">
          <p className="v2-legend text-v2-ink-3">{t('reports.noGroundHeading')}</p>
          <p className="mt-1 text-micro leading-snug text-v2-ink-3">{t('reports.noGroundNote')}</p>
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
      <h3 className="text-caption font-semibold text-v2-ink">{t('reports.theirBoardArrived')}</h3>
      <p className="mt-1 text-caption leading-relaxed text-v2-ink-2">
        {t('reports.theirBoardArrivedNote')}
      </p>
      <div className="rounded-control border border-v2-line bg-v2-deep/40 mt-2">
        {entries.map(([hull, count]) => (
          <ForceRow
            key={hull}
            hull={hull}
            sent={count}
            lost={report.theirLosses[hull] ?? 0}
            side="theirs"
          />
        ))}
        <div className="grid gap-2 border-t border-v2-line p-3 sm:grid-cols-[8rem_1fr] sm:items-center sm:gap-4">
          <span className="text-caption font-semibold text-v2-ink">{t('reports.verdict.total')}</span>
          <SurvivorBar sent={arrived} lost={destroyed} side="theirs" sentLabel={t('reports.force.arrived')} />
        </div>
      </div>
    </section>
  );
}
