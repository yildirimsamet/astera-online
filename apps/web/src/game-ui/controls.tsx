import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { Chip } from './buttons.js';
import { Glyph, type GlyphId } from './icons.js';
import { nearestDetent, sliderValue } from './logic.js';
import { Dot } from './readouts.js';
import type { CssVars } from './style.js';
import { useRepeatPress } from './useRepeatPress.js';
import { LANGUAGES, LANGUAGE_LABEL, type Language } from '../i18n/languages.js';

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
    playSound('lever');
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
    playSound('lever', { gain: 0.6 });
    haptic('tap');
    onChange(option.id);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = index + step;
    if (next < 0 || next >= options.length) return;
    choose(next);
    // the focus follows the choice, as in any radio group: the old stop has left the tab order
    event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
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
    playSound('tick');
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

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  /** What opens it; a locked tab says this instead of opening. */
  locked?: string | null;
  badge?: number;
  /** A fact about what is under the tab (something stopped): its glyph, and what it means to a reader. */
  mark?: { glyph: GlyphId; hint: string };
  /** A picture of the place beside its name, in its own tone (the word stays the name). */
  glyph?: { id: GlyphId; tone: 'alloy' | 'crystal' | 'deut' | 'self' | 'good' | 'warn' | 'hostile' | 'info' };
}

/** The keys that walk a tablist: arrows wrap round the ends, Home and End jump. */
const stepTo = (key: string, index: number, count: number): number =>
  key === 'ArrowRight' ? (index + 1) % count
  : key === 'ArrowLeft' ? (index - 1 + count) % count
  : key === 'Home' ? 0
  : key === 'End' ? count - 1
  : -1;

/**
 * Tabs as metal plates; the open one is lit. A locked tab names what it needs. Only the
 * open tab sits in the tab order; the arrows walk the rest and the panel follows, since
 * switching costs nothing. `lessonMarks` puts `data-tab` on each, which is how a lesson
 * points at one (and lets one be pressed); only the tabs a lesson may use ask for it.
 */
export function GameTabs<T extends string>({ label, tabs, value, onChange, ids, lessonMarks = false }: {
  label: string;
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** The tab's own id and the panel it opens, for a reader to follow from one to the other. */
  ids?: { tab: (id: T) => string; panel: (id: T) => string };
  lessonMarks?: boolean;
}) {
  const [refused, setRefused] = useState<string | null>(null);
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  const walk = (event: KeyboardEvent<HTMLDivElement>): void => {
    const open = tabs.filter((tab) => !tab.locked);
    const next = open[stepTo(event.key, open.findIndex((tab) => tab.id === value), open.length)];
    if (!next || next.id === value) return;
    event.preventDefault();
    onChange(next.id);
    buttons.current.get(next.id)?.focus();
  };
  return (
    <div>
      <div role="tablist" aria-label={label} className="gk-tabs" onKeyDown={walk}>
        {tabs.map((tab) => (
          <GameTab
            key={tab.id}
            tab={tab}
            selected={tab.id === value}
            marked={lessonMarks}
            {...(ids ? { tabId: ids.tab(tab.id), panelId: ids.panel(tab.id) } : {})}
            onMount={(node) => {
              if (node) buttons.current.set(tab.id, node);
              else buttons.current.delete(tab.id);
            }}
            onPress={() => {
              if (tab.locked) { playSound('refuse'); haptic('warn'); setRefused(tab.locked); return; }
              setRefused(null);
              if (tab.id !== value) { playSound('tab'); haptic('tap'); onChange(tab.id); }
            }}
          />
        ))}
      </div>
      {refused !== null && <p role="status" className="gk-tabs__status"><Glyph id="lock" /> {refused}</p>}
    </div>
  );
}

function GameTab<T extends string>({ tab, selected, marked, tabId, panelId, onMount, onPress }: {
  tab: TabItem<T>;
  selected: boolean;
  marked: boolean;
  tabId?: string;
  panelId?: string;
  onMount: (node: HTMLButtonElement | null) => void;
  onPress: () => void;
}) {
  const own = useOwnPress(onPress);
  return (
    <button
      type="button"
      role="tab"
      ref={onMount}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      className="gk-tab"
      {...(marked ? { 'data-tab': tab.id } : {})}
      {...(tabId === undefined ? {} : { id: tabId })}
      {...(panelId === undefined ? {} : { 'aria-controls': panelId })}
      {...(tab.mark ? { 'aria-label': tab.mark.hint } : {})}
      {...(tab.locked ? { 'data-locked': '' } : {})}
      onPointerDown={own.onPointerDown}
      onClick={own.onClick}
    >
      {tab.locked && <Glyph id="lock" />}
      {tab.glyph && (
        <span className="gk-tab__glyph" aria-hidden="true" style={{ color: `var(--gk-${tab.glyph.tone})` }}><Glyph id={tab.glyph.id} /></span>
      )}
      {tab.label}
      {tab.mark && <span className="gk-tab__mark"><Glyph id={tab.mark.glyph} /></span>}
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
            if (item.locked) { playSound('refuse'); haptic('warn'); setRefused(item.locked); return; }
            setRefused(null);
            if (item.id !== value) { playSound('tab'); haptic('tap'); onChange(item.id); }
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
export function InfoPeek({ fact, rule, lead, about }: { fact: ReactNode; rule: ReactNode; lead?: ReactNode; about?: string }) {
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
          aria-label={about ?? t('counter.compareRuleToggle')}
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

/** Each language's flag (Layer Lab `languageflag-large-*`), in `public/assets/ui/lang/`. */
export const LANGUAGE_FLAG: Record<Language, string> = {
  tr: '/assets/ui/lang/tr.webp',
  en: '/assets/ui/lang/en.webp',
  fr: '/assets/ui/lang/fr.webp',
  de: '/assets/ui/lang/de.webp',
  es: '/assets/ui/lang/es.webp',
  ja: '/assets/ui/lang/ja.webp',
};

/**
 * THE LANGUAGE CHOICE: every language the game speaks, each named in itself beside its
 * flag, so a player lost in a language they cannot read still finds their own.
 */
export function LanguagePicker({ label, value, onChange }: { label: string; value: Language; onChange: (language: Language) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="gk-langs">
      {LANGUAGES.map((language) => (
        <LanguageOption key={language} language={language} chosen={language === value} onChoose={() => { onChange(language); }} />
      ))}
    </div>
  );
}

function LanguageOption({ language, chosen, onChoose }: { language: Language; chosen: boolean; onChoose: () => void }) {
  const own = useOwnPress(() => {
    if (chosen) return;
    playSound('tap');
    haptic('tap');
    onChoose();
  });
  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      className="gk-lang"
      onPointerDown={own.onPointerDown}
      onClick={own.onClick}
    >
      <img className="gk-lang__flag" src={LANGUAGE_FLAG[language]} alt="" width={40} height={41} draggable={false} />
      <span className="gk-lang__name">{LANGUAGE_LABEL[language]}</span>
      {chosen && <span className="gk-lang__tick"><Glyph id="check" /></span>}
    </button>
  );
}
