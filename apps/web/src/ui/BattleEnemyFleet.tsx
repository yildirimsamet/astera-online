import { fleetCount, fleetEntries, type Fleet } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { hullLabel } from '../i18n/names.js';
import { HULL_ART } from './assets.js';
import { SurvivorBar } from './SurvivorBar.js';

/** The opposing force at this battle, served only after the server grants full intelligence. */
export function BattleEnemyFleet({ fleet, losses, attacking }: { fleet: Fleet; losses: Fleet; attacking: boolean }) {
  const { t } = useTranslation();
  return <section data-their-board={attacking ? 'full' : 'arrived'} className="gk-report__block">
    <h3 className="gk-report__subhead">{t(attacking ? 'reports.enemyFleetAtBattle' : 'reports.theirBoardArrived')}</h3>
    <p className="gk-report__copy">{t('reports.enemyFleetSnapshot')}</p>
    {fleetCount(fleet) === 0 ? <p className="gk-report__copy" data-tone="quiet">{t('reports.enemyFleetEmpty')}</p>
      : <div className="gk-ledger gk-forces" data-side="theirs">
        {fleetEntries(fleet).map(([hull, count]) => <div key={hull} data-enemy-hull={hull} className="gk-force">
          <span className="gk-force__hull">
            {HULL_ART[hull] && <img src={HULL_ART[hull]} alt="" width={32} height={32} />}
            <span className="gk-force__name"><span className="gk-report__subhead">{hullLabel(hull)}</span></span>
          </span>
          <SurvivorBar compactRow sent={count} lost={losses[hull] ?? 0} side="theirs" sentLabel={t('reports.force.start')} />
        </div>)}
      </div>}
  </section>;
}

export function BattleIntelNotice({ visibility }: { visibility?: 'FULL' | 'INSUFFICIENT_FORCE' | 'UNKNOWN' | undefined }) {
  const { t } = useTranslation();
  if (visibility !== 'INSUFFICIENT_FORCE' && visibility !== 'UNKNOWN') return null;
  return <p data-enemy-intel={visibility} className="gk-report__note" data-tone="warn">
    {t(visibility === 'INSUFFICIENT_FORCE' ? 'reports.enemyFleetInsufficient' : 'reports.enemyFleetUnknown')}
  </p>;
}
