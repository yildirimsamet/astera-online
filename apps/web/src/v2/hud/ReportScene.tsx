import { useTranslation } from 'react-i18next';
import { FAULT, HULLS } from '@astera/rules';
import type { BattleReport } from '../../api/schemas.js';
import { combatClassLabel, hullLabel } from '../../i18n/names.js';
import { compact } from '../../lib/format.js';
import { lossReason, sentAndLeft, type SideRow } from '../../lib/reportScene.js';
import { RESOURCE_ART, planetArt } from '../../ui/assets.js';
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
  /** Back to the target's dossier (E6). Offered to the attacker only. */
  onAttackAgain?: () => void;
}

const HEADING = 'text-micro font-semibold uppercase tracking-wide text-v2-ink-3';

/** A figure signed from the reader's side: "+3.1k" or "−3.1k". */
const signed = (value: number): string => `${value < 0 ? '−' : '+'}${compact(Math.abs(value))}`;

/** One side's column: a header figure and a row per hull. */
function Side({
  side,
  title,
  figure,
  rows,
  onlyLosses,
  note,
}: {
  side: 'yours' | 'theirs';
  title: string;
  figure: string;
  rows: readonly SideRow[];
  /** Rule 15: the attacker's copy of the other side lists only what was destroyed. */
  onlyLosses: boolean;
  note?: string;
}) {
  return (
    <div data-side={side} className="flex min-w-0 flex-col gap-1.5">
      <p className="flex items-baseline justify-between gap-2">
        <span className={`truncate text-caption font-semibold ${side === 'yours' ? 'text-v2-self' : 'text-v2-ink'}`}>{title}</span>
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
 * The outcome is staged, not written up: the word, the world it happened at, the haul,
 * both sides at a glance — the reader's own as sent → left, the other side as only what
 * the reader destroyed (rule 15: the remaining force is never given; the defender, who
 * was flown at, reads the attacking force whole) — one sentence of why off the class
 * data, and the balance: loot, fuel (S4), loss. The detailed sections of the sheet follow.
 */
export function ReportScene({ report, word, colonyTarget = false, onAttackAgain }: ReportSceneProps) {
  const { t } = useTranslation();
  const yours = sentAndLeft(report.yourFleet, report.yourLosses);
  const theirs = report.attacking
    ? sentAndLeft(report.theirLosses, report.theirLosses)
    : sentAndLeft(report.theirFleet, report.theirLosses);
  const sum = (rows: readonly SideRow[], key: 'sent' | 'left' | 'lost') => rows.reduce((n, row) => n + row[key], 0);
  const reason = lossReason(report.yourLosses);
  const looted = report.lootAlloy + report.lootCrystal + report.lootDeuterium;
  const lost = yours.filter((row) => row.lost > 0).map((row) => `${String(row.lost)} ${hullLabel(row.hull)}`);
  const world = report.attacking ? report.opponentPlanet : report.yourPlanet;
  const tone = report.attacking
    ? report.grade === 'REPELLED' ? 'text-v2-ink-2' : 'text-v2-self'
    : report.grade === 'REPELLED' ? 'text-v2-self' : 'text-v2-hostile';
  const time = new Intl.DateTimeFormat(t('units.numberLocale'), { dateStyle: 'medium', timeStyle: 'short' }).format(report.at);

  return (
    <section data-report-scene className="flex flex-col gap-3 font-v2-ui">
      <div className="flex items-center gap-3">
        <img
          src={planetArt(report.opponentPlanetId ?? world)}
          alt=""
          aria-hidden
          className="size-14 shrink-0 rounded-full object-cover shadow-[0_0_24px_color-mix(in_srgb,var(--color-v2-self)_15%,transparent)]"
        />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-micro uppercase tracking-wide text-v2-ink-3">
            {word === undefined && <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full bg-current ${tone}`} />}
            {t('reportScene.eyebrow', { planet: world })}
          </p>
          {word !== undefined && (
            <h2 data-report-word className={`text-figure font-bold uppercase leading-tight tracking-tight ${tone}`}>{word}</h2>
          )}
          <p className="truncate text-micro text-v2-ink-3">
            {[
              time,
              // A walkover had no rounds, and "0 rounds" reads as a fault rather than a fact.
              ...(report.rounds.length > 0 ? [t('reportScene.rounds', { count: report.rounds.length })] : []),
              report.opponentName,
            ].join(' · ')}
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
          <p className={HEADING}>{t('reportScene.whyHeading')}</p>
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

      {colonyTarget && (
        <p data-report-colony className="text-caption leading-snug text-v2-ink-2">
          {t('reportScene.colonyRule', { decisive: FAULT.battleLoyaltyLoss.DECISIVE, partial: FAULT.battleLoyaltyLoss.PARTIAL })}
        </p>
      )}

      {report.attacking && onAttackAgain && (
        <button
          type="button"
          data-primary
          onClick={onAttackAgain}
          className="flex min-h-10 items-center justify-center rounded-control bg-v2-self px-3 text-caption font-semibold text-v2-self-ink"
        >
          {t('reportScene.again')}
        </button>
      )}
    </section>
  );
}
