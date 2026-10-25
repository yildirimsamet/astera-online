import { fleetCount, type Fleet } from '@astera/rules';
import { useTranslation } from 'react-i18next';

/** Retreat is physical survival with wounds, distinct from the casualty bar. */
export function BattleRetreatNote({ fleet, enemyCount = 0 }: { fleet?: Fleet; enemyCount?: number }) {
  const { t } = useTranslation();
  const count = fleetCount(fleet ?? {});
  if (count === 0 && enemyCount === 0) return null;
  return <div data-battle-retreat className="rounded-control border border-v2-self/25 bg-v2-self/5 px-3 py-2 text-caption text-v2-ink-2">
    {count > 0 && <p>{t('reports.retreated', { count })}</p>}
    {enemyCount > 0 && <p data-enemy-retreat>{t('reports.enemyRetreated', { count: enemyCount })}</p>}
  </div>;
}
