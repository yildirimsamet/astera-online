import { fleetCount, fleetEntries, type Fleet } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import type { MonumentBattleReport } from '../api/schemas.js';
import { hullLabel, monumentName } from '../i18n/names.js';
import { decimal, signed } from '../lib/format.js';
import { dayClock } from '../lib/time.js';
import { serverNow } from '../lib/clock.js';
import { Sheet } from '../v2/kit/Sheet.js';

export function MonumentReportSheet({ report, onClose, onFocusMonument }: {
  report: MonumentBattleReport; onClose: () => void; onFocusMonument?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const name = monumentName(report.monument.ordinal);
  const fleetLine = (fleet: Fleet) => fleetEntries(fleet).map(([hull, count]) => `${String(count)} ${hullLabel(hull)}`).join(' · ');
  const wiped = fleetCount(report.yourSurvivors) === 0;
  // A cached report can predate the opponent field even though the current schema
  // defaults it. Treat that legacy wire shape as an empty roster at the boundary.
  const rawOpponents: unknown = (report as unknown as { opponents?: unknown }).opponents;
  const opponents = Array.isArray(rawOpponents)
    ? rawOpponents as NonNullable<MonumentBattleReport['opponents']>
    : [];
  return <Sheet title={name} onClose={onClose}>
    <div data-monument-report className="grid gap-3 font-v2-ui text-caption text-v2-ink">
      <p className="text-micro text-v2-ink-3">{dayClock(report.at, serverNow())} · {t('reports.rounds', { count: report.roundCount })}</p>
      <p className={wiped ? 'font-semibold text-v2-hostile' : 'font-semibold text-v2-ink'}>
        {t(`monument.reportControl.${report.control}`)}
      </p>
      {opponents.length > 0 && <p>{t('monument.reportOpponents', { names: opponents.map((opponent) => opponent.kind === 'NEUTRAL'
        ? t('monument.neutral') : opponent.clanTag ? `${opponent.name} [${opponent.clanTag}]` : opponent.name).join(' · ') })}</p>}
      <p>{t('monument.reportOwn', { sent: fleetCount(report.yourFleet), left: fleetCount(report.yourSurvivors), lost: fleetCount(report.yourLosses) })}</p>
      <div className="grid gap-1.5">
        {fleetEntries(report.yourFleet).map(([hull, sent]) => <p key={hull} className="flex items-center justify-between gap-2">
          <span>{hullLabel(hull)}</span><span className="font-v2-mono">{t('monument.reportHull', { sent, left: report.yourSurvivors[hull] ?? 0, lost: report.yourLosses[hull] ?? 0 })}</span>
        </p>)}
      </div>
      {report.yourDamage.map((lot, index) => <p key={`${lot.hull}:${String(index)}`} className="text-micro text-v2-ink-2">
        {t('monument.reportHealth', { count: lot.count, hull: hullLabel(lot.hull), health: decimal((10_000 - lot.damageBp - lot.remainderBp) / 100, 4) })}
      </p>)}
      {fleetCount(report.theirLosses) > 0 && <p>{t('monument.reportEnemyLosses', { fleet: fleetLine(report.theirLosses) })}</p>}
      <p>{t('monument.reportLoot', { amount: decimal(report.lootDeuterium, 3) })}</p>
      <p className={report.dominion < 0 ? 'text-v2-hostile' : 'text-v2-self'}>{t('reports.dominion')}: {signed(report.dominion)}</p>
      {onFocusMonument && <button type="button" className="min-h-10 rounded-control border border-v2-line px-3 font-semibold text-v2-self"
        onClick={() => { onClose(); onFocusMonument(report.monument.id); }}>{t('monument.look', { name })}</button>}
    </div>
  </Sheet>;
}
