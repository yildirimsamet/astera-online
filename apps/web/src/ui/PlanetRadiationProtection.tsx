import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlanetView } from '../api/schemas.js';
import { decimal } from '../lib/format.js';
import { countdown, useNow } from '../lib/time.js';
import { Icon } from '../v2/icons.js';
import { useArrivals } from '../session/useArrivals.js';

/** Planet flat reduction and ship research are deliberately separate readings. */
export function PlanetRadiationProtection({ planet }: { planet: PlanetView }) {
  const { t } = useTranslation();
  const now = useNow(1000);
  const [expanded, setExpanded] = useState(false);
  const level = planet.planet.radiationProtectionLevel ?? planet.effectiveInstruments?.AEGIS ?? 0;
  const reduction = planet.planet.radiationProtectionHpPerMinute ?? 0;
  const restoresAt = planet.planet.radiationProtectionRestoresAt;
  useArrivals([restoresAt, planet.planet.shieldRegenAt]);
  return <section data-testid="planet-radiation-protection" className="rounded-control border border-v2-line bg-v2-panel/80 px-3 py-2 font-v2-ui">
    <div className="flex items-center gap-2">
      <span className={`grid size-8 shrink-0 place-items-center rounded-chip ${reduction > 0 ? 'bg-v2-self/10 text-v2-self' : 'bg-v2-warn/10 text-v2-warn'}`}><Icon id="i-radiation" className="size-4" /></span>
      <span className="min-w-0 flex-1 text-caption text-v2-ink-2">{t('planet.radiationProtection.planet')}</span>
      <strong className={`shrink-0 font-v2-mono text-caption tabular-nums ${reduction > 0 ? 'text-v2-self' : 'text-v2-warn'}`}>
        {t('planet.radiationBomb.rate', { rate: decimal(reduction, 0) })}
      </strong>
      <button type="button" aria-label={t('planet.radiationProtection.planetInfo')} aria-expanded={expanded}
        onClick={() => { setExpanded(value => !value); }} className="grid size-8 shrink-0 place-items-center rounded-chip text-v2-ink-2 hover:bg-v2-raise focus-visible:outline focus-visible:outline-2 focus-visible:outline-v2-self">
        <Icon id="i-info" className="size-4" />
      </button>
    </div>
    {expanded && <div className="mt-2 border-t border-v2-line pt-2 text-caption leading-snug text-v2-ink-2">
      <p>{t('planet.radiationProtection.aegisSource', { level })}</p>
      <p className="mt-1">{t('planet.radiationProtection.planetScope')}</p>
      {reduction === 0 && level > 0 && <p className="mt-1 text-v2-warn">{t('planet.radiationProtection.emptyShield')}</p>}
      {restoresAt && restoresAt.getTime() > now && <p className="mt-1 font-v2-mono text-micro text-v2-warn">
        {t('planet.radiationProtection.restores', { time: countdown(restoresAt.getTime() - now) })}</p>}
    </div>}
  </section>;
}
