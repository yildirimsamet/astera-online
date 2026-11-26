import { BattleEnemyFleet, BattleIntelNotice } from '../ui/BattleEnemyFleet.js';
import { BattleReplayAction } from '../battle-simulator/BattleReplayAction.js';
import { useStarterGate } from '../starter/gate.js';
import { TempoNote } from '../starter/TempoNote.js';
import { DistributedFireRules } from '../ui/DistributedFireRules.js';
import { BattleRetreatNote } from '../ui/BattleRetreatNote.js';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { STANDARD_PVP_BALANCE, type PvpBalance, COMBAT, DEATH_STAR, HULLS, fleetCount, fleetEntries, type Fleet, type Grade, type HullId } from '@astera/rules';
import { useReadReportSignals } from '../session/useReadReportSignals.js';
import { battleOutcome, monumentControlKey, monumentGradeKey, ordinaryBattleOutcome, type BattleOutcome } from '../lib/battleOutcome.js';
import { usePlanet, useReports } from '../api/queries.js';
import { outpostReportLines } from '../starter/outpostReport.js';
import { vesselToPlanetView } from '../starter/adapter.js';
import type { BattleReport, Report, StrategicBattleReport } from '../api/schemas.js';
import i18n from '../i18n/index.js';
import { moonT } from '../i18n/moon.js';
import { buildingNameOf, hullLabel, hullName, instrumentName, monumentName, satelliteNameOf } from '../i18n/names.js';
import { compact, decimal, full, signed } from '../lib/format.js';
import { factorLabel } from '../lib/supportFactor.js';
import { duration, staleness, useNow } from '../lib/time.js';
import { HULL_ART, RESOURCE_ART, instrumentArt } from '../ui/assets.js';
import { HullMark } from '../ui/icons/hulls.js';
import { SurvivorBar } from '../ui/SurvivorBar.js';
import { Unreachable } from '../ui/kit/index.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { EmptyState, Fold, Glyph, SectionTag, artIconSrc, type GlyphId } from '../game-ui/index.js';
import { DominionIcon, HonorIcon } from '../ui/icons/index.js';
import { honorScore } from '../lib/honor.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { ReportScene } from '../v2/hud/ReportScene.js';
import { Sheet as V2Sheet } from '../v2/kit/Sheet.js';
import { MonumentReportSheet } from './MonumentReportSheet.js';
import { HonorBattleSummary } from '../ui/HonorBattleSummary.js';
import { RulesRow } from '../ui/RulesRow.js';
import { ADMIRAL_WAIT } from '@astera/rules/arena/ui';
import { arenaCopy } from '../arena/copy.js';

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
    const retreated = enemy ? undefined : completed.yourRetreated;
    // Opponent retreat hulls are private; avoid inventing active class counts.
    if (enemy && (completed.theirRetreatedCount ?? 0) > 0) return null;
    for (const [hull, count] of fleetEntries(retreated ?? {})) lost[hull] = (lost[hull] ?? 0) + count;
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
  // A ship's report says what it fought; only another ship goes by its name.
  if (report.opponentKind === 'OUTPOST') return i18n.t('starter.reports.outpost');
  if (report.opponentKind === 'PIRATES') return i18n.t('starter.reports.pirates');
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
  || (candidate.kind !== 'STRATEGIC' && candidate.pirateRaidId === id)
  // Aboard a colony ship (`opponentKind` is only ever set there) the signal carries the report's own id.
  || (candidate.kind !== 'STRATEGIC' && candidate.opponentKind !== undefined && candidate.id === id));

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

function reportReferences(report: Report): string[] {
  if (report.kind === 'MONUMENT') return [report.id];
  const refs = [report.id];
  if (report.missionId) refs.push(report.missionId);
  if (report.missionId?.startsWith('bomb:')) refs.push(report.missionId.slice(5));
  if (report.kind !== 'STRATEGIC' && report.pirateRaidId) refs.push(report.pirateRaidId);
  return refs;
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
  useReadReportSignals(!isPending && !isError && report !== undefined, report ? reportReferences(report) : []);
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
  visible = true,
  ...doors
}: {
  open?: { missionId: string; request: number };
  visible?: boolean;
} & ReportDoors = {}) {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useReports();
  const [open, setOpen] = useState<Report | null>(null);
  const [closedRequest, setClosedRequest] = useState<number | null>(null);
  const now = useNow(30_000);
  const reports = data?.reports ?? [];
  const requestedMissionId = requested?.missionId;
  const requestedSequence = requested?.request;
  const requestedReport = requestedMissionId && requestedSequence !== closedRequest
    ? reportFor(reports, requestedMissionId) : undefined;
  const shownReport = open ?? requestedReport;
  useReadReportSignals(visible && !isPending && !isError, shownReport
    ? reportReferences(shownReport) : requestedMissionId && requestedSequence !== closedRequest ? [] : reports.flatMap(reportReferences));
  const closeReport = () => { setOpen(null); setClosedRequest(requestedSequence ?? null); };

  useEffect(() => {
    if (!requestedMissionId || requestedSequence === closedRequest) return;
    const report = reportFor(reports, requestedMissionId);
    if (report) setOpen(report);
  }, [reports, requestedMissionId, requestedSequence, closedRequest]);

  return (
    <div className="gk-intel__part">
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
        <EmptyState art={artIconSrc('menu-reports')} title={t('reports.emptyTitle')} body={t('reports.empty')} />
      ) : (
        // C14: newest first, one ledger row a fight, each row the door to its report.
        <ol className="gk-ledger gk-battles" aria-label={t('reports.heading')}>
          {reports.map((report) => (
            <li key={report.id}>
              {report.kind === 'MONUMENT' ? <MonumentRow report={report} now={now} onOpen={() => { setOpen(report); }} />
                : report.kind === 'STRATEGIC'
                  ? <StrategicReportRow report={report} now={now} onOpen={() => { setOpen(report); }} {...(doors.onFocusPlanet ? { onFocusPlanet: doors.onFocusPlanet } : {})} />
                  : <BattleRow report={report} now={now} onOpen={() => { setOpen(report); }} {...(doors.onFocusPlanet ? { onFocusPlanet: doors.onFocusPlanet } : {})} />}
            </li>
          ))}
        </ol>
      )}

      {open && (
        open.kind === 'MONUMENT' ? <MonumentReportSheet report={open} onClose={closeReport} onFocusMonument={doors.onFocusMonument} /> : open.kind === 'STRATEGIC' ? (
          <StrategicReportSheet report={open} onClose={closeReport} onFocusPlanet={doors.onFocusPlanet} />
        ) : (
          <ReportSheet report={open} onClose={closeReport} {...doors} />
        )
      )}
    </div>
  );
}

const STRATEGIC_OUTCOME = {
  FIRST_STRIKE: 'reports.strategicFirstStrike',
  CAPTURED: 'reports.strategicCaptured',
  INEFFECTIVE: 'reports.strategicIneffective',
  INTERCEPTED: 'reports.strategicIntercepted',
  MOON_CRACKED: 'reports.strategicMoonCracked',
  MOON_DESTROYED: 'reports.strategicMoonDestroyed',
} as const;

/** A strike read from your side: yours landed or was stopped, theirs hit you or was stopped. */
function strategicOutcome(report: StrategicReport): BattleOutcome {
  if (report.outcome === 'INEFFECTIVE') return 'partial';
  const landed = report.outcome !== 'INTERCEPTED';
  return landed === report.attacking ? 'win' : 'loss';
}

const BATTLE_GLYPH = (report: OrdinaryReport): GlyphId =>
  report.pirate ? 'pirate' : report.supportedAt ? 'support' : report.attacking ? 'attack' : 'shield';

/**
 * ONE FIGHT AS A KIT LEDGER ROW (C14). The mark carries the outcome in its colour, so the
 * list reads before a word does; then who it was against, the verdict in that colour, and
 * how long ago, where and what it moved on the ladder. The whole row is the report's door;
 * the world the fight was at keeps its own door, a seam under the row (`WorldSeam`).
 */
function LedgerDoor({ outcome, glyph, onOpen, title, verdict, meta, ladder, age }: {
  outcome: BattleOutcome; glyph: GlyphId; onOpen: () => void;
  title: ReactNode; verdict: ReactNode; meta: readonly ReactNode[]; ladder?: ReactNode; age: string;
}) {
  // how long ago, then whatever else the row knows, dot-separated; an empty part says nothing
  const parts = [<span key="age" className="gk-num">{age}</span>, ...meta.filter((part) => part !== null && part !== '')];
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onOpen(); });
  return (
    <button type="button" data-report-row="" data-battle-outcome={outcome} className="gk-ledger__row gk-battle" {...OWN_SOUND}
      onPointerDown={own.onPointerDown} onClick={own.onClick}>
      <span className="gk-battle__mark" data-tone={outcome} aria-hidden="true"><Glyph id={glyph} /></span>
      <span className="gk-ledger__words">
        <span className="gk-ledger__title">{title}</span>
        <span className="gk-battle__verdict" data-tone={outcome}>{verdict}</span>
        <span className="gk-ledger__sub">{parts.map((part, index) => <Fragment key={index}>{index > 0 ? ' · ' : null}{typeof part === 'string' ? <span>{part}</span> : part}</Fragment>)}</span>
        {ladder}
      </span>
      <span className="gk-ledger__mark gk-battle__next" aria-hidden="true"><Glyph id="next" /></span>
    </button>
  );
}

/** What a fight moved on the ladder, in one line: Honor, then Dominion; a zero moves nothing. */
function LadderLine({ honor, dominion }: { honor?: number | null; dominion?: number | null }) {
  const { t } = useTranslation();
  if ((honor === undefined || honor === null) && (dominion === undefined || dominion === null || dominion === 0)) return null;
  return (
    <span className="gk-battle__ladder">
      {honor !== undefined && honor !== null && (
        <span data-battle-honor="" className="gk-battle__honor gk-num">
          <HonorIcon className="gk-battle__icon" /><span className="sr-only">{t('leaderboard.honorTitle')}</span>{honor > 0 ? '+' : ''}{honorScore(honor)}
        </span>
      )}
      {dominion !== undefined && dominion !== null && dominion !== 0 && (
        <span data-battle-dominion="" className="gk-battle__dominion gk-num">
          <DominionIcon className="gk-battle__icon" /><span className="sr-only">{t('leaderboard.score')}</span>{signed(dominion)}
        </span>
      )}
    </span>
  );
}

/** The world a fight was at, its own door under the row: flies there, opens nothing else. */
function WorldSeam({ planetId, name, onFocusPlanet }: { planetId: string; name: string; onFocusPlanet: (planetId: string) => void }) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onFocusPlanet(planetId); });
  return (
    <button type="button" data-report-planet="" className="gk-ledger__row gk-ledger__seam" {...OWN_SOUND}
      onPointerDown={own.onPointerDown} onClick={own.onClick}>
      <Glyph id="target" />
      <span className="gk-ledger__seamname">{name}</span>
      <span className="gk-ledger__mark" aria-hidden="true"><Glyph id="next" /></span>
    </button>
  );
}

/** A lead-in and the name after it: some languages' lead-ins end without a space. */
const leadIn = (text: string): string => (/\s$/u.test(text) ? text : `${text} `);

function BattleRow({ report, now, onOpen, onFocusPlanet }: {
  report: OrdinaryReport; now: number; onOpen: () => void; onFocusPlanet?: (planetId: string) => void;
}) {
  const { t } = useTranslation();
  const opponentClan = report.attacking ? report.defenderClan : report.attackerClan;
  // A supporter's row names the clanmate's world their ships stood at.
  const listedPlanetId = report.supportedAt?.planetId ?? (report.pirate
    ? report.yourPlanetId
    : report.attacking ? report.opponentPlanetId : report.yourPlanetId);
  const listedPlanet = report.supportedAt?.planetName ?? (report.pirate
    ? report.yourPlanet
    : report.attacking ? report.opponentPlanet : report.yourPlanet);
  const seam = listedPlanetId && listedPlanet !== '' && onFocusPlanet ? { id: listedPlanetId, open: onFocusPlanet } : null;
  return (
    <>
    <LedgerDoor
      outcome={ordinaryBattleOutcome(report)}
      glyph={BATTLE_GLYPH(report)}
      onOpen={onOpen}
      title={<>
        {leadIn(report.supportedAt
          ? t('clanSupport.rowRaidedBy', { host: report.supportedAt.hostName })
          : t(report.attacking ? 'reports.youRaided' : 'reports.raidedBy'))}
        {opponentClan ? <><span className="gk-battle__clan" title={opponentClan.name}>[{opponentClan.tag}]</span>{' '}</> : null}
        <span>{opponentOf(report)}</span>
      </>}
      verdict={verdictTitle(report)}
      // the world is named once: on its own door when there is one, else here
      meta={[
        seam ? null : listedPlanet,
        report.targetBody === 'MOON' ? moonT('body.battleMoonBadge') : null,
        report.rounds.length > 0 ? t('reports.rounds', { count: report.rounds.length }) : null,
      ]}
      ladder={<LadderLine honor={report.honor?.delta} dominion={report.dominion} />}
      age={staleness((now - report.at.getTime()) / 60_000)}
    />
    {seam && <WorldSeam planetId={seam.id} name={listedPlanet} onFocusPlanet={seam.open} />}
    </>
  );
}

function MonumentRow({ report, now, onOpen }: { report: Extract<Report, { kind: 'MONUMENT' }>; now: number; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <LedgerDoor
      outcome={battleOutcome({ ...report, survivors: fleetCount(report.yourSurvivors), losses: fleetCount(report.yourLosses) })}
      glyph="flag"
      onOpen={onOpen}
      title={monumentName(report.monument.ordinal)}
      verdict={`${t(monumentGradeKey(report))} ${t(monumentControlKey(report))}`}
      meta={[t('monument.reportOwn', { sent: fleetCount(report.yourFleet), left: fleetCount(report.yourSurvivors), lost: fleetCount(report.yourLosses) })]}
      ladder={<LadderLine honor={report.honor?.delta} dominion={report.dominion} />}
      age={staleness((now - report.at.getTime()) / 60_000)}
    />
  );
}

function StrategicReportRow({ report, now, onOpen, onFocusPlanet }: {
  report: StrategicReport; now: number; onOpen: () => void; onFocusPlanet?: (planetId: string) => void;
}) {
  const { t } = useTranslation();
  const targetName = report.radiation?.monumentOrdinal && report.attacking
    ? monumentName(report.radiation.monumentOrdinal) : report.opponentPlanet;
  const seam = report.opponentPlanetId && onFocusPlanet ? { id: report.opponentPlanetId, open: onFocusPlanet } : null;
  return (
    <>
    <LedgerDoor
      outcome={strategicOutcome(report)}
      glyph={report.radiation ? 'radiation' : 'target'}
      onOpen={onOpen}
      title={<>
        {leadIn(t(report.radiation ? report.attacking ? 'reports.radiationYouAttacked' : 'reports.radiationAttackedBy' : report.attacking ? 'reports.strategicYouAttacked' : 'reports.strategicAttackedBy'))}
        <span>{report.opponentName}</span>
      </>}
      verdict={t(report.radiation && report.outcome === 'FIRST_STRIKE' ? 'planet.radiationBomb.impact' : STRATEGIC_OUTCOME[report.outcome])}
      meta={[
        seam ? null : targetName,
        report.damage > 0 ? <span className="gk-battle__damage gk-num">{t('reports.strategicDamageShort', { amount: compact(report.damage) })}</span> : null,
        report.loyalty?.after === 0 ? <span className="gk-battle__seceded">{t('reports.strategicSecededShort')}</span> : null,
      ]}
      ladder={<LadderLine honor={report.honor?.delta} />}
      age={staleness((now - report.at.getTime()) / 60_000)}
    />
    {seam && <WorldSeam planetId={seam.id} name={targetName} onFocusPlanet={seam.open} />}
    </>
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
    <div data-report-loyalty className="gk-well gk-report__why">
      <p className="gk-report__tallyrow">
        <span className="gk-report__label">{t('reports.strategicLoyalty')}</span>
        <span className="gk-num" data-tone="threat">
          {t('reports.strategicLoyaltyChange', {
            before: Math.ceil(loyalty.before),
            after: Math.ceil(Math.max(0, loyalty.after)),
          })}
        </span>
      </p>
      <p className="gk-report__copy" {...(seceded ? { 'data-tone': 'threat', 'data-strong': '' } : {})}>
        {seceded
          ? t(attacking ? 'reports.strategicSecededAttacker' : 'reports.strategicSecededDefender')
          : t('reports.strategicLoyaltyNext', { count: Math.max(1, Math.ceil(loyalty.after / DEATH_STAR.colonyLoyaltyLoss)) })}
      </p>
    </div>
  );
}

/** A building, instrument, hull or satellite id off the wire, in the player's words; the id only for one this build does not know. */
const strategicSubject = (kind: StrategicReport['destroyedOrders'][number]['kind'], id: string): string =>
  (kind === 'BUILDING' ? buildingNameOf(id) : kind === 'INSTRUMENT' ? instrumentName(id) : kind === 'HULL' ? hullName(id) : satelliteNameOf(id))
  ?? id.replaceAll('_', ' ');

/**
 * WHOSE GOOD NEWS IT IS (C17). A weapon that landed is a gain for the one who sent it and a
 * loss for the world it hit; one stopped in flight, the other way round; one that did nothing,
 * a shrug for both.
 */
const strategicTone = (report: StrategicReport): 'good' | 'partial' | 'threat' => {
  if (report.outcome === 'INEFFECTIVE') return 'partial';
  const landed = report.outcome !== 'INTERCEPTED';
  return landed === report.attacking ? 'good' : 'threat';
};

/**
 * THE DEATH STAR'S AND THE RADIATION BOMB'S RESULT, ON THE KIT (C17, G5 #4).
 *
 * The moment: a weapon you sent, or one sent at you, has landed — what did it break, and is
 * the colony still mine? The route first (both worlds are doors), then one plate in the
 * colour of whose news it is with the figures that answer it, the Honor it moved, and below,
 * each kind of loss under its own tag. How a bomb works is one rules row away, closed: the
 * report states what happened, the rules wait for the reader who asks why.
 *
 * Exported for the v2 gallery's camera, as `StrikeSheet` is.
 */
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
  const monument = report.radiation?.monumentOrdinal ? monumentName(report.radiation.monumentOrdinal) : null;
  const ownName = !report.attacking && monument ? monument : report.yourPlanet;
  const targetName = report.attacking && monument ? monument : report.opponentPlanet;
  const actorLabel = t(report.radiation ? report.attacking ? 'reports.radiationYouAttacked' : 'reports.radiationAttackedBy' : report.attacking ? 'reports.strategicYouAttacked' : 'reports.strategicAttackedBy');
  const resourcesLost = report.destroyedResources.alloy
    + report.destroyedResources.crystal
    + report.destroyedResources.deuterium;
  const ordersLost = report.destroyedOrders.reduce(
    (sum, order) => sum + order.cost.alloy + order.cost.crystal + order.cost.deuterium,
    0,
  );
  const emp = !report.radiation && report.outcome === 'FIRST_STRIKE' && report.damage === 0;
  const tone = strategicTone(report);
  // What it destroyed is the defender's loss and the attacker's gain: the figures wear that colour.
  const figureTone = report.attacking ? 'good' : 'threat';
  const struck = report.radiation && report.outcome === 'FIRST_STRIKE';

  return (
    <V2Sheet
      detents={['full']}
      eyebrow={`${actorLabel}${report.opponentName}`}
      title={t(report.radiation && report.outcome === 'FIRST_STRIKE' ? 'planet.radiationBomb.impact' : STRATEGIC_OUTCOME[report.outcome])}
      kit={{ tone: tone === 'threat' ? 'hostile' : 'self', ...(report.radiation ? {} : { art: artIconSrc('deathstar') }) }}
      onClose={onClose}
    >
      <div data-strategic-report className="gk-report gk-strike">
        {ownName ? (
          <div data-report-route="" className="gk-route">
            <RouteEnd id={report.yourPlanetId ?? null} name={ownName} onFocusPlanet={onFocusPlanet} />
            <span data-route-arrow="" data-dir={report.attacking ? 'out' : 'in'} className="gk-route__arrow" aria-hidden="true">
              <Glyph id="next" />
            </span>
            <RouteEnd id={report.opponentPlanetId} name={targetName} onFocusPlanet={onFocusPlanet} />
          </div>
        ) : null}

        <section data-strategic-verdict="" data-tone={tone} className="gk-well gk-report__verdict">
          {report.outcome === 'INTERCEPTED' ? (
            <>
              <h3 className="gk-report__subhead">{t('reports.strategicDestroyedInFlight')}</h3>
              <p className="gk-report__copy">
                {t(report.trigger === 'TELESCOPE' ? 'reports.strategicTelescopeTrigger' : 'reports.strategicRadarTrigger')}
              </p>
            </>
          ) : report.radiation ? (
            <>
              <h3 className="gk-report__subhead">{t('planet.radiationBomb.title')} · {t('planet.radiationBomb.level', { level: report.radiation.level })}</h3>
              {!struck && <p className="gk-report__copy">{t('reports.strategicIneffective')}</p>}
              {struck && report.loyalty && (
                <p data-report-loyalty="" className="gk-report__note" data-tone="threat">
                  {t('planet.radiationBomb.colonyResult', {
                    before: Math.ceil(report.loyalty.before), after: Math.ceil(Math.max(0, report.loyalty.after)),
                  })}
                  {report.loyalty.after <= 0 && <> {t('planet.radiationBomb.colonySeceded')}</>}
                </p>
              )}
              {struck && (report.radiation.faults?.length ?? 0) > 0 && (
                <p className="gk-report__note" data-tone="threat">{t('planet.radiationBomb.faultResult', {
                  faults: report.radiation.faults?.map(fault => t(`faults.name.${fault}`)).join(', '),
                })}</p>
              )}
            </>
          ) : emp ? (
            <p className="gk-report__copy" data-strong="">{t('reports.strategicEmpEffect')}</p>
          ) : (
            <div className="gk-report__metrics" data-cols="2">
              <StrategicFigure label={t('reports.strategicTotalDamage')} value={report.damage} tone={figureTone} />
              <StrategicFigure label={t('reports.strategicShieldLost')} value={report.shieldDestroyed} tone={figureTone} />
              <StrategicFigure label={t('reports.strategicResourcesLost')} value={resourcesLost} tone={figureTone} />
              <StrategicFigure label={t('reports.strategicOrdersLost')} value={ordersLost} tone={figureTone} />
            </div>
          )}
        </section>

        {emp && report.loyalty && <LoyaltyHit loyalty={report.loyalty} attacking={report.attacking} />}
        {report.honor && <HonorBattleSummary receipt={report.honor} />}

        {report.radiation && struck && (
          <RulesRow glyph="help" title={t('reports.strategicBombRules')}>
            <p>{t('planet.radiationBomb.effect')}</p>
            <p>{t('planet.radiationBomb.workshop')}</p>
            {report.honor && <p>{t('planet.radiationBomb.honor')}</p>}
          </RulesRow>
        )}

        {!report.radiation && !emp && report.outcome !== 'INTERCEPTED' && (
          <>
            <section className="gk-report__part">
              <SectionTag as="h2">{t('reports.strategicResourceBreakdown')}</SectionTag>
              <p className="gk-haul__row gk-num">
                {(['alloy', 'crystal', 'deuterium'] as const).map((res) => (
                  <span key={res} className="gk-haul__res" data-res={res}>
                    <img src={RESOURCE_ART[res]} alt={t(`vocabulary.resource.${res}`)} />
                    {full(report.destroyedResources[res])}
                  </span>
                ))}
              </p>
            </section>
            <section className="gk-report__part">
              <SectionTag as="h2">{t('reports.strategicFleetLost')}</SectionTag>
              <Losses fleet={report.destroyedFleet} tone="threat" empty={t('reports.strategicNoFleetLost')} />
            </section>
            <section className="gk-report__part">
              <SectionTag as="h2">{t('reports.strategicLevelLosses')}</SectionTag>
              {report.levelChanges.length === 0 ? (
                <p className="gk-report__copy">{t('reports.strategicNoLevelLoss')}</p>
              ) : (
                <dl className="gk-well gk-report__sum">
                  {report.levelChanges.map((change, index) => (
                    <Fragment key={`${change.kind}-${change.id}-${String(index)}`}>
                      <dt>{strategicSubject(change.kind, change.id)}</dt>
                      <dd className="gk-num" data-tone="threat">L{change.before} → L{change.after}</dd>
                    </Fragment>
                  ))}
                </dl>
              )}
            </section>
            <section className="gk-report__part">
              <SectionTag as="h2">{t('reports.strategicDestroyedOrders')}</SectionTag>
              {report.destroyedOrders.length === 0 ? (
                <p className="gk-report__copy">{t('reports.strategicNoOrdersLost')}</p>
              ) : (
                <dl className="gk-well gk-report__sum">
                  {report.destroyedOrders.map((order, index) => (
                    <Fragment key={`${order.subject}-${String(index)}`}>
                      <dt>{strategicSubject(order.kind, order.subject)} ×{order.count}</dt>
                      <dd className="gk-num" data-tone="threat">{full(order.cost.alloy + order.cost.crystal + order.cost.deuterium)}</dd>
                    </Fragment>
                  ))}
                </dl>
              )}
            </section>
          </>
        )}
      </div>
    </V2Sheet>
  );
}

function StrategicFigure({ label, value, tone }: { label: string; value: number; tone: 'good' | 'threat' }) {
  return (
    <div className="gk-report__metric">
      <p className="gk-report__label">{label}</p>
      <p className="gk-report__figure gk-num" {...(value > 0 ? { 'data-tone': tone } : {})}>{full(value)}</p>
    </div>
  );
}

/**
 * The grade, as a mark rather than a word.
 *
 * DECISIVE, PARTIAL and REPELLED are the three outcomes the whole combat model
 * produces, and which one you got is the first thing a player looks for.
 */
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
  const { aboard } = useStarterGate();
  const vessel = usePlanet().data?.vessel;
  const told = vessel ? outpostReportLines(report, t, vesselToPlanetView(vessel)) : [];
  /** "Watch" (the mock's İzle): the round by round, further down this sheet. */
  const rounds = useRef<HTMLDetailsElement>(null);
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
        : `${t('reports.sheetTheyRaided', { opponent: opponentOf(report) })} · ${t(report.opponentKind ? 'starter.reports.attackedShip' : 'reports.attackedPlanet', { planet: report.yourPlanet })}`}
      title={verdictTitle(report)}
      onClose={onClose}
    >
      <div data-battle-report className="gk-report">
      {report.targetBody === 'MOON' && (
        <p data-testid="battle-moon-note" className="gk-inote" data-tone={report.rounds.length === 0 ? 'self' : 'warn'}>
          <Glyph id="moon" />
          {report.rounds.length === 0 && report.grade === 'DECISIVE'
            ? moonT('body.battleMoonEmpty')
            : moonT('body.battleMoonBadge')}
        </p>
      )}
      <TempoNote aboard={aboard} />
      <BattleReplayAction kind="BATTLE" id={report.id} status={report.replayStatus} {...(report.pirate ? { pirateLevel: report.pirate.level } : {})} />
      {/*
        THE SCENE FIRST (B15, the mock's "KISMİ ZAFER"): the world, the haul, both sides, one
        sentence of why and the balance. The sheet's title already carries the verdict and is
        its accessible name, so the scene stands a dot in the verdict's colour in for the word.
        The four questions below are the scene's detail.
      */}
      <ReportScene
        report={report}
        word={verdictTitle(report)}
        colonyTarget={target !== null && (colonyOf?.(target) ?? false)}
        rivalSlot={report.opponentPlanetId ? rivalOf?.(report.opponentPlanetId) ?? null : null}
        onWatch={() => {
          const fold = rounds.current;
          if (!fold) return;
          fold.open = true;
          if ('scrollIntoView' in fold) fold.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        {...(onShare ? { onShare } : {})}
        told={told}
        {...(target !== null && onAttackAgain ? { onAttackAgain: () => { onAttackAgain(target); } } : {})}
      />
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

        So the sheet is four headed sections, each under the kit's section tag:

          1 · WHAT HAPPENED      the verdict, where, and why that word
          2 · WHAT WAS THERE     their board, their wall, their shield
          3 · WHO DIED, AND WHEN your survivors and the round-by-round
          4 · WHAT IT CHANGED    haul, Dominion, wreck, consequences

        and then the move the fight opened (C15): a report produces intel, and intel is
        only worth something as the next decision.

        Outcomes, losses and remaining forces never fold. Calculation recipes are
        optional details: understand the battle first, inspect the arithmetic next.
      */}
      {/*
        O6 (owner 2026-11-17, item 6): "Tüm verileri oyuncunun önüne yığmak =! oyuncuya sonucu iyi
        bir şekilde sunduk." The scene above IS the result; each question below is one shut fold
        whose head sums it, so the sheet reads as the result and four doors, not a 4,000 px column.
      */}
      <Fold data-report-section="happened" glyph="target" title={t('reports.q.happened')}><div className="gk-report__part">
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
        {report.yourPlanet && <ReportRoute report={report} {...(onFocusPlanet ? { onFocusPlanet } : {})} />}
        {/*
          THE HANDICAP THAT PRODUCED EVERY DAMAGE FIGURE BELOW. D124 · D150.

          A pirate's entire difference from a player fleet of the same roster is a
          per-level cut to its ATTACK, and nothing on this surface said so — the
          reader was being asked to check the arithmetic against a rule the interface
          never states. The same sentence the launch rail shows before committing, so
          what a commander priced the fight with is what the report explains it with.
        */}
        {report.pirate && (
          <p className="gk-report__note">
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
        <section data-battle-reason className="gk-well gk-report__why">
          <h3 className="gk-report__subhead">{t('reports.reasonHeading')}</h3>
          <p className="gk-report__copy">
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
              : report.opponentKind && perspective === 'defending' && whyGrade === 'WALKOVER'
                ? t('starter.reports.walkover')
                : t(`reports.why.${perspective}.${whyGrade}`)}
          </p>
          <CombatTurningPoint report={report} />
        </section>
      </div></Fold>

      <Fold data-report-section="there" glyph="eye" title={t(
        report.attacking
          ? (report.enemyFleetVisibility === 'FULL' || (report.enemyFleetVisibility === undefined && report.grade === 'DECISIVE'))
            ? 'reports.q.enemyForce'
            : 'reports.q.enemyLosses'
          : 'reports.q.incomingForce',
      )}><div className="gk-report__part">
        {/* The frozen intelligence permission decides the roster; legacy payloads retain their older rendering. */}
        <TheirBoard report={report} />
        {/*
          THE AEGIS IS ALWAYS THE DEFENDER'S, so which section it belongs to depends
          on which end of the battle the reader is standing at.

          Raiding, it is part of the wall they flew into and belongs here. Being
          raided, it is their OWN board — filing it under "what was on the other
          side" would tell a defender their attacker brought a planet shield.
        */}
        {report.attacking && <ShieldImpact report={report} />}
      </div></Fold>

      <Fold ref={rounds} data-report-section="who" glyph="attack" title={t('reports.q.who')}
        {...(report.rounds.length > 0 ? { value: t('reports.rounds', { count: report.rounds.length }) } : {})}><div className="gk-report__part">
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
        <div className="gk-report__block">
          <h3 className="gk-report__subhead">
            {t(fleetEntries(report.yourFleet).length > 0 ? 'reports.yourForce' : 'reports.yours')}
          </h3>
          {fleetEntries(report.yourFleet).length > 0 ? (
            <YourForce report={report} />
          ) : (
            <Losses fleet={report.yourLosses} tone="threat" empty={t('reports.yoursEmpty')} />
          )}
        </div>
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
          <section data-walkover className="gk-well gk-report__why">
            <h3 className="gk-report__subhead">{t('reports.walkoverHeading')}</h3>
            <p className="gk-report__copy">
              {t(report.attacking ? 'reports.walkoverBody' : report.opponentKind ? 'starter.reports.walkoverBody' : 'reports.walkoverDefendingBody')}
            </p>
          </section>
        ) : (
        <div className="gk-report__block">
          <h3 className="gk-report__subhead">{t('reports.howItWent')}</h3>
          <p className="gk-report__copy">{t('reports.calculation.fireNote')}</p>
          {!report.pirate ? <p className="gk-report__copy">{t('reports.roundDamageNote')}</p> : null}
          {report.rounds.some(round => round.distributedFire === true) ? <DistributedFireRules targetLimit={report.rounds.find(round => round.targetLimit !== undefined)?.targetLimit} /> : null}
          <div className="gk-ledger gk-rounds">
            {report.rounds.map((round) => (
              <BattleRound key={round.round} report={report} round={round} />
            ))}
          </div>
          {report.pirate && <HoldsTaken report={report} />}
          <RulesRow glyph="help" title={t('reports.rulesToggle')}>
            <CombatFormula grade={report.grade} pirate={report.pirate != null} balance={report.pvpBalance ?? STANDARD_PVP_BALANCE} />
          </RulesRow>
        </div>
        )}
      </div></Fold>

      <Fold data-report-section="changed" glyph="crate" title={t('reports.q.changed')}
        {...(report.dominion !== null && report.dominion !== 0 ? { value: signed(report.dominion) } : {})}><div className="gk-report__part">
        {/* The opening verdict already states losses, loot and Dominion. This section
            expands only the figures that have more to explain. */}
        {report.dominion !== null ? (
          <p className="gk-report__copy">{t('reports.dominionReason')}</p>
        ) : null}
        {report.dominion !== null && report.dominion !== 0 ? (
          <p data-dominion-summary className="gk-report__note" data-tone={report.dominion >= 0 ? 'good' : 'threat'}>
            {t(
              report.dominion >= 0
                ? 'reports.dominionSummaryGained'
                : 'reports.dominionSummaryLost',
              { amount: full(Math.abs(report.dominion)) },
            )}
          </p>
        ) : null}
        {report.dominionBreakdown && (
          <section className="gk-well" data-dominion-ruleset={report.dominionBreakdown.ruleVersion}>
            <dl className="gk-report__sum">
              <div className="gk-report__sumhead">
                <h3 className="gk-report__subhead">{t('reports.dominionBreakdown.title')}</h3>
                <span className="gk-num">v{report.dominionBreakdown.ruleVersion}</span>
              </div>
              <dt>
                {t(report.dominionBreakdown.lootValue >= 0
                  ? 'reports.dominionBreakdown.lootGained'
                  : 'reports.dominionBreakdown.lootLost')}
              </dt>
              <dd className="gk-num" data-tone={report.dominionBreakdown.lootValue >= 0 ? 'alloy' : 'threat'}>
                {signed(report.dominionBreakdown.lootValue)}
              </dd>
              <dt>{t('reports.dominionBreakdown.enemyLosses')}</dt>
              <dd className="gk-num" data-tone="good">
                {signed(report.dominionBreakdown.enemyPermanentLossValue)}
              </dd>
              <dt>{t('reports.dominionBreakdown.ownLosses')}</dt>
              <dd className="gk-num" data-tone="threat">
                {signed(-report.dominionBreakdown.ownPermanentLossValue)}
              </dd>
              <dt data-total="">{t('reports.dominionBreakdown.total')}</dt>
              <dd data-total="" className="gk-num" data-tone={report.dominionBreakdown.rawExchange >= 0 ? 'good' : 'threat'}>
                {signed(report.dominionBreakdown.rawExchange)}
              </dd>
            </dl>
          </section>
        )}
        {looted !== 0 && (
          <div className="gk-haul">
            <p className="gk-report__label">{t(looted >= 0 ? 'reports.haul' : 'reports.haulLost')}</p>
            <HaulLine alloy={report.lootAlloy} crystal={report.lootCrystal} deuterium={report.lootDeuterium} />
          </div>
        )}
        {/*
          WHAT THE COLLECTORS LIFTED, UNDER THE HAUL AND NEVER INSIDE IT. D200.

          It came home with the fleet, so it belongs beside "what came home" — but it
          is not loot: it was never the defender's and it moved no Dominion, and a sum
          that folded the two together would print a haul the equation above cannot
          account for. Attacker's copy only; the defender reads it as a consequence.
        */}
        {report.attacking && lifted > 0 && salvage && (
          <div className="gk-haul">
            <p className="gk-report__label">{t('reports.salvageHaul')}</p>
            <HaulLine testId="report-salvage" alloy={salvage.alloy} crystal={salvage.crystal} deuterium={salvage.deuterium} />
          </div>
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
          <div className="gk-well gk-clans">
            <h3 className="gk-report__subhead gk-clans__head">{t('reports.clansAtLaunch')}</h3>
            <ClanAtLaunch label={t('reports.yourClan')} clan={yourClan} />
            <ClanAtLaunch label={t('reports.theirClan')} clan={theirClan} />
          </div>
        ) : null}
      </div></Fold>
      <NextMoves report={report} {...(onFocusPlanet ? { onFocusPlanet } : {})} />
      </div>
    </V2Sheet>
  );
}

/**
 * BOTH ENDS OF THE FIGHT, EACH A DOOR TO ITS WORLD (C15). The reader's own world first, the
 * arrow pointing out on a raid and in on a defence. A world with nowhere to fly to — no id,
 * or no galaxy behind the sheet — is a name.
 */
function ReportRoute({ report, onFocusPlanet }: { report: OrdinaryReport; onFocusPlanet?: (planetId: string) => void }) {
  return (
    <div data-report-route="" className="gk-route">
      <RouteEnd id={report.yourPlanetId ?? null} name={report.yourPlanet} onFocusPlanet={onFocusPlanet} />
      {report.opponentPlanet !== '' && (
        <>
          <span data-route-arrow="" data-dir={report.attacking ? 'out' : 'in'} className="gk-route__arrow" aria-hidden="true">
            <Glyph id="next" />
          </span>
          <RouteEnd id={report.opponentPlanetId} name={report.opponentPlanet} onFocusPlanet={onFocusPlanet} />
        </>
      )}
    </div>
  );
}

function RouteEnd({ id, name, onFocusPlanet }: { id: string | null; name: string; onFocusPlanet: ((planetId: string) => void) | undefined }) {
  const own = useOwnPress(() => {
    if (!id || !onFocusPlanet) return;
    playSound('tap');
    haptic('tap');
    onFocusPlanet(id);
  });
  if (!id || !onFocusPlanet) return <span className="gk-route__name">{name}</span>;
  return (
    <button type="button" className="gk-route__door" {...OWN_SOUND} onPointerDown={own.onPointerDown} onClick={own.onClick}>
      <Glyph id="target" />
      <span>{name}</span>
    </button>
  );
}

/** Three materials as the game draws them, signed: what came home, or what was taken. */
function HaulLine({ alloy, crystal, deuterium, testId }: { alloy: number; crystal: number; deuterium: number; testId?: string }) {
  const { t } = useTranslation();
  const parts: { res: 'alloy' | 'crystal' | 'deuterium'; value: number }[] = [
    { res: 'alloy', value: alloy },
    { res: 'crystal', value: crystal },
    ...(deuterium !== 0 ? [{ res: 'deuterium' as const, value: deuterium }] : []),
  ];
  return (
    <p className="gk-haul__row gk-num" {...(testId ? { 'data-testid': testId } : {})}>
      {parts.map((part) => (
        <span key={part.res} className="gk-haul__res" data-res={part.res}>
          <img src={RESOURCE_ART[part.res]} alt={t(`vocabulary.resource.${part.res}`)} />
          {signed(part.value)}
        </span>
      ))}
    </p>
  );
}

interface NextMove { kind: 'source' | 'wreck'; glyph: GlyphId; tone?: 'alloy' | 'hostile'; title: string; sub: string; go: () => void }

/**
 * WHAT NOW (C15). A report produces intel, and intel is only worth something as the next
 * decision, so the sheet closes on the doors this fight opened — each one only when it can
 * open: the raided world's dossier, which this fight just wrote to; the world a raid came
 * from; the wreck the fight left, over a world (a pirate's orbits nothing).
 */
function NextMoves({ report, onFocusPlanet }: { report: OrdinaryReport } & Pick<ReportDoors, 'onFocusPlanet'>) {
  const { t } = useTranslation();
  const moves: NextMove[] = [];
  // The scene above carries Attack again (O6: one door to one move); these are the moves it lacks.
  const source = !report.attacking && !report.pirate && report.opponentPlanet !== '' ? report.opponentPlanetId : null;
  if (source && onFocusPlanet) {
    moves.push({ kind: 'source', glyph: 'target', tone: 'hostile', title: t('reports.next.source', { planet: report.opponentPlanet }),
      sub: t('reports.next.sourceNote'), go: () => { onFocusPlanet(source); } });
  }
  // The wreck drifts over the world that was attacked: theirs on a raid, yours (or the clanmate's you stood at) on a defence.
  const wreck = report.pirate ? null : report.attacking
    ? { id: report.opponentPlanetId, name: report.opponentPlanet }
    : { id: report.supportedAt?.planetId ?? report.yourPlanetId ?? null, name: report.supportedAt?.planetName ?? report.yourPlanet };
  const wreckId = wreck?.id;
  if (report.wreckValue >= 1 && wreck && wreckId && wreck.name !== '' && onFocusPlanet) {
    moves.push({ kind: 'wreck', glyph: 'debris', tone: 'alloy', title: t('reports.next.wreck', { planet: wreck.name }),
      sub: t('reports.next.wreckNote', { amount: compact(report.wreckValue) }), go: () => { onFocusPlanet(wreckId); } });
  }
  if (moves.length === 0) return null;
  return (
    <section data-report-section="now" className="gk-report__part">
      <SectionTag as="h2">{t('reports.next.title')}</SectionTag>
      <div className="gk-ledger gk-next">
        {moves.map((move) => <NextMoveDoor key={move.kind} move={move} />)}
      </div>
    </section>
  );
}

function NextMoveDoor({ move }: { move: NextMove }) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); move.go(); });
  return (
    <button type="button" data-next-move={move.kind} className="gk-ledger__row" {...OWN_SOUND}
      onPointerDown={own.onPointerDown} onClick={own.onClick}>
      <span className="gk-next__mark" {...(move.tone ? { 'data-tone': move.tone } : {})} aria-hidden="true"><Glyph id={move.glyph} /></span>
      <span className="gk-ledger__words">
        <span className="gk-ledger__title">{move.title}</span>
        <span className="gk-ledger__sub">{move.sub}</span>
      </span>
      <span className="gk-ledger__mark" aria-hidden="true"><Glyph id="next" /></span>
    </button>
  );
}

function JointWarForces({ report }: { report: OrdinaryReport }) {
  const { t } = useTranslation();
  const joint = report.jointWar;
  if (!joint) return null;
  return <section data-joint-war className="gk-well gk-report__why">
    <h3 className="gk-report__subhead">
      {t('clanWar.report.title', { tag: joint.clan.tag })}
    </h3>
    <p className="gk-report__copy">
      {t('clanWar.report.summary', {
        count: joint.attackerCount,
        sent: unitCount(joint.sent),
        lost: unitCount(joint.losses),
        returned: unitCount(joint.survivors),
      })}
    </p>
    <p className="gk-report__copy" data-tone="quiet">
      {t('clanWar.report.ratio', {
        attackers: joint.attackerCount,
        // Only the host's Dominion moves against a supported line (owner, 2026-10-02): the
        // support is priced by power in the defending line's section, never as heads here.
        defenders: report.defenseLine ? 1 : joint.defenderCount,
      })}
    </p>
    {joint.baseExchange !== null && joint.adjustedTransfer !== null && (
      <p className="gk-report__copy" data-tone="crystal">
        {t('clanWar.report.audit', {
          base: signed(joint.baseExchange),
          adjusted: signed(joint.adjustedTransfer),
        })}
      </p>
    )}
    {joint.participants.map((participant) => <div key={participant.playerId} className="gk-report__member">
      <p className="gk-report__subhead">{participant.name}</p>
      <p className="gk-report__copy">
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
      <ul className="gk-report__waves">
        {participant.waves.map((wave) => <li key={wave.id}>
          <span className="gk-report__copy" data-tone="quiet">{t('clanWar.report.wave', {
            world: wave.originPlanetName,
            sent: unitCount(wave.sent),
            lost: unitCount(wave.losses),
            returned: unitCount(wave.survivors),
          })}</span>
          <span className="gk-report__copy">{t('clanWar.report.waveRewards', {
            loot: full(wave.loot.alloy + wave.loot.crystal + wave.loot.deuterium),
            salvage: full(wave.salvage.alloy + wave.salvage.crystal + wave.salvage.deuterium),
          })}</span>
          <span className="gk-report__copy">
            {wave.destinationPlanetName
              ? t('clanWar.report.waveState', {
                  status: t(`clanWar.status.${wave.status}`),
                  destination: wave.destinationPlanetName,
                })
              : t(`clanWar.status.${wave.status}`)}
          </span>
          {wave.returnAt && <span className="gk-report__copy">
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
  /*
    F2 E3 NÖBET ŞANI: a line that held names the supporter who brought the most ships to it —
    what they sent where the reader was told it, what they lost otherwise.
  */
  const hero = report.grade === 'REPELLED'
    ? line.members.filter((member) => member.role === 'SUPPORT')
      .map((member) => ({ member, ships: unitCount(member.sent ?? member.losses) }))
      .sort((a, b) => b.ships - a.ships || a.member.name.localeCompare(b.member.name))[0] ?? null
    : null;
  return (
    <section data-defense-line aria-label={t('clanSupport.lineTitle')} className="gk-well gk-report__why">
      <h3 className="gk-report__sumhead gk-report__subhead">
        {t('clanSupport.lineTitle')}
        <span className="gk-report__label gk-num">
          {t('clanSupport.lineCount', { count: line.defenderCount })}
        </span>
      </h3>
      {hero && (
        <p data-line-hero="" className="gk-report__hero">
          <Glyph id="star" />
          <span className="min-w-0">{hero.member.sent
            ? t('clanSupport.lineHero', { name: hero.member.name, count: hero.ships })
            : t('clanSupport.lineHeroName', { name: hero.member.name })}</span>
        </p>
      )}
      <ul className="gk-report__line">
        {line.members.map((member) => (
          <li key={member.playerId}>
            <span className="min-w-0 flex-1">
              <span className="gk-report__who">
                <span className="gk-report__subhead gk-person__name">{member.name}</span>
                <span className="gk-report__role" data-role={member.role}>
                  {t(member.role === 'HOST' ? 'clanSupport.lineHost' : 'clanSupport.lineSupport')}
                </span>
              </span>
              <span className="gk-report__label gk-num">
                {t('clanSupport.lineLost', { count: unitCount(member.losses) })}
                {member.survivors !== null && ` · ${t('clanSupport.lineKept', { count: unitCount(member.survivors) })}`}
              </span>
            </span>
            {/* Only the host's Dominion moves (owner, 2026-10-02): a supporter's row carries none. */}
            {member.role === 'HOST' && (
              <span className="gk-report__copy gk-num" data-strong="">
                {t('clanSupport.lineDominion', { value: signed(member.dominion) })}
              </span>
            )}
          </li>
        ))}
      </ul>
      {factorLine && <p className="gk-report__copy" data-strong="">{factorLine}</p>}
      <p className="gk-report__copy" data-tone="quiet">{t('clanSupport.lineRule')}</p>
    </section>
  );
}

/** The colour a consequence is read in: a gain, a loss, a resource, a warning, the clan. */
type EffectTone = 'self' | 'threat' | 'alloy' | 'crystal' | 'warn' | 'ally' | 'plain';

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
  const now = useNow(60_000);
  const salvaged = fleetEntries(report.defenceSalvage).reduce((sum, [, n]) => sum + n, 0);
  const lines: { key: string; tone: EffectTone; text: string }[] = [];

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
    lines.push({ key: 'escape', tone: 'alloy', text: t('reports.effects.fled') });
  } else if (escape?.kind === 'ESCAPED' && escape.ships !== undefined && escape.fuel !== undefined) {
    // F1: the clanmates' waves that ran with the line, free — said in the same line.
    const lifted = (escape.support ?? []).reduce((sum, wave) => sum + fleetCount(wave.ships), 0);
    const ran = t('reports.effects.escaped', { count: fleetCount(escape.ships), fuel: escape.fuel });
    lines.push({
      key: 'escape',
      tone: 'self',
      text: lifted > 0 ? `${ran} · ${t('reports.effects.escapedSupport', { count: lifted })}` : ran,
    });
  } else if (escape?.kind === 'STRANDED' && !report.attacking) {
    lines.push({
      key: 'escape',
      tone: 'threat',
      text: t('reports.effects.stranded', { fuel: escape.fuel, available: escape.available }),
    });
  }

  /*
    THE COMMANDER SHIP THAT FLEW BESIDE A SIDE (Y9). It never fires and is never hit, so the
    rounds cannot show it; this line does. The raider is also told what a lost battle costs it.
  */
  const arena = arenaCopy();
  for (const [index, admiral] of (report.admirals ?? []).entries()) {
    const values = { ship: arena.classes[admiral.ship].name, level: arena.level(admiral.level) };
    const lost = report.grade === 'REPELLED'
      || (fleetCount(report.yourFleet) > 0 && fleetCount(report.yourLosses) >= fleetCount(report.yourFleet));
    lines.push({
      key: `admiral:${String(index)}`,
      tone: admiral.side !== 'attack' || !report.attacking ? 'plain' : lost ? 'warn' : 'self',
      text: admiral.side === 'defence' ? t('reports.effects.admiralDefence', values)
        : !report.attacking ? t('reports.effects.admiralRaider', values)
          : lost ? t('reports.effects.admiralRepair', { ...values, minutes: ADMIRAL_WAIT.repairMinutes })
            : t('reports.effects.admiralYours', values),
    });
  }

  /* SENTEZ CAPSULES (plan 2026-11-24 §3.5): the battle lifts the veil, so either side reads what the raid wore. */
  if (report.appliedCapsules?.length) {
    lines.push({
      key: 'capsules',
      tone: 'plain',
      text: `${t('synthesis.report.worn')}: ${report.appliedCapsules
        .map((capsule) => `${t(`synthesis.capsule.${capsule.id}.name`)} ×${String(capsule.count)}`).join(' · ')}`,
    });
  }

  // A current report gets the drawn before→after Aegis card above. Keep this
  // sentence only for a legacy report whose old payload knows the absorbed total
  // but cannot honestly reconstruct either endpoint.
  if (report.shieldAbsorbed >= 1 && shieldState(report).before === null) {
    lines.push({
      key: 'shield',
      tone: 'crystal',
      text: t(report.attacking ? 'reports.effects.shieldTheirs' : 'reports.effects.shieldYours', {
        amount: compact(report.shieldAbsorbed),
      }),
    });
  }
  if (report.cargoLimited) {
    lines.push({
      key: 'cargo',
      tone: 'alloy',
      text: t(report.opponentKind ? 'starter.reports.cargoLimited' : 'reports.effects.cargoLimited'),
    });
  }
  // The raid may have cost everything and still opened the door: what is left there waits for a second fleet.
  if (report.guardDownUntil && report.guardDownUntil.getTime() > now) {
    lines.push({
      key: 'guard',
      tone: 'self',
      text: t('starter.reports.guardDown', { time: duration((report.guardDownUntil.getTime() - now) / 60_000) }),
    });
  }
  if (salvaged > 0) {
    lines.push({
      key: 'salvage',
      tone: 'self',
      text: t('reports.effects.salvaged', { count: salvaged }),
    });
  }
  if (report.disruptedMinutes >= 1) {
    lines.push({
      key: 'works',
      tone: report.attacking ? 'self' : 'threat',
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
      tone: 'alloy',
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
      tone: 'alloy',
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
  // F2 E4 Zafer Kasası: half of a held line's wreck went home with the clan, said beside the field.
  const purse = report.clanPurse;
  if (!report.attacking && purse && purse.alloy + purse.crystal + purse.deuterium >= 1) {
    const amounts = (['alloy', 'crystal', 'deuterium'] as const).filter((key) => purse[key] >= 1)
      .map((key) => `${full(purse[key])} ${t(`vocabulary.resource.${key}`)}`).join(' · ');
    lines.push({ key: 'clanPurse', tone: 'ally', text: t('reports.effects.clanPurse', { amounts }) });
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
      tone: 'threat',
      text: t('reports.effects.colonyFaults', {
        planet: report.yourPlanet,
        faults: broken.map((kind) => t(`faults.name.${kind}`)).join(' · '),
      }),
    });
  }

  /*
    WHERE THIS DEFEAT LEFT THE READER AGAINST THE RECOVERY SHIELD. Owner instruction,
    2026-09-18: the bar is the NET loss across the selected lookback, so a player needs to see
    how close the raids so far have brought them — the rule stated beside the figure,
    one tap from the defeat that moved it. Defender only; the server sends an attacker
    null, and the guard here keeps it that way on its own.
  */
  const recovery = report.attacking ? null : report.recovery ?? null;
  if (recovery && recovery.lossHours > 0) {
    const balance = report.pvpBalance ?? STANDARD_PVP_BALANCE;
    // A tier upgrade must not shorten an existing shield. The stored deadline can
    // therefore cover longer than this battle's nominal profile duration.
    const preservedHours = recovery.shielded && recovery.until && recovery.until > report.at
      ? (recovery.until.getTime() - report.at.getTime()) / 3_600_000
      : balance.recoveryShieldHours;
    const values = {
      hours: recovery.lossHours >= 999 ? '999+' : decimal(recovery.lossHours),
      bar: balance.recoveryLossHours,
      window: balance.recoveryLookbackHours,
      shield: decimal(preservedHours, Number.isInteger(preservedHours) ? 0 : 1),
    };
    lines.push({
      key: 'recovery',
      tone: recovery.shielded ? 'self' : 'plain',
      text: recovery.shielded
        ? t('reports.effects.recoveryEarned', values)
        : recovery.lossHours >= balance.recoveryLossHours
          ? t('reports.effects.recoveryRefused', values)
          : t('reports.effects.recoveryProgress', values),
    });
  }

  if (lines.length === 0) return null;

  return (
    <div className="gk-well gk-effects">
      <h3 className="gk-report__subhead">{t('reports.effects.heading')}</h3>
      <ul>
        {lines.map((line) => (
          <li
            key={line.key}
            data-effect={line.key.split(':')[0]}
            data-tone={line.tone}
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
function CombatFormula({ grade, pirate = false, balance }: { grade: Grade; pirate?: boolean; balance: PvpBalance }) {
  const { t } = useTranslation();
  const percent = (share: number) => decimal(share * 100, Number.isInteger(share * 100) ? 0 : 1);
  return (
    <section data-combat-formula className="gk-report__formula">
      <p className="gk-report__subhead">{t('reports.calculation.formulaHeading')}</p>
      <ol>
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
      <div className="gk-report__formulanotes">
        <p>{t('reports.calculation.formulaHp')}</p>
        <p>{t('reports.calculation.formulaCarry')}</p>
        <p>{t('reports.calculation.formulaSupport')}</p>
      </div>
      <p className="gk-report__subhead">{t('reports.calculation.resultHeading')}</p>
      <ul>
        {(['DECISIVE', 'PARTIAL', 'REPELLED'] as const).map((result) => (
          <li key={result} {...(result === grade ? { 'data-this-fight': '' } : {})}>
            {t(
              pirate && result === 'DECISIVE'
                ? 'reports.calculation.resultDecisivePirate'
                : RESULT_EXPLANATION[result],
              {
                threshold: full(COMBAT.partialThreshold * 100),
                decisiveLoot: percent(balance.lootDecisive),
                partialLoot: percent(balance.lootPartial),
                decisiveBuffer: percent(balance.lootDecisive * balance.lootBufferShare),
                partialBuffer: percent(balance.lootPartial * balance.lootBufferShare),
              },
            )}
          </li>
        ))}
      </ul>
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
    <p data-testid="pirate-overrun" className="gk-report__note" data-tone="good">
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
    <section data-captured-hull={hull} className="gk-well gk-capture">
      <span className="gk-capture__art" aria-hidden="true">
        {art ? <img src={art} alt="" /> : <HullMark hull={hull} className="gk-capture__mark" />}
      </span>
      <div className="gk-capture__words">
        <p className="gk-report__copy" data-strong="" data-tone="good">{t('reports.pirateCaptured')}</p>
        <p className="gk-report__subhead">{hullLabel(hull)}</p>
        <p className="gk-report__copy">{t('reports.pirateCapturedNote')}</p>
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
    <section className="gk-well gk-aegis">
      <div className="gk-aegis__head">
        <span className="gk-aegis__art" data-down={after <= 0 ? '' : undefined}>
          <img
            src={instrumentArt('AEGIS', 1) ?? ''}
            alt={t('reports.aegis.aria')}
            width={56}
            height={56}
            loading="lazy"
          />
        </span>
        <div className="gk-aegis__words">
          <div className="gk-aegis__title">
            <p className="gk-report__subhead">
              {t(report.attacking ? 'reports.aegis.labelTheirs' : 'reports.aegis.labelYours')}
            </p>
            <span
              data-aegis-status={status}
              data-tone={status === 'broken' ? 'threat' : status === 'held' ? 'good' : 'neutral'}
              className="gk-aegis__status"
            >
              {t(`reports.aegis.${status}`)}
            </span>
          </div>
          <p className="gk-report__copy">
            {t(report.opponentKind ? 'starter.reports.aegisNote' : 'reports.aegis.note')}
          </p>
          {after <= 0 ? (
            <p data-aegis-outcome className="gk-report__copy" data-strong="" {...(defendersRemain ? { 'data-tone': 'warn' } : {})}>
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
      <div className="gk-aegis__span">
        <div>
          <p className="gk-report__label">{t('reports.aegis.before')}</p>
          <p className="gk-report__figure gk-num">{full(before)}</p>
        </div>
        <span className="gk-aegis__arrow" aria-hidden="true"><Glyph id="next" /></span>
        <div className="gk-aegis__after">
          <p className="gk-report__label">{t('reports.aegis.after')}</p>
          <p className="gk-report__figure gk-num" data-tone={after <= 0 ? 'threat' : 'crystal'}>{full(after)}</p>
        </div>
      </div>
      <div className="gk-aegis__meter">
        <span data-shield-remaining={remaining} style={{ width: `${String(remaining)}%` }} />
      </div>
      <p className="gk-report__label gk-num gk-aegis__absorbed">
        {t('reports.aegis.absorbed', { amount: full(report.shieldAbsorbed) })}
      </p>
    </section>
  );
}

function BattleRound({ report, round }: { report: OrdinaryReport; round: Round }) {
  const { t } = useTranslation();
  return (
    <section
      data-combat-round={round.round}
      className="gk-turn"
      aria-label={t('reports.calculation.round', { round: round.round })}
    >
      <h4 className="gk-report__subhead">
        {t('reports.calculation.round', { round: round.round })}
      </h4>
      <RoundBalance
        dealt={report.attacking ? round.attackerDamage : round.defenderDamage}
        took={report.attacking ? round.defenderDamage : round.attackerDamage}
      />
      {round.shieldAbsorbed > 0 ? (
        <p className="gk-report__copy" data-tone="crystal">
          {t('reports.roundShield', { amount: full(round.shieldAbsorbed) })}
        </p>
      ) : null}
      {round.attackerShipShieldAbsorbed !== undefined && round.defenderShipShieldAbsorbed !== undefined ? (
        <p data-round-ship-shields className="gk-report__copy" data-tone="crystal">
          {t('research.shipShieldRound', {
            your: full(report.attacking ? round.attackerShipShieldAbsorbed : round.defenderShipShieldAbsorbed),
            their: full(report.attacking ? round.defenderShipShieldAbsorbed : round.attackerShipShieldAbsorbed),
          })}
        </p>
      ) : null}
      <RoundCasualties
        yours={report.attacking ? round.attackerLosses : round.defenderLosses}
        theirs={report.attacking ? round.defenderLosses : round.attackerLosses}
      />
      <BattleRetreatNote fleet={round.yourRetreated} enemyCount={round.theirRetreatedCount} />
      <RoundStanding report={report} round={round} />
      {hasCalculationTelemetry(round) ? (
        <RulesRow glyph="target" title={t('reports.roundCalculationToggle')}>
          <RoundCalculation report={report} round={round} />
        </RulesRow>
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
    <div data-round-calculation className="gk-report__calc">
      <div className="gk-report__pair">
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
      <p className="gk-report__subhead">
        {t(
          report.pirate
            ? round.defenderShipShieldAbsorbed !== undefined
              ? 'research.shipShieldStage'
              : 'reports.calculation.openSpace'
            : before > 0
              ? 'reports.calculation.aegis'
              : 'reports.calculation.noAegis',
        )}
      </p>
      {report.pirate ? (
        <p className="gk-report__copy">
          {t(round.defenderShipShieldAbsorbed !== undefined ? 'research.shipShieldHullDamage' : 'reports.calculation.openSpaceNote', { amount: full(round.attackerHullDamage!) })}
        </p>
      ) : before > 0 ? (
        <div className="gk-report__pair">
          <div className="gk-well gk-report__cell">
            <p className="gk-report__label">{t('reports.calculation.shieldCharge')}</p>
            <p className="gk-report__value gk-num" data-tone="crystal">
              {full(before)} <span data-tone="quiet">→</span> {full(after)}
            </p>
            <p className="gk-report__label">
              {t('reports.calculation.absorbed', { amount: full(round.shieldAbsorbed) })}
            </p>
          </div>
          <div className="gk-well gk-report__cell">
            <p className="gk-report__label">{t('reports.calculation.reachedHulls')}</p>
            <p className="gk-report__value gk-num">{full(round.attackerHullDamage!)}</p>
            {round.shieldBreakerDamage > 0 ? (
              <p className="gk-report__label" data-tone="deut">
                {t('reports.calculation.shieldBreaker', { amount: full(round.shieldBreakerDamage) })}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="gk-report__copy">
          {t(round.defenderShipShieldAbsorbed !== undefined ? 'research.shipShieldHullDamage' : 'reports.calculation.noAegisNote', { amount: full(round.attackerHullDamage!) })}
        </p>
      )}
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
    <div className="gk-well gk-report__cell">
      <p className="gk-report__label">{label}</p>
      <p className="gk-report__value gk-num">{full(power)}</p>
      <p className="gk-report__label gk-num" data-tone={change >= 0 ? 'good' : 'threat'}>
        <span data-tone="quiet">{t('reports.calculation.shotChange')} </span>
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
    <div data-force-row={hull} className="gk-force">
      <HullName hull={hull} kind={t(
        HULLS[hull].ground ? 'reports.force.groundType'
          : HULLS[hull].atk === 0 ? 'reports.force.supportType' : 'reports.force.combatType',
      )} />
      <SurvivorBar
        compactRow sent={sent} lost={lost} rebuilt={rebuilt} side={side}
        sentLabel={t(side === 'theirs' ? 'reports.force.arrived' : attacking ? 'reports.verdict.sent' : 'reports.force.held')}
        leftLabel={t(side === 'yours' && attacking && !HULLS[hull].ground ? 'reports.verdict.returned' : 'reports.force.left')}
      />
    </div>
  );
}

/** A hull as the report names it: its picture (or the ground mark), its name, and what kind of unit it is. */
function HullName({ hull, kind }: { hull: HullId; kind?: string }) {
  return (
    <span className="gk-force__hull">
      {HULL_ART[hull] ? (
        <img src={HULL_ART[hull]} alt="" aria-hidden width={32} height={32} />
      ) : (
        <HullMark hull={hull} className="gk-force__mark" />
      )}
      <span className="gk-force__name">
        <span className="gk-report__subhead">{hullLabel(hull)}</span>
        {kind !== undefined && <span className="gk-report__label">{kind}</span>}
      </span>
    </span>
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
    <div className="gk-ledger gk-forces">
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
      <div className="gk-force" data-total="">
        <span className="gk-report__subhead">{t('reports.verdict.total')}</span>
        <SurvivorBar compactRow sent={brought} lost={lost} rebuilt={rebuilt}
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
  const line = (label: string, entries: ReturnType<typeof fleetEntries>, tone: 'threat' | 'plain') => (
    <div className="gk-report__casualties">
      <p className="gk-report__label">{label}</p>
      <div className="gk-hullchips">
        {entries.map(([hull, count]) => (
          <span key={hull} className="gk-hullchip" data-tone={tone}>
            {full(count)} {hullLabel(hull)}
          </span>
        ))}
        {entries.length === 0 ? <span className="gk-report__copy" data-tone="quiet">{t('reports.roundNoCasualties')}</span> : null}
      </div>
    </div>
  );

  return (
    <div data-round-losses className="gk-report__block gk-report__rule">
      {line(t('reports.roundLossesYours'), mine, 'threat')}
      {line(t('reports.roundLossesTheirs'), others, 'plain')}
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
  const enemy = !report.attacking || report.enemyFleetVisibility === 'FULL' ? forceAfterRound(report, round, true) : null;
  if (!standing && !enemy) return null;
  const noForce = standing?.combat === 0 && standing.support === 0;
  const supportExposed = standing?.combat === 0 && standing.support > 0;

  return (
    <div data-round-standing={round.round} className="gk-report__note" data-tone={noForce || supportExposed ? 'threat' : 'plain'}>
      <p className="gk-report__label" data-strong="">
        {t('reports.roundStanding.heading', { round: round.round })}
      </p>
      <p className="gk-report__copy">
        {standing ? t('reports.roundStanding.summary', {
          combat: full(standing.combat), support: full(standing.support),
        }) : t('reports.roundStanding.unknownOwn')}
      </p>
      {supportExposed ? (
        <p className="gk-report__copy" data-strong="" data-tone="threat">
          {t('reports.roundStanding.supportExposed')}
        </p>
      ) : noForce ? (
        <p className="gk-report__copy" data-strong="" data-tone="threat">
          {t('reports.roundStanding.noneLeft')}
        </p>
      ) : null}
      {enemy ? (
        <div data-enemy-round-standing className="gk-report__rule">
          <p className="gk-report__label" data-strong="">
            {t('reports.roundStanding.enemyHeading', { round: round.round })}
          </p>
          <p className="gk-report__copy">
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
  const escaped = report.rounds.filter(round => round.round <= depleted.round)
    .reduce((n, round) => n + unitCount(round.yourRetreated ?? {}), 0);
  return (
    <p data-combat-turning-point className="gk-report__copy" data-strong="">
      {t(escaped > 0 ? 'reports.turningPointRetreated' : standing.support > 0 ? 'reports.turningPointSupport' : 'reports.turningPointWiped', {
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
      <p className="gk-report__label">{label}</p>
      {clan ? (
        <p className="gk-report__copy" title={clan.name}>
          <span className="gk-clans__tag">[{clan.tag}]</span> {clan.name}
        </p>
      ) : (
        <p className="gk-report__copy" data-tone="quiet">{t('reports.noClan')}</p>
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
  const outcome = ordinaryBattleOutcome(report);
  const won = outcome === 'win';
  const title = verdictTitle(report);
  /* The tone is stated, not implied by a class: a loss is red (K2) whatever else was won. */
  const tone = outcome === 'partial' ? 'partial' : won ? 'good' : 'threat';

  return (
    <section
      data-battle-verdict={report.grade}
      data-tone={tone}
      className="gk-plate gk-report__verdict"
      aria-label={title}
    >
      <h3 className="gk-report__subhead">
        {t(rosterKnown ? 'reports.verdict.yourForce' : 'reports.verdict.yourLosses')}
      </h3>
      <div className="gk-report__metrics" data-cols={rosterKnown ? 3 : 1}>
        {rosterKnown ? (
          <BattleMetric
            label={t(report.attacking ? 'reports.verdict.sent' : 'reports.verdict.held')}
            value={starting}
          />
        ) : null}
        <BattleMetric label={t('reports.verdict.lost')} value={yours} tone="threat" />
        {rosterKnown ? (
          <BattleMetric
            label={t(report.attacking ? 'reports.verdict.returned' : 'reports.verdict.standing')}
            value={remaining}
            tone={remaining > 0 ? 'good' : 'threat'}
          />
        ) : null}
      </div>
      {rosterKnown ? (
        <SurvivorBar sent={starting} lost={yours} rebuilt={rebuilt} showFigures={false} />
      ) : (
        <p data-own-roster-unknown className="gk-report__copy" data-tone="warn">
          {t('reports.verdict.rosterUnknown')}
        </p>
      )}

      <div data-verdict-summary className="gk-report__summary" data-tone={tone}>
        <p className="gk-report__copy" data-strong="">
          {t(report.rounds.length === 0
            ? 'reports.verdict.walkoverSummary'
            : report.pirate && report.grade === 'PARTIAL'
              ? 'reports.verdict.piratePartialSummary'
              : `reports.verdict.summary.${report.attacking ? 'attacking' : 'defending'}.${report.grade}`)}
        </p>
        {report.attacking && rosterKnown ? (
          <p className="gk-report__copy" {...(remaining === 0 ? { 'data-tone': 'threat' } : {})}>
            {t(
              remaining === 0
                ? 'reports.verdict.noneReturned'
                : 'reports.verdict.someReturned',
              { count: remaining },
            )}
          </p>
        ) : null}
        {!report.attacking && rebuilt > 0 ? (
          <p className="gk-report__copy" data-tone="good">
            {t('reports.force.rebuiltNote', { count: full(rebuilt) })}
          </p>
        ) : null}
      </div>

      <dl data-verdict-payoff className="gk-report__payoff">
        <div>
          <dt className="gk-report__label">{t(report.attacking ? 'reports.verdict.loot' : 'reports.haulLost')}</dt>
          <dd className="gk-num">
            {full(Math.abs(report.lootAlloy + report.lootCrystal + report.lootDeuterium))}
          </dd>
        </div>
        {report.dominion !== null ? (
          <div>
            <dt className="gk-report__label">{t('reports.dominion')}</dt>
            <dd className="gk-num" data-tone={report.dominion < 0 ? 'threat' : 'plain'}>
              {signed(report.dominion)}
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="gk-report__tally">
        <div className="gk-report__tallyrow">
          <p className="gk-report__label">
            {t(report.attacking ? 'reports.verdict.enemyDestroyed' : 'reports.verdict.attackerDestroyed')}
          </p>
          <p className="gk-num" {...(theirs > 0 ? {} : { 'data-tone': 'quiet' })}>{full(theirs)}</p>
        </div>
        {report.attacking && report.grade !== 'DECISIVE' && report.enemyFleetVisibility !== 'FULL' ? (
          <p className="gk-report__copy" data-strong="" data-tone="warn">
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
    <span className="gk-roundbars">
      <span className="gk-roundbar" data-side="dealt">
        <span className="gk-report__copy">{t('reports.roundDealt')}</span>
        <span className="gk-roundbar__track"><span style={{ width: `${String((dealt / top) * 100)}%` }} /></span>
        <span className="gk-report__copy gk-num">{full(dealt)}</span>
      </span>
      <span className="gk-roundbar" data-side="took">
        <span className="gk-report__copy" data-tone="threat">{t('reports.roundTook')}</span>
        <span className="gk-roundbar__track"><span style={{ width: `${String((took / top) * 100)}%` }} /></span>
        <span className="gk-report__copy gk-num">{full(took)}</span>
      </span>
    </span>
  );
}

function BattleMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'threat' | 'good';
}) {
  return (
    <div className="gk-report__metric">
      <p className="gk-report__label">{label}</p>
      <p className="gk-report__figure gk-num" {...(tone ? { 'data-tone': tone } : {})}>{full(value)}</p>
    </div>
  );
}

function Losses({ fleet, tone, empty }: { fleet: OrdinaryReport['yourLosses']; tone: 'threat' | 'plain' | 'alloy'; empty: string }) {
  const entries = fleetEntries(fleet);
  if (entries.length === 0) {
    return <p className="gk-report__copy" data-tone="quiet">{empty}</p>;
  }

  return (
    <div className="gk-hullchips">
      {entries.map(([hull, count]) => (
        <div key={hull} className="gk-hullcard">
          {HULL_ART[hull] ? (
            <img src={HULL_ART[hull]} alt="" aria-hidden width={32} height={32} />
          ) : (
            <HullMark hull={hull} className="gk-force__mark" />
          )}
          <div>
            <p className="gk-report__value gk-num" data-tone={tone}>{full(count)}</p>
            <p className="gk-report__label">{hullLabel(hull)}</p>
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
  if (report.enemyFleetVisibility === 'FULL') return <BattleEnemyFleet fleet={report.theirFleet} losses={report.theirLosses} attacking={report.attacking} />;
  if (report.enemyFleetVisibility !== undefined) return <section data-their-board="floor" className="gk-report__block">
    <h3 className="gk-report__subhead">{t('reports.theirBoardFloor')}</h3>
    <BattleIntelNotice visibility={report.enemyFleetVisibility} />
    <Losses fleet={report.theirLosses} tone="plain" empty={t('reports.theirsEmpty')} />
  </section>;

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
  const complete = report.attacking && report.grade === 'DECISIVE' && (report.theirRetreatedCount ?? 0) === 0;
  const entries = fleetEntries(report.theirLosses);
  const emptyAtStart = complete && report.rounds.length === 0 && entries.length === 0;
  const ground = entries.filter(([hull]) => HULLS[hull].ground);
  const ships = entries.filter(([hull]) => !HULLS[hull].ground);

  const asFleet = (rows: [HullId, number][]): OrdinaryReport['theirLosses'] =>
    Object.fromEntries(rows);

  return (
    <section data-their-board={complete ? 'complete' : 'floor'} className="gk-report__block">
      <div className={complete ? 'gk-report__block' : 'gk-report__note gk-report__block'} {...(complete ? {} : { 'data-tone': 'warn' })}>
        <h3 className="gk-report__subhead">
          {emptyAtStart
            ? t('reports.theirBoardEmptyAtStart')
            : entries.length === 0 && !complete
            ? t('reports.theirBoardNothing')
            : t(complete ? 'reports.theirBoardComplete' : 'reports.theirBoardFloor')}
        </h3>
        <p className="gk-report__copy" {...(complete ? {} : { 'data-tone': 'warn' })}>
          {t(emptyAtStart ? 'reports.theirBoardEmptyAtStartNote'
            : complete ? 'reports.theirBoardCompleteNote'
            : report.attacking ? 'reports.theirBoardFloorNote' : 'reports.theirBoardMissingRosterNote')}
        </p>
      </div>

      {ships.length > 0 && (
        <>
          <p className="gk-report__label" data-tone="crystal">{t('reports.shipsHeading')}</p>
          <Losses fleet={asFleet(ships)} tone="plain" empty={t('reports.theirsEmpty')} />
        </>
      )}

      {ground.length > 0 ? (
        <div data-ground-group className="gk-report__block">
          <p className="gk-report__label" data-tone="alloy">{t('reports.groundHeading')}</p>
          <p className="gk-report__copy">
            {t('reports.groundNote', { percent: full(COMBAT.defenceSalvage * 100) })}
          </p>
          <Losses fleet={asFleet(ground)} tone="alloy" empty={t('reports.theirsEmpty')} />
        </div>
      ) : complete && !emptyAtStart ? (
        /* Only a DECISIVE proves a negative. See the docblock. */
        <div data-no-ground className="gk-report__note" data-tone="plain">
          <p className="gk-report__label" data-strong="">{t('reports.noGroundHeading')}</p>
          <p className="gk-report__copy" data-tone="quiet">{t('reports.noGroundNote')}</p>
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
    <section data-their-board="arrived" className="gk-report__block">
      <h3 className="gk-report__subhead">{t('reports.theirBoardArrived')}</h3>
      <p className="gk-report__copy">
        {t('reports.theirBoardArrivedNote')}
      </p>
      <div className="gk-ledger gk-forces" data-side="theirs">
        {entries.map(([hull, count]) => (
          <ForceRow
            key={hull}
            hull={hull}
            sent={count}
            lost={report.theirLosses[hull] ?? 0}
            side="theirs"
          />
        ))}
        <div className="gk-force" data-total="">
          <span className="gk-report__subhead">{t('reports.verdict.total')}</span>
          <SurvivorBar compactRow sent={arrived} lost={destroyed} side="theirs" sentLabel={t('reports.force.arrived')} />
        </div>
      </div>
    </section>
  );
}
