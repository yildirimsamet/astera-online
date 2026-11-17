import { FIRST_SEASON_START } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { landingProtection } from './protection.js';

/** The new world lands with the first season's Core, so its raid band is read from that level. */
export const LANDING_GUARD = landingProtection(FIRST_SEASON_START.buildings.CORE);

/**
 * HOW THE NEW WORLD IS KEPT (plan 2026-11-13 §4.4, §4.7), each rule with the player's own number: the
 * shield and what drops it, who may raid it, and when an idle world moves to Silent Space. Said on the
 * jump panel before the choice and on the landing card after it.
 */
export function ProtectionLines({ className }: { className: string }) {
  const { t } = useTranslation();
  return (
    <ul className={className}>
      <li>{t('starter.jump.shield', { hours: LANDING_GUARD.shieldHours })}</li>
      <li>{t('starter.jump.band', { low: LANDING_GUARD.coreLow, high: LANDING_GUARD.coreHigh })}</li>
      <li>{t('starter.jump.silent', { hours: LANDING_GUARD.silentHours })}</li>
    </ul>
  );
}
