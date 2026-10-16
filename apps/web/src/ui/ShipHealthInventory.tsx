import { HULLS, shipCanFight } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { hullLabel } from '../i18n/names.js';
import { decimal, full } from '../lib/format.js';
import { healthDisplay, type MaintenanceRow } from '../lib/maintenanceInventory.js';
import { Icon } from '../v2/icons.js';
import { HULL_ART } from './assets.js';
import { QuantityStepper } from './QuantityStepper.js';

export function ShipHealthInventory({ rows, quantities, onQuantity, disabled = false }: {
  rows: readonly MaintenanceRow[];
  quantities: Readonly<Record<string, number>>;
  onQuantity: (key: string, count: number) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return <ul className="flex flex-col gap-1.5">
    {rows.map((row) => {
      const name = hullLabel(row.hull);
      const display = healthDisplay(row);
      const pct = decimal(display.percent, Number.isInteger(display.percent) ? 0 : 2);
      const health = t(`repairStation.maintenance.health${display.relation === 'above' ? 'Above' : display.relation === 'below' ? 'Below' : 'Exact'}`, { pct });
      const damaged = row.damageBp > 0 || (row.remainderBp ?? 0) > 0;
      const critical = !shipCanFight(row);
      const art = HULL_ART[row.hull];
      return <li key={row.key} data-testid="health-group" data-critical={critical || undefined}
        className={`overflow-hidden rounded-control border bg-v2-panel ${critical ? 'border-v2-warn/50' : 'border-v2-line'}`}
        style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 96px' }}>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-cell bg-v2-deep">
            {art ? <img src={art} width={40} height={40} alt="" aria-hidden loading="lazy" className="size-10 object-contain" />
              : <Icon id="i-fleet" className="size-5 text-v2-ink-3" />}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-caption font-semibold text-v2-ink">{name}</span>
              <span className="shrink-0 font-v2-mono text-micro text-v2-ink-2">×{full(row.count)}</span>
            </span>
            <span className="flex items-center justify-between gap-1 text-micro">
              <span className={`font-v2-mono ${damaged ? 'text-v2-warn' : 'text-v2-self'}`}>{health}</span>
              <span className={critical ? 'font-semibold text-v2-warn' : 'text-v2-ink-3'}>
                {HULLS[row.hull].atk === 0 && !critical ? t('dossier.unarmedLabel')
                  : t(`repairStation.maintenance.${critical ? 'critical' : damaged ? 'ready' : 'healthy'}`)}
              </span>
            </span>
            <span role="meter" aria-label={name} aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={display.percent} aria-valuetext={health} className="h-1 overflow-hidden rounded-full bg-v2-line">
              <span className={`block h-full rounded-full ${critical ? 'bg-v2-warn' : 'bg-v2-self'}`}
                style={{ width: `${String(display.percent)}%` }} />
            </span>
          </span>
        </div>
        <div className="flex min-h-9 items-center justify-between gap-2 border-t border-v2-line bg-v2-deep/40 px-2 py-1">
          <span className="text-micro text-v2-ink-3">{t('repairStation.maintenance.available', { count: row.count })}</span>
          {row.busy ? <span className="text-micro text-v2-self">{t('repairStation.maintenance.reserved')}</span>
            : <fieldset disabled={disabled} className="min-w-0 rounded-control focus-within:ring-2 focus-within:ring-v2-self/60 focus-within:ring-offset-2 focus-within:ring-offset-v2-deep disabled:opacity-40">
              <QuantityStepper look="v2" min={0} max={row.count} value={quantities[row.key] ?? 0}
                onChange={(count) => { onQuantity(row.key, count); }}
                valueLabel={t('repairStation.maintenance.quantity', { name, health })}
                decreaseLabel={t('repairStation.maintenance.decrease', { name })}
                increaseLabel={t('repairStation.maintenance.increase', { name })}
                maxLabel={t('repairStation.maintenance.selectAll', { name })} maxText={t('repairStation.maintenance.all')} />
            </fieldset>}
        </div>
      </li>;
    })}
  </ul>;
}
