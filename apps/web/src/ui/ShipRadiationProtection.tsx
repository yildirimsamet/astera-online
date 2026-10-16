import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HULLS, radiationDamageMult, type HullId, type TechLevels } from '@astera/rules';
import { Icon } from '../v2/icons.js';
import { decimal } from '../lib/format.js';

/** The ship's own research travels with it; a planet's Aegis is a separate layer. */
export function ShipRadiationProtection({ hull, tech }: { hull: HullId; tech: TechLevels }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const immune = HULLS[hull].ground || hull === 'PROSPECTOR';
  const level = tech.RADIATION_SHIELDING ?? 0;
  const percent = immune ? 100 : Math.round((1 - radiationDamageMult(tech)) * 100);
  return <div data-stat="radiation" className="col-span-3 mt-1 flex flex-wrap items-center gap-x-2 rounded-control border border-v2-warn/25 bg-v2-warn/5 px-2.5 py-2">
    <dt className="flex min-w-0 flex-1 items-center gap-2 text-micro text-v2-ink-2">
      <Icon id="i-radiation" className="size-4 shrink-0 text-v2-warn" />
      <span className="min-w-0 flex-1">{t('planet.radiationProtection.ship')}</span>
      <button type="button" aria-label={t('planet.radiationProtection.shipInfo')} aria-expanded={expanded}
        onClick={() => { setExpanded(value => !value); }} className="grid size-8 shrink-0 place-items-center rounded-chip text-v2-ink-2 hover:bg-v2-raise focus-visible:outline focus-visible:outline-2 focus-visible:outline-v2-self">
        <Icon id="i-info" className="size-4" />
      </button>
    </dt>
    <dd className="font-v2-mono text-caption tabular-nums text-v2-warn">{immune ? t('planet.radiationProtection.immune') : `${decimal(percent, 0)}%`}</dd>
    {expanded && <dd className="mt-1.5 basis-full border-t border-v2-warn/20 pt-2 text-caption leading-snug text-v2-ink-2">
      <p>{immune ? t('planet.radiationProtection.immuneInfo') : t('planet.radiationProtection.shipResearch', { level, percent: decimal(percent, 0) })}</p>
      {!immune && <p className="mt-1 text-v2-ink-3">{t('planet.radiationProtection.shipScope')}</p>}
    </dd>}
  </div>;
}
