import { useTranslation } from 'react-i18next';
import { admiralBonuses, type AdmiralSnapshot } from '@astera/rules/arena';
import { arenaCopy } from '../arena/copy.js';
import { SHIP_TONE } from '../arena/shipTone.js';

/** The ship and its departure-level bonus, identical for the owner and an identified observer. */
export function FlightEscort({ admiral }: { admiral: AdmiralSnapshot }) {
  const { t } = useTranslation();
  const c = arenaCopy();
  const bonus = admiralBonuses(admiral.ship, admiral.level);
  const pct = (factor: number) => Math.round(Math.abs(factor - 1) * 100);
  const gives = admiral.ship === 'akinci'
    ? t('launch.escortBonusAkinci', { pct: pct(bonus.damage) })
    : admiral.ship === 'muhafiz'
      ? t('launch.escortBonusMuhafiz', { pct: pct(bonus.hull) })
      : t('launch.escortBonusKilavuz', { time: pct(bonus.time), fuel: pct(bonus.fuel) });
  return <div data-flight-escort className="mt-3 grid gap-1 border-l-2 bg-v2-panel/60 px-3 py-2" style={{ borderColor: SHIP_TONE[admiral.ship] }}>
    <span className="text-micro uppercase tracking-label text-v2-ink-3">{t('launch.escortLabel')}</span>
    <span className="flex items-baseline gap-2 text-caption text-v2-ink">
      <span className="font-semibold">{c.classes[admiral.ship].name}</span>
      <span className="font-v2-mono text-micro text-v2-ink-3">{c.level(admiral.level)}</span>
    </span>
    <span className="font-v2-mono text-caption tabular-nums" style={{ color: SHIP_TONE[admiral.ship] }}>{gives}</span>
  </div>;
}
