import type { HullClass } from '@astera/rules';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { Chip } from './buttons.js';
import { Glyph } from './icons.js';
import { CountBadge, Emblem, MultiplierBadge, ProgressBar } from './readouts.js';
import { useRepeatPress } from './useRepeatPress.js';

export interface UnitCardProps {
  name: string;
  art: string;
  cls: HullClass;
  /** How this ship meets the target's main class; null when it does not fight. */
  multiplier: number | null;
  home: number;
  chosen: number;
  onChange: (next: number) => void;
  /** One more line under the bar: what a hauler adds to the hold. */
  extra?: ReactNode;
}

/**
 * THE SHIP CARD. The art is the button: a tap sends one more, a hold sends many.
 * The minus takes one back, MAX sends the whole stock, and nothing goes past what
 * stands at home. Each ship added bumps the count and nudges the ship.
 */
export function UnitCard({ name, art, cls, multiplier, home, chosen, onChange, extra }: UnitCardProps) {
  const { t } = useTranslation();
  const change = (next: number): void => {
    const clamped = Math.min(home, Math.max(0, next));
    if (clamped === chosen) return;
    playSound('tick');
    haptic(clamped === home ? 'thunk' : 'tap');
    onChange(clamped);
  };
  const more = useRepeatPress((n) => { change(chosen + n); }, chosen < home, home);
  const fewer = useRepeatPress((n) => { change(chosen - n); }, chosen > 0, home);
  const full = chosen >= home;
  return (
    <div className={`gk-unit gk-plate${chosen > 0 ? ' gk-edge-self' : ''}`} {...(full ? { 'data-full': '' } : {})}>
      <div className="gk-unit__head">
        <Emblem cls={cls} />
        <span className="gk-unit__name gk-display gk-outlined">{name}</span>
        <span className="gk-unit__home gk-display gk-num"><Glyph id="home" />{home}</span>
      </div>
      <button type="button" className="gk-unit__stage" aria-label={t('launch.more', { name })} aria-disabled={full || undefined} {...more}>
        <img key={chosen} className="gk-unit__art" src={art} alt="" {...(chosen > 0 ? { 'data-nudge': '' } : {})} />
        {multiplier !== null && <span className="gk-unit__mult"><MultiplierBadge value={multiplier} /></span>}
        <span className="gk-unit__count"><CountBadge value={chosen} /></span>
      </button>
      {chosen > 0 && (
        <button type="button" className="gk-round gk-round--small gk-unit__minus" aria-label={t('launch.fewer', { name })} {...fewer}>
          <span className="gk-round__face"><Glyph id="minus" /></span>
        </button>
      )}
      <div className="gk-unit__foot">
        <ProgressBar value={chosen} max={home} />
        <Chip label={t('launch.max', { name })} onPress={() => { change(home); }} disabled={full}>{t('launch.maxShort')}</Chip>
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
  return (
    <button type="button" className="gk-bay" aria-pressed={selected} onPointerDown={own.onPointerDown} onClick={own.onClick}>
      <span className="gk-bay__class"><Emblem cls={cls} /></span>
      {multiplier !== null && multiplier !== 1 && (
        <span className="gk-bay__corner"><MultiplierBadge value={multiplier} /></span>
      )}
      <span className="mt-5 flex items-baseline gap-0.5">
        <span className={`gk-bay__count gk-display gk-num gk-outlined${chosen > 0 ? ' gk-tone-self' : ''}`}>{chosen}</span>
        <span className="gk-bay__of gk-display gk-num">/{home}</span>
      </span>
      <img className="gk-bay__art" src={art} alt="" />
      <span className="gk-bay__name">{name}</span>
    </button>
  );
}
