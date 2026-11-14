import { HULLS, shipCanFight } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { hullLabel } from '../i18n/names.js';
import { decimal, full } from '../lib/format.js';
import { healthDisplay, type MaintenanceRow } from '../lib/maintenanceInventory.js';
import { Glyph } from '../game-ui/icons.js';
import { HULL_ART } from './assets.js';
import { QuantityStepper } from './QuantityStepper.js';

export function ShipHealthInventory({ rows, quantities, onQuantity, disabled = false }: {
  rows: readonly MaintenanceRow[];
  quantities: Readonly<Record<string, number>>;
  onQuantity: (key: string, count: number) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  // On the game kit (G2-f): the hull's picture, its name and count, its health as a figure and a
  // bar in the colour of what it means, and the kit's count to choose how many.
  return <ul className="gk gk-hgroups">
    {rows.map((row) => {
      const name = hullLabel(row.hull);
      const display = healthDisplay(row);
      const pct = decimal(display.percent, Number.isInteger(display.percent) ? 0 : 2);
      const health = t(`repairStation.maintenance.health${display.relation === 'above' ? 'Above' : display.relation === 'below' ? 'Below' : 'Exact'}`, { pct });
      const damaged = row.damageBp > 0 || (row.remainderBp ?? 0) > 0;
      const critical = !shipCanFight(row);
      const art = HULL_ART[row.hull];
      // the figure warns at any wound; the bar only when the ship can no longer fight
      const tone = damaged ? 'warn' : 'self';
      return <li key={row.key} data-testid="health-group" data-critical={critical || undefined} className="gk-hgroup"
        style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 96px' }}>
        <div className="gk-hgroup__main">
          <span className="gk-hgroup__art">
            {art ? <img src={art} width={40} height={40} alt="" aria-hidden loading="lazy" /> : <Glyph id="rocket" />}
          </span>
          <span className="gk-hgroup__text">
            <span className="gk-hgroup__head">
              <span className="gk-hgroup__name">{name}</span>
              <span className="gk-hgroup__count gk-num">×{full(row.count)}</span>
            </span>
            <span className="gk-hgroup__state">
              <span className="gk-hgroup__health gk-num" data-tone={tone}>{health}</span>
              {row.busy ? <span className="gk-hgroup__reserved">{t('repairStation.maintenance.reserved')}</span> : (
                <span className="gk-hgroup__fight" {...(critical ? { 'data-tone': 'warn' } : {})}>
                  {HULLS[row.hull].atk === 0 && !critical ? t('dossier.unarmedLabel')
                    : t(`repairStation.maintenance.${critical ? 'critical' : damaged ? 'ready' : 'healthy'}`)}
                </span>
              )}
            </span>
            <span role="meter" aria-label={name} aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={display.percent} aria-valuetext={health} className="gk-hgroup__meter">
              <span data-tone={critical ? 'warn' : 'self'} style={{ width: `${String(display.percent)}%` }} />
            </span>
          </span>
        </div>
        {/* a group already on the cradle has nothing to choose: its one line says it is reserved */}
        {!row.busy && <div className="gk-hgroup__foot">
          <span className="gk-sub">{t('repairStation.maintenance.available', { count: row.count })}</span>
          <fieldset disabled={disabled} className="gk-hgroup__pick">
              <QuantityStepper look="kit" min={0} max={row.count} value={quantities[row.key] ?? 0}
                onChange={(count) => { onQuantity(row.key, count); }}
                valueLabel={t('repairStation.maintenance.quantity', { name, health })}
                decreaseLabel={t('repairStation.maintenance.decrease', { name })}
                increaseLabel={t('repairStation.maintenance.increase', { name })}
                maxLabel={t('repairStation.maintenance.selectAll', { name })} maxText={t('repairStation.maintenance.all')} />
          </fieldset>
        </div>}
      </li>;
    })}
  </ul>;
}
