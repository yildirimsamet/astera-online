import { BattleRetreatNote } from '../../ui/BattleRetreatNote.js';
import { ordinaryBattleOutcome } from '../../lib/battleOutcome.js';
import { useTranslation } from 'react-i18next';
import { COMBAT, FAULT, HULLS, fleetCount, vesselHull } from '@astera/rules';
import type { BattleReport } from '../../api/schemas.js';
import { GameButton, Glyph } from '../../game-ui/index.js';
import { combatClassLabel, hullLabel } from '../../i18n/names.js';
import { serverNow } from '../../lib/clock.js';
import { compact } from '../../lib/format.js';
import { lossReason, sentAndLeft, type SideRow } from '../../lib/reportScene.js';
import { damagePct } from '../../lib/repairStation.js';
import { dayClock } from '../../lib/time.js';
import { rivalColour } from '../../galaxy/PlanetField.js';
import { RESOURCE_ART, planetArt } from '../../ui/assets.js';
import type { OutpostLine } from '../../starter/outpostReport.js';
import { heroArt } from '../../starter/shipScreen.js';
import { ClassEmblem } from '../kit/ClassEmblem.js';
import { HonorBattleSummary } from '../../ui/HonorBattleSummary.js';
import { SurvivorBar } from '../../ui/SurvivorBar.js';

export interface ReportSceneProps {
  report: BattleReport;
  /**
   * The verdict word, off the sheet's own ladder (wiped fleets, walkovers and all). Left out
   * where the surface around the scene already heads itself with it (the report sheet's title,
   * which is also its accessible name); a dot in the verdict's colour stands in for it.
   */
  word?: string;
  /** The world on the other side is a colony — the galaxy's reading — so the loyalty rule applies. */
  colonyTarget?: boolean;
  /** Which of the reader's marks the other side wears (D183), for their name's colour. */
  rivalSlot?: number | null;
  /** Back to the target's dossier (E6). Offered to the attacker only. */
  onAttackAgain?: () => void;
  /** The round-by-round, further down the sheet (the mock's "İzle"). Only where rounds were fought. */
  onWatch?: () => void;
  /** Tell the clan: a line for the clan chat, which the reader sends themselves (the mock's "Klana"). */
  onShare?: (line: string) => void;
  /** Aboard, what a raid from the ship taught (`outpostReportLines`): read where the why is read. */
  told?: readonly OutpostLine[];
}

/** Why the raid was graded so, from the rule that grades it (player test C-03). */
const VERDICT = {
  DECISIVE: 'reportScene.verdictDecisive',
  PARTIAL: 'reportScene.verdictPartial',
  REPELLED: 'reportScene.verdictRepelled',
} as const;

/** The question the word raises (the mock's "Neden kısmi?"); a clean win's losses have their own. */
const WHY_HEADING = {
  DECISIVE: 'reportScene.whyDecisive',
  PARTIAL: 'reportScene.whyPartial',
  REPELLED: 'reportScene.whyRepelled',
} as const;

/** A figure signed from the reader's side: "+3.1k" or "−3.1k". */
const signed = (value: number): string => `${value < 0 ? '−' : '+'}${compact(Math.abs(value))}`;

/** One side's column: a header figure and a row per hull. */
function Side({
  side,
  title,
  colour,
  figure,
  rows,
  onlyLosses,
  note,
}: {
  side: 'yours' | 'theirs';
  title: string;
  /** Their mark's colour, when the reader marked them (D183). */
  colour?: string;
  figure: string;
  rows: readonly SideRow[];
  /** Rule 15: the attacker's copy of the other side lists only what was destroyed. */
  onlyLosses: boolean;
  note?: string;
}) {
  return (
    <div data-side={side} className="gk-debrief__side">
      <p className="gk-debrief__sidehead">
        <span className="gk-debrief__sidename" {...(colour ? { style: { color: colour } } : {})}>{title}</span>
        <span className="gk-num">{figure}</span>
      </p>
      {rows.map((row) => (
        <div key={row.hull} className="gk-debrief__row">
          <p className="gk-debrief__hull">
            <ClassEmblem cls={HULLS[row.hull].cls} className="gk-debrief__emblem" decorative />
            <span className="gk-debrief__hullname">{hullLabel(row.hull)}</span>
            {!onlyLosses && <span className="gk-num">{row.sent}</span>}
            {/* Your dead are a loss; theirs are your fire landing — the bar below says the same. */}
            {row.lost > 0 && <span className="gk-num" data-tone={side === 'yours' ? 'threat' : 'good'}>−{row.lost}</span>}
          </p>
          {!onlyLosses && <SurvivorBar compactRow showFigures={false} sent={row.sent} lost={row.lost} side={side} />}
        </div>
      ))}
      {note && <p className="gk-report__label">{note}</p>}
    </div>
  );
}

/**
 * Where it happened. Aboard (player test I-04), a fight at a ship shows that ship, drawn unread as the
 * galaxy draws one; an outpost and the main game keep the world's picture.
 */
function heroSrc(report: BattleReport): string {
  const ship = report.opponentKind === undefined ? null
    : report.attacking ? (report.opponentKind === 'SHIP' ? report.opponentPlanetId : null) : report.yourPlanetId;
  return ship ? heroArt(vesselHull(ship), 'WRECKED') : planetArt(report.opponentPlanetId ?? report.opponentPlanet);
}

/**
 * THE REPORT SCENE. Spec B15 · E6 (docs/ui-v2/gozlemevi.md), the mock's "KISMİ ZAFER"; on the
 * game kit since C16a (2026-11-15).
 *
 * The outcome is staged, not written up: the reader's world, the word — large, beside the
 * world it happened at — when, how long and against whom; the haul; both sides at a
 * glance — the reader's own as sent → left, the other side as only what the reader
 * destroyed when full intelligence is unavailable; eligible attackers and defenders
 * read the opposing starting force whole — the question the word raises, answered in one
 * sentence off the class data; the balance: loot, fuel (S4), loss; what the fight added
 * to the dossier (a report is new intel); and the three doors: watch the rounds, tell the
 * clan, raid again. The detailed sections of the sheet follow, and the far world's door is
 * the sheet's route a few lines down.
 */
export function ReportScene({
  report,
  word,
  colonyTarget = false,
  rivalSlot = null,
  onAttackAgain,
  onWatch,
  onShare,
  told = [],
}: ReportSceneProps) {
  const { t } = useTranslation();
  const yours = sentAndLeft(report.yourFleet, report.yourLosses);
  const enemyRosterKnown = report.enemyFleetVisibility === 'FULL'
    || (report.enemyFleetVisibility === undefined && !report.attacking && fleetCount(report.theirFleet) > 0);
  const theirs = enemyRosterKnown
    ? sentAndLeft(report.theirFleet, report.theirLosses)
    : sentAndLeft(report.theirLosses, report.theirLosses);
  const sum = (rows: readonly SideRow[], key: 'sent' | 'left' | 'lost') => rows.reduce((n, row) => n + row[key], 0);
  const reason = lossReason(report.yourLosses);
  const looted = report.lootAlloy + report.lootCrystal + report.lootDeuterium;
  const lost = yours.filter((row) => row.lost > 0).map((row) => `${String(row.lost)} ${hullLabel(row.hull)}`);
  const outcome = ordinaryBattleOutcome(report);
  // The word's colour is stated, and the kit paints it.
  const tone = outcome === 'loss' ? 'threat' : outcome === 'partial' ? 'partial' : outcome === 'win' ? 'good' : 'plain';
  /* The mock's "Bugün 21:40": today and yesterday by their word, anything older by its date. */
  const time = dayClock(report.at, serverNow());
  const hour = new Intl.DateTimeFormat(t('units.numberLocale'), { timeStyle: 'short' }).format(report.at);
  /*
    WHAT THE FIGHT ADDED TO THE DOSSIER. The attacker's copy of a fight is what the dossier
    reads their board from (`fieldedAtLeast`: what was destroyed is at least what was
    fielded), so it is new intel only where something of theirs was met; on a colony, the
    loyalty rule applied to this grade — never the loyalty itself, which is theirs.
  */
  const met = sum(theirs, 'lost') > 0;
  const loyalty = colonyTarget && report.attacking ? FAULT.battleLoyaltyLoss[report.grade] : 0;
  const intel = report.attacking && report.opponentPlanet !== '' && (met || loyalty > 0)
    ? [
      ...(met ? [t('reportScene.intel', { planet: report.opponentPlanet, time: hour })] : []),
      ...(loyalty > 0 ? [t('reportScene.loyalty', { amount: loyalty })] : []),
    ].join(' · ')
    : null;
  const share = onShare
    ? () => {
      onShare(t('reportScene.shareLine', {
        word: word ?? '',
        planet: report.opponentPlanet || report.yourPlanet,
        loot: signed(looted),
        lost: lost.length > 0 ? lost.join(', ') : t('reportScene.balanceNone'),
      }).trim());
    }
    : null;

  /** The three doors: the rounds (only where some were fought), the clan, the raid again. */
  const watchable = onWatch !== undefined && report.rounds.length > 0;
  const again = report.attacking && onAttackAgain !== undefined;
  /*
    WHO THE OTHER SIDE WAS, AS A NAME. A pirate is named from the locale files (D150), as the
    list names it — the payload's `opponentName` is the server's English fallback — and a
    neutral world has no commander to name, only its garrison.
  */
  const opponent = report.pirate ? t('pirate.name', { level: report.pirate.level, callsign: report.pirate.callsign })
    : report.opponentKind === 'PIRATES' ? t('starter.reports.piratesName')
    : report.neutral ? t('reportScene.neutralSide') : report.opponentName;

  return (
    <section data-report-scene className="gk-debrief">
      {/*
        THE MOCK'S HERO: the world it happened at, large and cut by the sheet's edge, and the
        word beside it. The art is decoration — the world is named in the line under the word —
        and the words keep to the left of it, where nothing bright stands behind them.
      */}
      <div data-report-hero className="gk-debrief__hero">
        <img src={heroSrc(report)} alt="" aria-hidden className="gk-debrief__art" />
        <div className="gk-debrief__head">
          <p className="gk-debrief__eyebrow">
            {word === undefined && <span aria-hidden="true" className="gk-debrief__dot" data-tone={tone} />}
            {t('reportScene.eyebrow', { planet: report.supportedAt?.planetName ?? report.yourPlanet })}
          </p>
          {word !== undefined && <h2 data-report-word className="gk-debrief__word" data-tone={tone}>{word}</h2>}
        </div>
        {/* The word's reason and its price, at its side rather than far below (player test C-03, I-03). */}
        {report.attacking && (
          <p data-report-verdict className="gk-debrief__verdict">
            {t(VERDICT[report.grade], { share: Math.round(COMBAT.partialThreshold * 100) })}
            {lost.length > 0 && (
              <>{' '}<span data-report-verdict-lost className="gk-debrief__lost">{t('reportScene.balanceLost', { list: lost.join(', ') })}</span></>
            )}
          </p>
        )}
        <p className="gk-debrief__meta">
          <span>
            {[
              time,
              // A walkover had no rounds, and "0 rounds" reads as a fault rather than a fact.
              ...(report.rounds.length > 0 ? [t('reportScene.rounds', { count: report.rounds.length })] : []),
            ].join(' · ')}
          </span>
          <span
            data-report-opponent
            {...(rivalSlot === null ? {} : { 'data-rival': String(rivalSlot), style: { color: rivalColour(rivalSlot), borderColor: rivalColour(rivalSlot) } })}
            className="gk-debrief__rival"
          >
            {opponent}
          </span>
          {report.opponentPlanet !== '' && <span className="gk-debrief__planet">{report.opponentPlanet}</span>}
        </p>
      </div>

      <HonorBattleSummary receipt={report.honor} dominion={report.dominion} />
      <div data-report-loot className="gk-well gk-debrief__loot">
        {/* The haul in the report's own materials: the same row the sheet's ledger draws below. */}
        <p className="gk-haul__row gk-num">
          {([['alloy', report.lootAlloy], ['crystal', report.lootCrystal], ['deuterium', report.lootDeuterium]] as const).map(([resource, value]) => (
            <span key={resource} className="gk-haul__res" data-res={resource}>
              <img src={RESOURCE_ART[resource]} alt="" aria-hidden />
              {signed(value)}
            </span>
          ))}
        </p>
        {report.cargoLimited && <span className="gk-debrief__full">{t('reportScene.cargoFull')}</span>}
      </div>

      <div data-report-forces className="gk-debrief__forces">
        <Side
          side="yours"
          title={t('reportScene.you')}
          figure={`${String(sum(yours, 'sent'))} → ${String(sum(yours, 'left'))}`}
          rows={yours}
          onlyLosses={false}
        />
        <Side
          side="theirs"
          title={opponent}
          {...(rivalSlot === null ? {} : { colour: rivalColour(rivalSlot) })}
          figure={enemyRosterKnown
            ? `${String(sum(theirs, 'sent'))} → ${String(sum(theirs, 'left'))}`
            : t('reportScene.destroyed', { count: sum(theirs, 'lost') })}
          rows={theirs}
          onlyLosses={!enemyRosterKnown}
          {...(!enemyRosterKnown ? { note: t(report.enemyFleetVisibility === 'UNKNOWN' ? 'reports.enemyFleetUnknown' : 'reportScene.hidden') } : {})}
        />
      </div>

      <BattleRetreatNote fleet={report.yourRetreated} enemyCount={report.theirRetreatedCount} />
      {report.yourDamage.length > 0 && (
        <div data-report-damage className="gk-well gk-report__why">
          <p className="gk-report__subhead">{t('reportScene.damageTitle')}</p>
          <ul className="gk-debrief__damage">
            {report.yourDamage.map((lot) => (
              <li key={`${lot.hull}:${String(lot.damageBp)}:${String(lot.remainderBp ?? 0)}`}>
                <span className="gk-report__copy">
                  {/* Round the remainder first so even subnormal HP wounds stay visible. */}
                  {t('reportScene.damageLot', { name: hullLabel(lot.hull), count: lot.count, pct: damagePct(lot.damageBp + Math.ceil(lot.remainderBp ?? 0)) })}
                </span>
                {/* A defender's were judged at the fight; a raider's wait for the landing. */}
                {!report.attacking && <span className="gk-debrief__dock">{t('repairStation.maintenance.hangar')}</span>}
              </li>
            ))}
          </ul>
          {report.attacking && <p className="gk-report__label">{t(report.opponentKind ? 'starter.reports.landing' : 'reportScene.landing')}</p>}
        </div>
      )}

      {(reason !== null || told.length > 0) && (
        <div data-report-why className="gk-well gk-report__why">
          <p className="gk-report__subhead">{t(told.length > 0 && report.grade === 'DECISIVE' ? 'starter.reports.whyWon' : WHY_HEADING[report.grade])}</p>
          {told.map(line => <p key={line.key} data-told={line.key} data-tone={line.tone} className="gk-report__copy">{line.text}</p>)}
          {/* The ship's own why names the matchup itself; the losses' cycle would say it twice. */}
          {reason && !told.some(line => line.key === 'why') && (
            <p className="gk-report__copy">
              {t('reportScene.why', {
                lost: combatClassLabel(reason.lost),
                by: combatClassLabel(reason.by),
                bring: combatClassLabel(reason.bring),
              })}
            </p>
          )}
        </div>
      )}

      <p data-report-balance className="gk-report__copy">
        <strong className="gk-debrief__strong">{t('reportScene.balance')}: </strong>
        {[
          t('reportScene.balanceLoot', { amount: signed(looted) }),
          ...(report.fuelPaid ? [t('reportScene.balanceFuel', { amount: compact(report.fuelPaid) })] : []),
          lost.length > 0 ? t('reportScene.balanceLost', { list: lost.join(', ') }) : t('reportScene.balanceNone'),
        ].join(' · ')}
      </p>

      {intel !== null && (
        <p data-report-intel className="gk-debrief__intel">
          <Glyph id="eye" />
          <span>{intel}</span>
        </p>
      )}

      {(watchable || share !== null || again) && (
        <div className="gk-debrief__doors">
          {watchable && (
            <GameButton size="sm" glyph="down" onPress={onWatch}>
              {t(report.replayStatus === 'AVAILABLE' ? 'reports.howItWent' : 'reportScene.watch')}
            </GameButton>
          )}
          {share && <GameButton size="sm" glyph="share" onPress={share}>{t('reportScene.share')}</GameButton>}
          {again && (
            <GameButton tone="action" glyph="attack" wide onPress={onAttackAgain}>{t('reportScene.again')}</GameButton>
          )}
        </div>
      )}
    </section>
  );
}
