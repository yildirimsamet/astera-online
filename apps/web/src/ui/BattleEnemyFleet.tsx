import { fleetCount, fleetEntries, type Fleet } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { hullLabel } from '../i18n/names.js';
import { HULL_ART } from './assets.js';
import { SurvivorBar } from './SurvivorBar.js';

/** The opposing force at this battle, served only after the server grants full intelligence. */
export function BattleEnemyFleet({ fleet, losses, attacking }: { fleet: Fleet; losses: Fleet; attacking: boolean }) {
  const { t } = useTranslation();
  return <section data-their-board={attacking ? 'full' : 'arrived'} className="mt-3 min-w-0">
    <h3 className="text-caption font-semibold text-v2-ink">{t(attacking ? 'reports.enemyFleetAtBattle' : 'reports.theirBoardArrived')}</h3>
    <p className="mt-1 text-micro leading-relaxed text-v2-ink-2">{t('reports.enemyFleetSnapshot')}</p>
    {fleetCount(fleet) === 0 ? <p className="mt-2 text-caption text-v2-ink-2">{t('reports.enemyFleetEmpty')}</p>
      : <div className="mt-2 divide-y divide-v2-line/60 overflow-hidden rounded-control border border-v2-hostile/25 bg-v2-hostile/5">
        {fleetEntries(fleet).map(([hull, count]) => <div key={hull} data-enemy-hull={hull} className="grid min-w-0 gap-2 p-3 sm:grid-cols-[9rem_1fr] sm:items-center">
          <span className="flex min-w-0 items-center gap-2 text-caption font-semibold text-v2-ink">
            {HULL_ART[hull] && <img src={HULL_ART[hull]} alt="" width={32} height={32} className="size-8 shrink-0 object-contain" />}
            <span>{hullLabel(hull)}</span>
          </span>
          <SurvivorBar sent={count} lost={losses[hull] ?? 0} side="theirs" sentLabel={t('reports.force.start')} />
        </div>)}
      </div>}
  </section>;
}

export function BattleIntelNotice({ visibility }: { visibility?: 'FULL' | 'INSUFFICIENT_FORCE' | 'UNKNOWN' | undefined }) {
  const { t } = useTranslation();
  if (visibility !== 'INSUFFICIENT_FORCE' && visibility !== 'UNKNOWN') return null;
  return <p data-enemy-intel={visibility} className="mt-2 rounded-control border border-v2-alloy/30 bg-v2-alloy/5 px-3 py-2 text-caption leading-relaxed text-v2-alloy">
    {t(visibility === 'INSUFFICIENT_FORCE' ? 'reports.enemyFleetInsufficient' : 'reports.enemyFleetUnknown')}
  </p>;
}
