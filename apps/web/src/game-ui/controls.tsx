import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { Chip } from './buttons.js';
import { Glyph } from './icons.js';
import { nearestDetent, sliderValue } from './logic.js';
import { Dot } from './readouts.js';
import type { CssVars } from './style.js';
import { useRepeatPress } from './useRepeatPress.js';

/** Where along an element a pointer is, 0…1. */
const along = (event: PointerEvent<HTMLElement>): number => {
  const box = event.currentTarget.getBoundingClientRect();
  return box.width <= 0 ? 0 : (event.clientX - box.left) / box.width;
};

/**
 * A SWITCH YOU THROW. A metal housing, a knob that slides with a little overshoot, a
 * lamp that lights teal when it is on; it clacks and thunks.
 */
export function Toggle({
  checked, onChange, label, sub, art,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  sub?: ReactNode;
  art?: string;
}) {
  const own = useOwnPress(() => {
    playSound('switch');
    haptic('thunk');
    onChange(!checked);
  });
  return (
    <button type="button" role="switch" aria-checked={checked} className="gk-toggle" onPointerDown={own.onPointerDown} onClick={own.onClick}>
      {art && <img className="gk-toggle__art" src={art} alt="" />}
      <span className="gk-toggle__words">
        <span className="gk-toggle__label">{label}</span>
        {sub !== undefined && <span className="gk-sub">{sub}</span>}
      </span>
      <span className="gk-switch" aria-hidden="true">
        <span className="gk-switch__lamp" />
        <span className="gk-switch__knob" />
      </span>
    </button>
  );
}

export interface LeverOption {
  id: string;
  label: string;
}

/**
 * A LEVER WITH DETENTS: a handle that snaps between positions. Press a position or
 * drag the handle; arrow keys move one notch. Each notch clicks.
 */
export function Lever({
  label, options, value, onChange, note,
}: {
  label: string;
  options: readonly LeverOption[];
  value: string;
  onChange: (id: string) => void;
  note?: ReactNode;
}) {
  const index = Math.max(0, options.findIndex((option) => option.id === value));
  const dragging = useRef(false);
  const start = useRef<number | null>(null);
  const labelId = useId();
  const choose = (next: number): void => {
    const option = options[next];
    if (!option || next === index) return;
    playSound('switch', { gain: 0.6 });
    haptic('tap');
    onChange(option.id);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); choose(index + 1); }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); choose(index - 1); }
  };
  const style: CssVars = { '--n': options.length, '--i': index };
  return (
    <div className="gk-lever">
      <div className="flex items-baseline justify-between gap-2">
        <span id={labelId} className="gk-label">{label}</span>
        {note !== undefined && <span className="gk-sub">{note}</span>}
      </div>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="gk-lever__track"
        style={style}
        onPointerDown={(event) => { start.current = event.clientX; dragging.current = false; }}
        onPointerMove={(event) => {
          // A tap must reach the stop it landed on, so the track only takes the pointer once it travels.
          if (start.current === null) return;
          if (!dragging.current && Math.abs(event.clientX - start.current) < 6) return;
          if (!dragging.current) { dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); }
          choose(nearestDetent(along(event), options.length));
        }}
        onPointerUp={() => { start.current = null; dragging.current = false; }}
        onPointerCancel={() => { start.current = null; dragging.current = false; }}
      >
        <span className="gk-lever__handle" aria-hidden="true" />
        {options.map((option, i) => (
          <LeverStop key={option.id} label={option.label} checked={i === index} onPress={() => { choose(i); }} onKeyDown={onKeyDown} />
        ))}
      </div>
    </div>
  );
}

function LeverStop({ label, checked, onPress, onKeyDown }: {
  label: string;
  checked: boolean;
  onPress: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const own = useOwnPress(onPress);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      tabIndex={checked ? 0 : -1}
      className="gk-lever__stop"
      onPointerDown={own.onPointerDown}
      onClick={own.onClick}
      onKeyDown={onKeyDown}
    >
      {label}
    </button>
  );
}

/**
 * A SLIDER FOR A COUNT: drag the knob, nudge with − and + (hold to run), or send
 * everything with MAX. Ticks as it moves.
 */
export function Slider({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (next: number) => void }) {
  const { t } = useTranslation();
  const dragging = useRef(false);
  const set = (next: number): void => {
    const clamped = Math.min(max, Math.max(0, next));
    if (clamped === value) return;
    playSound('tap', { gain: 0.35 });
    if (clamped === 0 || clamped === max) haptic('thunk');
    onChange(clamped);
  };
  const fewer = useRepeatPress((n) => { set(value - n); }, value > 0, max);
  const more = useRepeatPress((n) => { set(value + n); }, value < max, max);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const page = Math.max(1, Math.round(max / 10));
    const moves: Record<string, number> = {
      ArrowRight: value + 1, ArrowUp: value + 1, ArrowLeft: value - 1, ArrowDown: value - 1,
      PageUp: value + page, PageDown: value - page, Home: 0, End: max,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    set(next);
  };
  const share = max <= 0 ? 0 : (value / max) * 100;
  return (
    <div className="gk-slider">
      <button type="button" className="gk-round gk-round--small" aria-label={t('launch.fewer', { name: label })} {...fewer}>
        <span className="gk-round__face"><Glyph id="minus" /></span>
      </button>
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className="gk-slider__track"
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          set(sliderValue(along(event), max));
        }}
        onPointerMove={(event) => { if (dragging.current) set(sliderValue(along(event), max)); }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
      >
        <span className="gk-slider__rail"><span className="gk-slider__fill" style={{ width: `${String(share)}%` }} /></span>
        <span className="gk-slider__knob" style={{ left: `${String(share)}%` }} />
      </div>
      <button type="button" className="gk-round gk-round--small" aria-label={t('launch.more', { name: label })} {...more}>
        <span className="gk-round__face"><Glyph id="plus" /></span>
      </button>
      <Chip label={t('launch.max', { name: label })} onPress={() => { set(max); }} disabled={value === max}>{t('launch.maxShort')}</Chip>
    </div>
  );
}

export interface TabItem {
  id: string;
  label: string;
  /** What opens it; a locked tab says this instead of opening. */
  locked?: string | null;
  badge?: number;
}

/** Tabs as metal plates; the open one is lit. A locked tab names what it needs. */
export function GameTabs({ label, tabs, value, onChange }: { label: string; tabs: readonly TabItem[]; value: string; onChange: (id: string) => void }) {
  const [refused, setRefused] = useState<string | null>(null);
  return (
    <div>
      <div role="tablist" aria-label={label} className="gk-tabs">
        {tabs.map((tab) => (
          <GameTab
            key={tab.id}
            tab={tab}
            selected={tab.id === value}
            onPress={() => {
              if (tab.locked) { haptic('warn'); setRefused(tab.locked); return; }
              setRefused(null);
              if (tab.id !== value) { playSound('tap'); haptic('tap'); onChange(tab.id); }
            }}
          />
        ))}
      </div>
      {refused !== null && <p role="status" className="gk-tabs__status"><Glyph id="lock" /> {refused}</p>}
    </div>
  );
}

function GameTab({ tab, selected, onPress }: { tab: TabItem; selected: boolean; onPress: () => void }) {
  const own = useOwnPress(onPress);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className="gk-tab"
      {...(tab.locked ? { 'data-locked': '' } : {})}
      onPointerDown={own.onPointerDown}
      onClick={own.onClick}
    >
      {tab.locked && <Glyph id="lock" />}
      {tab.label}
      {tab.badge !== undefined && tab.badge > 0 && <Dot count={tab.badge} />}
    </button>
  );
}

export interface NavItem extends TabItem {
  art?: string;
}

/**
 * THE BOTTOM BAR: painted art for each place; the current one rises and glows.
 * A locked place shows its padlock and, pressed, says what opens it.
 */
export function BottomNav({ label, items, value, onChange }: { label: string; items: readonly NavItem[]; value: string; onChange: (id: string) => void }) {
  const [refused, setRefused] = useState<string | null>(null);
  return (
    <nav aria-label={label} className="gk gk-nav relative">
      {refused !== null && (
        <p role="status" className="gk-nav__status gk-banner gk-banner--warn gk-banner--toast">
          <span className="gk-banner__icon"><Glyph id="lock" /></span>
          <span className="gk-banner__title">{refused}</span>
          <span />
        </p>
      )}
      {items.map((item) => (
        <NavButton
          key={item.id}
          item={item}
          current={item.id === value}
          onPress={() => {
            if (item.locked) { haptic('warn'); setRefused(item.locked); return; }
            setRefused(null);
            if (item.id !== value) { playSound('tap'); haptic('tap'); onChange(item.id); }
          }}
        />
      ))}
    </nav>
  );
}

function NavButton({ item, current, onPress }: { item: NavItem; current: boolean; onPress: () => void }) {
  const own = useOwnPress(onPress);
  return (
    <button
      type="button"
      className="gk-nav__item"
      {...(current ? { 'aria-current': 'page' } : {})}
      {...(item.locked ? { 'data-locked': '' } : {})}
      onPointerDown={own.onPointerDown}
      onClick={own.onClick}
    >
      {item.art && <img className="gk-nav__art" src={item.art} alt="" />}
      {item.locked && <span className="gk-nav__lock"><Glyph id="lock" /></span>}
      {item.badge !== undefined && item.badge > 0 && <span className="gk-nav__badge"><Dot count={item.badge} /></span>}
      <span className="gk-nav__label">{item.label}</span>
    </button>
  );
}

/**
 * THE FACT ON THE ROW, THE RULE ONE TAP AWAY. Progressive disclosure: the line says
 * what is true here; "?" opens why, in place, without leaving the decision.
 */
export function InfoPeek({ fact, rule, lead }: { fact: ReactNode; rule: ReactNode; lead?: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ruleId = useId();
  const own = useOwnPress(() => { playSound('tap'); setOpen((was) => !was); });
  return (
    <div>
      <div className="gk-peek__row">
        {lead}
        <span className="gk-peek__fact">{fact}</span>
        <button
          type="button"
          className="gk-round gk-round--small"
          aria-label={t('counter.compareRuleToggle')}
          aria-expanded={open}
          aria-controls={ruleId}
          onPointerDown={own.onPointerDown}
          onClick={own.onClick}
        >
          <span className="gk-round__face"><Glyph id="help" /></span>
        </button>
      </div>
      {open && <p id={ruleId} className="gk-peek__rule gk-well">{rule}</p>}
    </div>
  );
}

/** A text field set into the panel like a glass slot. */
export function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (next: string) => void; placeholder?: string }) {
  const id = useId();
  return (
    <div className="gk-field">
      <label htmlFor={id} className="gk-label">{label}</label>
      <input id={id} className="gk-field__input" value={value} placeholder={placeholder} onChange={(event) => { onChange(event.target.value); }} />
    </div>
  );
}
