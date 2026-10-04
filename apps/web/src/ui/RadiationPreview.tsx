import { useTranslation } from 'react-i18next';
import type { RouteRadiation } from '../lib/radiation.js';
import { decimal } from '../lib/format.js';
import { hullName } from '../i18n/names.js';

/** Own fleet health at the commitment. Each hull keeps its actual HP denominator. */
export function RadiationPreview({ radiation, combat = false }: { radiation: RouteRadiation | null; combat?: boolean }) {
  const { t } = useTranslation();
  if (!radiation) return null;
  const color = radiation.destroyed > 0 ? 'text-v2-hostile' : 'text-v2-warn';
  if (radiation.kind !== 'HP') return <p data-radiation-warning className={`text-caption leading-snug ${color}`}>
    {radiation.destroyed > 0 ? t('launch.radiationLethal', { count: radiation.destroyed })
      : t(radiation.docks ? 'launch.radiationDock' : 'launch.radiationPatched', { pct: radiation.pct })}
  </p>;
  return <div data-radiation-warning className="grid gap-1 text-caption leading-snug">
    <p className={color}>{t(radiation.returnDoseHp === undefined ? 'launch.radiationHpDose' : 'launch.radiationHpOutbound', { hp: decimal(radiation.doseHp, 2) })}</p>
    {(radiation.returnDoseHp ?? 0) > 0 && <p className={color}>{t('launch.radiationHpReturn', { hp: decimal(radiation.returnDoseHp ?? 0, 2) })}</p>}
    {radiation.destroyed > 0 && <p className="text-v2-hostile">{t('launch.radiationLethal', { count: radiation.destroyed })}</p>}
    {radiation.lots.map((lot, index) => <div key={`${lot.hull}:${index}`} className="text-v2-ink-2">
      <p>{t('launch.radiationHpHealth', { count: lot.count, hull: hullName(lot.hull),
        health: decimal(Math.floor(lot.healthPct * 100) / 100, 2), hp: decimal(lot.remainingHp, 2), max: decimal(lot.maxHp, 2) })}</p>
      <p className="text-micro text-v2-ink-3">{t(lot.needsDock ? 'launch.radiationHpDock' : 'launch.radiationHpFree')}</p>
      {lot.returning !== undefined && <p className="text-micro text-v2-ink-3">{t(lot.returning ? 'launch.radiationHpHome' : 'launch.radiationHpStays')}</p>}
    </div>)}
    {combat && <p className="text-micro text-v2-ink-3">{t('launch.radiationHpCombat')}</p>}
  </div>;
}
