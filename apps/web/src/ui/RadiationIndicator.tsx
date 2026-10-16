import { useTranslation } from 'react-i18next';
import type { TargetRadiation } from '../lib/targetRadiation.js';
import { decimal } from '../lib/format.js';
import { countdown } from '../lib/time.js';
import { Icon } from '../v2/icons.js';

const YELLOW = [247, 205, 79] as const;
const ORANGE = [255, 151, 66] as const;
const RED = [255, 86, 88] as const;

/** Whole-number bands stay exact; fractional HP rates blend across 16→17 and 32→33. */
function dangerColour(rate: number): string {
  const [from, to] = rate <= 17 ? [YELLOW, ORANGE] : [ORANGE, RED];
  const progress = Math.min(1, Math.max(0, rate - (rate <= 17 ? 16 : 32)));
  const smooth = progress * progress * (3 - 2 * progress);
  return `rgb(${from.map((channel, i) => Math.round(channel + (to[i]! - channel) * smooth)).join(', ')})`;
}

/** A compact map meter and the expanded, selected-target instrument share one projection. */
export function RadiationIndicator({ state, variant, now }: {
  state: TargetRadiation; variant: 'bar' | 'dial'; now: number;
}) {
  const { t } = useTranslation();
  const fraction = Math.min(1, Math.max(0, state.rate / 50));
  const label = t('planet.radiationBomb.rate', { rate: decimal(state.rate, 2) });
  const angle = Math.PI * (1 + fraction);
  const style = { color: dangerColour(state.rate) };
  if (variant === 'bar') return <div className="radiation-meter" style={style} role="meter"
    aria-label={t('planet.radiationBomb.radiation')} aria-valuemin={0} aria-valuemax={Math.max(50, state.rate)} aria-valuenow={state.rate}
    aria-valuetext={label} title={label}>
    <div className="radiation-meter__scale" aria-hidden="true">{Array.from({ length: 10 }, (_, i) =>
      <i key={i} className={fraction * 10 > i ? 'is-lit' : ''} />)}</div>
    <span>{label}</span>
  </div>;
  return <section className="radiation-instrument" style={style} data-radiation-dial>
    <div className="radiation-instrument__dial" role="meter" aria-label={t('planet.radiationBomb.radiation')}
      aria-valuemin={0} aria-valuemax={Math.max(50, state.rate)} aria-valuenow={state.rate} aria-valuetext={label}>
      <svg viewBox="0 0 160 106" aria-hidden="true">
        <path d="M16 80 A64 64 0 0 1 144 80" fill="none" stroke="currentColor" strokeWidth="9" opacity=".13" />
        <path d="M16 80 A64 64 0 0 1 144 80" fill="none" stroke="currentColor" strokeWidth="5"
          pathLength="100" strokeDasharray={`${fraction * 100} 100`} className="radiation-instrument__arc" />
        {Array.from({ length: 11 }, (_, i) => {
          const a = Math.PI * (1 + i / 10);
          return <line key={i} x1={80 + 49 * Math.cos(a)} y1={80 + 49 * Math.sin(a)}
            x2={80 + 54 * Math.cos(a)} y2={80 + 54 * Math.sin(a)} stroke="currentColor" opacity=".5" />;
        })}
        <line x1="80" y1="80" x2={80 + 43 * Math.cos(angle)} y2={80 + 43 * Math.sin(angle)}
          stroke="currentColor" strokeWidth="2" className="radiation-instrument__needle" />
        <circle cx="80" cy="80" r="4" fill="currentColor" />
        <text x="12" y="99" fill="currentColor" fontSize="9">0</text>
        <text x="136" y="99" fill="currentColor" fontSize="9">50</text>
      </svg>
    </div>
    <div className="radiation-instrument__reading">
      <span className="radiation-instrument__title flex items-center gap-1.5"><Icon id="i-radiation" className="size-4" />{t('planet.radiationBomb.radiation')}</span>
      <strong>{decimal(state.rate, 2)} <small>{t('planet.radiationBomb.unit')}</small></strong>
      <p>{t('planet.radiationBomb.perShip')}</p>
      {(state.planetProtection ?? 0) > 0 && <p>{t('planet.radiationProtection.aegisReduction', { rate: decimal(state.planetProtection ?? 0, 0) })}</p>}
      {state.protectedRate < state.rate && <p>{t('planet.radiationBomb.protectedRate', { rate: decimal(state.protectedRate, 2) })}</p>}
      <p>{state.nextChangeAt === null ? t('planet.radiationBomb.permanent')
        : t('planet.radiationBomb.decrease', { time: countdown(state.nextChangeAt - now), rate: decimal(state.nextRate ?? 0, 2) })}</p>
      <details className="radiation-instrument__sources">
        <summary>{t('planet.radiationBomb.sources')} <span>{state.sources.length}</span></summary>
        <ul>{state.sources.map(source => <li key={source.id}>
          <span>{source.origin === 'BOMB' ? t('planet.radiationBomb.bombSource', { level: source.level })
            : t('planet.radiationBomb.environment')}</span>
          <strong>{t('planet.radiationBomb.rate', { rate: decimal(source.intensityHpPerMinute, 2) })}</strong>
          <small>{source.activeUntil === null ? t('planet.radiationBomb.permanent')
            : t('planet.radiationBomb.sourceEnd', { time: countdown(source.activeUntil.getTime() - now) })}</small>
        </li>)}</ul>
      </details>
    </div>
  </section>;
}
