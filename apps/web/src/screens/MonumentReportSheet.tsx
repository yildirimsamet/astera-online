import { fleetCount, fleetEntries, type Fleet } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import type { MonumentBattleReport } from '../api/schemas.js';
import { hullLabel, monumentName } from '../i18n/names.js';
import { decimal } from '../lib/format.js';
import { dayClock } from '../lib/time.js';
import { serverNow } from '../lib/clock.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { HonorBattleSummary } from '../ui/HonorBattleSummary.js';
import { RankingScores } from '../ui/RankingScores.js';
import { battleOutcome, battleTone, monumentControlKey, monumentGradeKey } from '../lib/battleOutcome.js';
import { MonumentBattleRules } from './MonumentBattleRules.js';
import { ARENA_ECONOMY } from '@astera/rules/arena';
import { arenaCopy } from '../arena/copy.js';

export function MonumentReportSheet({ report, onClose, onFocusMonument }: {
  report: MonumentBattleReport; onClose: () => void; onFocusMonument?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const name = monumentName(report.monument.ordinal);
  const fleetLine = (fleet: Fleet) => fleetEntries(fleet).map(([hull, count]) => `${String(count)} ${hullLabel(hull)}`).join(' · ');
  const wiped = fleetCount(report.yourSurvivors) === 0;
  const outcome = battleOutcome({ ...report, survivors: fleetCount(report.yourSurvivors), losses: fleetCount(report.yourLosses) });
  // A cached report can predate the opponent field even though the current schema
  // defaults it. Treat that legacy wire shape as an empty roster at the boundary.
  const rawOpponents: unknown = (report as unknown as { opponents?: unknown }).opponents;
  const opponents = Array.isArray(rawOpponents)
    ? rawOpponents as NonNullable<MonumentBattleReport['opponents']>
    : [];
  return <Sheet title={name} onClose={onClose}>
    <div data-monument-report className="grid gap-3 font-v2-ui text-caption text-v2-ink">
      <p className="text-micro text-v2-ink-3">{dayClock(report.at, serverNow())} · {t('reports.rounds', { count: report.roundCount })}</p>
      <section data-battle-outcome={outcome} className={`grid gap-2 rounded-control border p-3 ${battleTone[outcome]}`}>
        <p className="font-semibold text-v2-ink">{t(monumentControlKey(report))}</p>
        <p className="w-fit rounded-cell border border-current/30 px-2 py-1 text-micro font-semibold">{t(monumentGradeKey(report))}</p>
        {wiped && fleetCount(report.yourLosses) > 0 && <p className="font-semibold text-v2-hostile">{t('monument.battleResult.wiped')}</p>}
      </section>
      <HonorBattleSummary receipt={report.honor} dominion={report.dominion} />
      {opponents.length > 0 && <p>{t('monument.reportOpponents', { names: opponents.map((opponent) => opponent.kind === 'NEUTRAL'
        ? t('monument.neutral') : opponent.clanTag ? `${opponent.name} [${opponent.clanTag}]` : opponent.name).join(' · ') })}</p>}
      <p>{t('monument.reportOwn', { sent: fleetCount(report.yourFleet), left: fleetCount(report.yourSurvivors), lost: fleetCount(report.yourLosses) })}</p>
      {(report.admirals ?? []).map((admiral, index) => {
        // Y9: a capture leaves the fleet in the monument and sends the escort home alone; a loss repairs it.
        const values = { ship: arenaCopy().classes[admiral.ship].name, level: arenaCopy().level(admiral.level) };
        const won = report.control === 'ATTACKER';
        return <p key={`admiral:${String(index)}`} data-effect="admiral"
          className={!report.attacking ? 'text-v2-ink-2' : won ? 'text-v2-self' : 'text-v2-warn'}>
          {!report.attacking ? t('reports.effects.admiralRaider', values)
            : won ? t('reports.effects.admiralHeld', values) : t('reports.effects.admiralRepair', { ...values, minutes: ARENA_ECONOMY.repairMinutes })}
        </p>;
      })}
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
      {!report.honor ? <RankingScores dominion={report.dominion} /> : null}
      <MonumentBattleRules />
      {onFocusMonument && <button type="button" className="min-h-10 rounded-control border border-v2-line px-3 font-semibold text-v2-self"
        onClick={() => { onClose(); onFocusMonument(report.monument.id); }}>{t('monument.look', { name })}</button>}
    </div>
  </Sheet>;
}
