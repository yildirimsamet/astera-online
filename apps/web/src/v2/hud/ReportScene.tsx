import { useTranslation } from 'react-i18next';
import { FAULT, HULLS } from '@astera/rules';
import type { BattleReport } from '../../api/schemas.js';
import { combatClassLabel, hullLabel } from '../../i18n/names.js';
import { compact } from '../../lib/format.js';
import { lossReason, sentAndLeft, type SideRow } from '../../lib/reportScene.js';
import { rivalColour } from '../../galaxy/PlanetField.js';
import { RESOURCE_ART, planetArt } from '../../ui/assets.js';
import { Icon } from '../icons.js';
import { ClassEmblem } from '../kit/ClassEmblem.js';

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
}

/** The question the word raises (the mock's "Neden kısmi?"); a clean win's losses have their own. */
const WHY_HEADING = {
  DECISIVE: 'reportScene.whyDecisive',
  PARTIAL: 'reportScene.whyPartial',
  REPELLED: 'reportScene.whyRepelled',
} as const;

const GHOST = 'flex min-h-10 items-center justify-center gap-1.5 rounded-control border border-v2-line-hi px-3 text-caption font-semibold text-v2-ink';

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
    <div data-side={side} className="flex min-w-0 flex-col gap-1.5">
      <p className="flex items-baseline justify-between gap-2">
        <span
          className={`truncate text-caption font-semibold ${side === 'yours' ? 'text-v2-self' : 'text-v2-ink'}`}
          {...(colour ? { style: { color: colour } } : {})}
        >
          {title}
        </span>
        <span className="shrink-0 font-v2-mono text-micro text-v2-ink-3">{figure}</span>
      </p>
      {rows.map((row) => (
        <div key={row.hull} className="grid gap-0.5">
          <p className="flex items-center gap-1 text-micro">
            <ClassEmblem cls={HULLS[row.hull].cls} className="size-2.5 shrink-0 text-v2-ink-2" decorative />
            <span className="min-w-0 flex-1 truncate text-v2-ink">{hullLabel(row.hull)}</span>
            {!onlyLosses && <span className="font-v2-mono text-v2-ink">{row.sent}</span>}
            {row.lost > 0 && <span className="font-v2-mono text-v2-hostile">−{row.lost}</span>}
          </p>
          {!onlyLosses && (
            <span aria-hidden="true" className="flex h-1 overflow-hidden rounded-full bg-v2-line">
              {/* What is left of yours is your colour; of theirs, still a threat to you. */}
              <span className={`h-full ${side === 'yours' ? 'bg-v2-self' : 'bg-v2-hostile/60'}`} style={{ width: `${String((row.left / row.sent) * 100)}%` }} />
              <span className={`v2-hatch h-full ${side === 'yours' ? 'bg-v2-hostile/40' : 'bg-v2-self/40'}`} style={{ width: `${String((row.lost / row.sent) * 100)}%` }} />
            </span>
          )}
        </div>
      ))}
      {note && <p className="text-micro leading-snug text-v2-ink-3">{note}</p>}
    </div>
  );
}

/**
 * THE REPORT SCENE. Spec B15 · E6 (docs/ui-v2/gozlemevi.md), the mock's "KISMİ ZAFER".
 *
 * The outcome is staged, not written up: the reader's world, the word — large, over the
 * world it happened at — when, how long and against whom; the haul; both sides at a
 * glance — the reader's own as sent → left, the other side as only what the reader
 * destroyed (rule 15: the remaining force is never given; the defender, who was flown
 * at, reads the attacking force whole) — the question the word raises, answered in one
 * sentence off the class data; the balance: loot, fuel (S4), loss; what the fight added
 * to the dossier (a report is new intel); and the three doors: watch the rounds, tell the
 * clan, raid again. The detailed sections of the sheet follow.
 */
export function ReportScene({
  report,
  word,
  colonyTarget = false,
  rivalSlot = null,
  onAttackAgain,
  onWatch,
  onShare,
}: ReportSceneProps) {
  const { t } = useTranslation();
  const yours = sentAndLeft(report.yourFleet, report.yourLosses);
  const theirs = report.attacking
    ? sentAndLeft(report.theirLosses, report.theirLosses)
    : sentAndLeft(report.theirFleet, report.theirLosses);
  const sum = (rows: readonly SideRow[], key: 'sent' | 'left' | 'lost') => rows.reduce((n, row) => n + row[key], 0);
  const reason = lossReason(report.yourLosses);
  const looted = report.lootAlloy + report.lootCrystal + report.lootDeuterium;
  const lost = yours.filter((row) => row.lost > 0).map((row) => `${String(row.lost)} ${hullLabel(row.hull)}`);
  /* A win that cost every ship sent is a loss to the reader — red, as the sheet's verdict (K2). */
  const wiped = report.attacking && sum(yours, 'sent') > 0 && sum(yours, 'left') === 0;
  const tone = wiped
    ? 'text-v2-hostile'
    : report.attacking
      ? report.grade === 'REPELLED' ? 'text-v2-ink-2' : 'text-v2-self'
      : report.grade === 'REPELLED' ? 'text-v2-self' : 'text-v2-hostile';
  const time = new Intl.DateTimeFormat(t('units.numberLocale'), { dateStyle: 'medium', timeStyle: 'short' }).format(report.at);
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

  return (
    <section data-report-scene className="flex flex-col gap-3 font-v2-ui">
      {/*
        THE MOCK'S HERO: the world it happened at, large and cut by the sheet's edge, and the
        word over it. The art is decoration — the world is named in the line under the word.
      */}
      <div data-report-hero className="relative -mx-3 -mt-1 overflow-hidden px-3 pb-1 pt-14">
        <img
          src={planetArt(report.opponentPlanetId ?? report.opponentPlanet)}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-14 -top-12 size-52 rounded-full object-cover opacity-90 [mask-image:radial-gradient(circle_at_40%_60%,black_55%,transparent_75%)]"
        />
        <div className="relative flex min-w-0 flex-col gap-0.5">
          <p className="flex items-center gap-1.5 truncate text-micro text-v2-ink-2">
            {word === undefined && <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full bg-current ${tone}`} />}
            {t('reportScene.eyebrow', { planet: report.yourPlanet })}
          </p>
          {word !== undefined && (
            <h2
              data-report-word
              className={`text-readout font-extrabold uppercase leading-none tracking-tight [text-shadow:0_2px_18px_color-mix(in_srgb,var(--color-v2-void)_70%,transparent)] ${tone}`}
            >
              {word}
            </h2>
          )}
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-caption text-v2-ink-2">
            <span className="shrink-0">
              {[
                time,
                // A walkover had no rounds, and "0 rounds" reads as a fault rather than a fact.
                ...(report.rounds.length > 0 ? [t('reportScene.rounds', { count: report.rounds.length })] : []),
              ].join(' · ')}
            </span>
            <span aria-hidden>·</span>
            <span
              data-report-opponent
              {...(rivalSlot === null ? {} : { 'data-rival': String(rivalSlot) })}
              className="max-w-[7rem] shrink-0 truncate rounded-chip border border-v2-line px-1 text-micro font-semibold text-v2-ink-2"
              {...(rivalSlot === null ? {} : { style: { color: rivalColour(rivalSlot), borderColor: rivalColour(rivalSlot) } })}
            >
              {report.opponentName}
            </span>
            {report.opponentPlanet !== '' && <span className="min-w-0 truncate font-semibold text-v2-ink">{report.opponentPlanet}</span>}
          </p>
        </div>
      </div>

      <div data-report-loot className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control border border-v2-line bg-v2-panel px-3 py-2">
        {([['alloy', report.lootAlloy], ['crystal', report.lootCrystal], ['deuterium', report.lootDeuterium]] as const).map(([resource, value]) => (
          <span key={resource} className="flex items-center gap-1 font-v2-mono text-caption font-semibold text-v2-ink">
            <img src={RESOURCE_ART[resource]} alt="" aria-hidden className="size-3.5 object-contain" />
            {signed(value)}
          </span>
        ))}
        {report.cargoLimited && <span className="ml-auto text-micro text-v2-warn">{t('reportScene.cargoFull')}</span>}
      </div>

      <div data-report-forces className="grid grid-cols-2 gap-3">
        <Side
          side="yours"
          title={t('reportScene.you')}
          figure={`${String(sum(yours, 'sent'))} → ${String(sum(yours, 'left'))}`}
          rows={yours}
          onlyLosses={false}
        />
        <Side
          side="theirs"
          title={report.opponentName}
          {...(rivalSlot === null ? {} : { colour: rivalColour(rivalSlot) })}
          figure={report.attacking
            ? t('reportScene.destroyed', { count: sum(theirs, 'lost') })
            : `${String(sum(theirs, 'sent'))} → ${String(sum(theirs, 'left'))}`}
          rows={theirs}
          onlyLosses={report.attacking}
          {...(report.attacking ? { note: t('reportScene.hidden') } : {})}
        />
      </div>

      {reason && (
        <div data-report-why className="rounded-control border border-v2-line bg-v2-panel px-3 py-2">
          <p className="text-caption font-semibold text-v2-ink">{t(WHY_HEADING[report.grade])}</p>
          <p className="mt-0.5 text-caption leading-snug text-v2-ink-2">
            {t('reportScene.why', {
              lost: combatClassLabel(reason.lost),
              by: combatClassLabel(reason.by),
              bring: combatClassLabel(reason.bring),
            })}
          </p>
        </div>
      )}

      <p data-report-balance className="text-caption leading-snug text-v2-ink-2">
        <span className="font-semibold text-v2-ink">{t('reportScene.balance')}: </span>
        {[
          t('reportScene.balanceLoot', { amount: signed(looted) }),
          ...(report.fuelPaid ? [t('reportScene.balanceFuel', { amount: compact(report.fuelPaid) })] : []),
          lost.length > 0 ? t('reportScene.balanceLost', { list: lost.join(', ') }) : t('reportScene.balanceNone'),
        ].join(' · ')}
      </p>

      {intel !== null && (
        <p data-report-intel className="flex items-start gap-1.5 text-caption leading-snug text-v2-self">
          <Icon id="i-intel" className="mt-0.5 size-3.5 shrink-0" />
          {intel}
        </p>
      )}

      {(watchable || share !== null || again) && (
        <div className="flex gap-2">
          {watchable && (
            <button type="button" onClick={onWatch} className={GHOST}>
              <Icon id="i-play" className="size-3.5" />
              {t('reportScene.watch')}
            </button>
          )}
          {share && (
            <button type="button" onClick={share} className={GHOST}>
              <Icon id="i-share" className="size-3.5" />
              {t('reportScene.share')}
            </button>
          )}
          {again && (
            <button
              type="button"
              data-primary
              onClick={onAttackAgain}
              className="flex min-h-10 flex-1 items-center justify-center rounded-control bg-v2-self px-3 text-caption font-semibold text-v2-self-ink"
            >
              {t('reportScene.again')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
