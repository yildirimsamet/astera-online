import { useTranslation } from 'react-i18next';

/**
 * One rule, said before the fleet goes and again after the battle: a battle here is not a battle there.
 * Before the launch it also says what a ship carries in (player test D-07): a full shield, and its wounds.
 */
export function TempoNote({ aboard, beforeLaunch = false }: { aboard: boolean; beforeLaunch?: boolean }) {
  const { t } = useTranslation();
  if (!aboard) return null;
  return (
    <>
      <p role="note" data-starter-tempo className="text-micro leading-snug text-v2-ink-3">{t('starter.tempoNote')}</p>
      {beforeLaunch && <p data-testid="ship-shield-note" className="text-micro leading-snug text-v2-ink-3">{t('starter.shieldNote')}</p>}
    </>
  );
}
