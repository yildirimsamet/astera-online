import { useTranslation } from 'react-i18next';
import type { PlanetView } from '../api/schemas.js';
import { Glyph, InfoPeek } from '../game-ui/index.js';
import { decimal } from '../lib/format.js';
import { countdown, useNow } from '../lib/time.js';
import { useArrivals } from '../session/useArrivals.js';

/**
 * Planet flat reduction and ship research are deliberately separate readings. The row
 * says what this world takes off radiation now; "?" opens where it comes from (stage 4.1,
 * the kit's `InfoPeek`). Zero is a reading, in the warning colour and in its figure.
 */
export function PlanetRadiationProtection({ planet }: { planet: PlanetView }) {
  const { t } = useTranslation();
  const now = useNow(1000);
  const level = planet.planet.radiationProtectionLevel ?? planet.effectiveInstruments?.AEGIS ?? 0;
  const reduction = planet.planet.radiationProtectionHpPerMinute ?? 0;
  const restoresAt = planet.planet.radiationProtectionRestoresAt;
  useArrivals([restoresAt, planet.planet.shieldRegenAt]);
  return (
    <section data-testid="planet-radiation-protection" className="gk gk-shelter" data-tone={reduction > 0 ? 'good' : 'warn'}>
      <InfoPeek
        about={t('planet.radiationProtection.planetInfo')}
        lead={<span className="gk-shelter__coin"><Glyph id="radiation" /></span>}
        fact={(
          <>
            <span className="gk-shelter__name">{t('planet.radiationProtection.planet')}</span>
            <strong className="gk-shelter__value gk-num">{t('planet.radiationBomb.rate', { rate: decimal(reduction, 0) })}</strong>
          </>
        )}
        rule={(
          <>
            <span className="gk-shelter__line">{t('planet.radiationProtection.aegisSource', { level })}</span>
            <span className="gk-shelter__line">{t('planet.radiationProtection.planetScope')}</span>
            {reduction === 0 && level > 0 && <span className="gk-shelter__line" data-tone="warn">{t('planet.radiationProtection.emptyShield')}</span>}
            {restoresAt && restoresAt.getTime() > now && (
              <span className="gk-shelter__line gk-num" data-tone="warn">
                {t('planet.radiationProtection.restores', { time: countdown(restoresAt.getTime() - now) })}
              </span>
            )}
          </>
        )}
      />
    </section>
  );
}
