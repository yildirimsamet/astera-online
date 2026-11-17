import type { HullClass } from '@astera/rules';
import { useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { useCountField } from '../ui/QuantityStepper.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { Chip } from './buttons.js';
import { Glyph, type GlyphId } from './icons.js';
import { Emblem, MultiplierBadge, ProgressBar } from './readouts.js';
import type { CssVars } from './style.js';
import { useRepeatPress } from './useRepeatPress.js';

export interface UnitCardProps {
  name: string;
  /** The painted ship; null draws `mark` (a hull with no painting yet) in its place. */
  art: string | null;
  mark?: ReactNode;
  cls: HullClass;
  /** How this ship meets the target's main class (a multiplier or a matchup mark); none when it does not fight. */
  badge?: ReactNode;
  home: number;
  /** The most that may go: what stands home, or a lesson's lower ceiling. Zero keeps every control dead. */
  max?: number;
  chosen: number;
  onChange: (next: number) => void;
  /** One more line under the bar: what a hauler adds to the hold. */
  extra?: ReactNode;
  /** What the ship brings, drawn as a narrow column beside it (owner 2026-11-17): a glyph and a figure each. */
  stats?: readonly UnitStat[];
}

export interface UnitStat {
  id: string;
  glyph: GlyphId;
  /** The figure's name, spoken with it; the column itself draws only the glyph and the figure. */
  label: string;
  value: string;
}

/**
 * THE SHIP CARD. The ship is the button: a tap sends one more, a hold sends many (owner,
 * 2026-11-16: the attack sheet takes these cards). The count is a field that can be written
 * in, the minus takes one back, MAX sends all that may go, and nothing goes past the ceiling.
 * Each ship added bumps the count and nudges the ship.
 */
export function UnitCard({ name, art, mark, cls, badge, home, max = home, chosen, onChange, extra, stats, ...data }: UnitCardProps & Record<`data-${string}`, string>) {
  const { t } = useTranslation();
  const ceiling = Math.max(0, Math.min(home, max));
  const dead = ceiling === 0;
  // A held ship repeats faster than a frame may draw: each step counts from the last one sent.
  const latest = useRef(chosen);
  latest.current = chosen;
  const change = (next: number): void => {
    const clamped = Math.min(ceiling, Math.max(0, next));
    if (clamped === latest.current) return;
    playSound('tick');
    haptic(clamped === ceiling ? 'thunk' : 'tap');
    latest.current = clamped;
    onChange(clamped);
  };
  const more = useRepeatPress((n) => { change(latest.current + n); }, chosen < ceiling, ceiling);
  const fewer = useRepeatPress((n) => { change(latest.current - n); }, chosen > 0, ceiling);
  const full = chosen >= ceiling;
  const countId = useId();
  const count = useCountField({ value: chosen, min: 0, max: ceiling, onChange, label: t('launch.quantity', { name }), disabled: dead, id: countId });
  return (
    <div {...data} className={`gk-unit gk-plate${chosen > 0 ? ' gk-edge-self' : ''}`} {...OWN_SOUND}
      {...(full && !dead ? { 'data-full': '' } : {})} {...(chosen > 0 ? { 'data-chosen': '' } : {})} {...(dead ? { 'data-dead': '' } : {})}>
      <div className="gk-unit__head">
        <Emblem cls={cls} />
        <span className="gk-unit__name gk-display gk-outlined">{name}</span>
        <span className="gk-unit__home gk-display gk-num"><Glyph id="home" /><span aria-hidden="true">{home}</span>
          <span className="sr-only">{t('launch.atHome', { count: home })}</span></span>
      </div>
      <div className={`gk-unit__stage${stats && stats.length > 0 ? ' gk-unit__stage--stats' : ''}`}>
        {stats && stats.length > 0 && (
          <dl data-unit-stats="" className="gk-unit__stats">
            {stats.map((stat) => (
              <div key={stat.id} data-stat={stat.id} aria-label={`${stat.label} ${stat.value}`} className="gk-unit__stat">
                <dt><Glyph id={stat.glyph} /></dt>
                <dd className="gk-num">{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <button type="button" className="gk-unit__ship" aria-label={t('launch.more', { name })} aria-describedby={countId} aria-disabled={full || undefined} disabled={dead} {...more}>
          {art ? <img key={chosen} className="gk-unit__art" src={art} alt="" {...(chosen > 0 ? { 'data-nudge': '' } : {})} />
            : <span className="gk-unit__art gk-unit__art--mark">{mark}</span>}
        </button>
        {badge !== undefined && <span className="gk-unit__mult">{badge}</span>}
        {count.field(`gk-count gk-num gk-unit__count${chosen > 0 ? '' : ' gk-count--idle'}`)}
        {chosen > 0 && (
          <button type="button" className="gk-round gk-round--small gk-unit__minus" aria-label={t('launch.fewer', { name })} {...fewer}>
            <span className="gk-round__face"><Glyph id="minus" /></span>
          </button>
        )}
      </div>
      <div className="gk-unit__foot">
        <ProgressBar value={chosen} max={Math.max(1, ceiling)} />
        {/* `data-count-max` is where the tutorial hand points (Academy, Flight School). */}
        <span data-count-max className="gk-unit__max"><Chip label={t('launch.max', { name })} onPress={() => { change(ceiling); }} disabled={full}>{t('launch.maxShort')}</Chip></span>
        {extra !== undefined && <span className="gk-unit__extra">{extra}</span>}
      </div>
    </div>
  );
}

/** THE BAY: a narrow slot in a row the slider drives. A press picks it for the slider. */
export function UnitBay({
  name, art, cls, multiplier, home, chosen, selected, onSelect,
}: {
  name: string;
  art: string;
  cls: HullClass;
  multiplier: number | null;
  home: number;
  chosen: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onSelect(); });
  const share: CssVars = { '--share': `${String(home > 0 ? Math.round((chosen / home) * 100) : 0)}%` };
  return (
    <button type="button" className="gk-bay" aria-pressed={selected} {...OWN_SOUND} onPointerDown={own.onPointerDown} onClick={own.onClick}>
      <span className="gk-bay__band">
        {multiplier !== null && <MultiplierBadge value={multiplier} />}
      </span>
      <span className="gk-bay__ship">
        <img className="gk-bay__art" src={art} alt="" />
        <Emblem cls={cls} />
      </span>
      <span className="gk-bay__tally">
        <span className={`gk-bay__count gk-display gk-num gk-outlined${chosen > 0 ? ' gk-tone-self' : ''}`}>{chosen}</span>
        <span className="gk-bay__of gk-display gk-num">/{home}</span>
      </span>
      <span className="gk-bay__share" aria-hidden="true" style={share} />
      <span className="gk-bay__name">{name}</span>
    </button>
  );
}
