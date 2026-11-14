import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HULLS, radiationDamageMult, type HullId, type TechLevels } from '@astera/rules';
import { Glyph } from '../game-ui/index.js';
import { decimal } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { useOwnPress } from './kit/useOwnPress.js';

/**
 * The ship's own research travels with it; a planet's Aegis is a separate layer. A kit well among
 * the hull's figures (G2-e); its rule opens under it and the well takes the whole row to say it.
 */
export function ShipRadiationProtection({ hull, tech }: { hull: HullId; tech: TechLevels }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); setExpanded((value) => !value); });
  const immune = HULLS[hull].ground || hull === 'PROSPECTOR';
  const level = tech.RADIATION_SHIELDING ?? 0;
  const percent = immune ? 100 : Math.round((1 - radiationDamageMult(tech)) * 100);
  return (
    <div data-stat="radiation" data-tone="warn" {...(expanded ? { 'data-open': '' } : {})} className="gk-hullstat gk-hullstat--half gk-hullstat--peek gk-well">
      <dt>
        {t('planet.radiationProtection.ship')}
        <button type="button" {...OWN_SOUND} className="gk-round gk-round--small gk-hullstat__peek" aria-label={t('planet.radiationProtection.shipInfo')}
          aria-expanded={expanded} onPointerDown={own.onPointerDown} onClick={own.onClick}>
          <span className="gk-round__face"><Glyph id="help" /></span>
        </button>
      </dt>
      <dd className="gk-num"><Glyph id="radiation" />{immune ? t('planet.radiationProtection.immune') : `${decimal(percent, 0)}%`}</dd>
      {expanded && (
        <dd className="gk-hullstat__more">
          <p>{immune ? t('planet.radiationProtection.immuneInfo') : t('planet.radiationProtection.shipResearch', { level, percent: decimal(percent, 0) })}</p>
          {!immune && <p>{t('planet.radiationProtection.shipScope')}</p>}
        </dd>
      )}
    </div>
  );
}
