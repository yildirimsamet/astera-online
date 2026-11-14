import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
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
    <button type="button" role="switch" aria-checked={checked} className="gk-toggle" {...OWN_SOUND} onPointerDown={own.onPointerDown} onClick={own.onClick}>
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
    <div className="gk-lever" {...OWN_SOUND}>
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
export function Slider({ label, value, max, onChange, readout }: {
  label: string;
  value: number;
  max: number;
  onChange: (next: number) => void;
  /** A level (a volume) says where it stands in place of the max button: "all of it" means nothing there. */
  readout?: string;
}) {
  const { t } = useTranslation();
  const dragging = useRef(false);
  const start = useRef<number | null>(null);
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
    <div className="gk-slider" {...OWN_SOUND}>
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
        // Like the lever: the track takes the pointer only once it travels sideways, so a thumb scrolling
        // the sheet passes over it (touch-action pan-y); a tap still jumps to where it landed.
        onPointerDown={(event) => { start.current = event.clientX; dragging.current = false; }}
        onPointerMove={(event) => {
          if (start.current === null) return;
          if (!dragging.current && Math.abs(event.clientX - start.current) < 6) return;
          if (!dragging.current) { dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); }
          set(sliderValue(along(event), max));
        }}
        onPointerUp={(event) => {
          if (start.current !== null && !dragging.current) set(sliderValue(along(event), max));
          start.current = null;
          dragging.current = false;
        }}
        onPointerCancel={() => { start.current = null; dragging.current = false; }}
      >
        <span className="gk-slider__rail"><span className="gk-slider__fill" style={{ width: `${String(share)}%` }} /></span>
        <span className="gk-slider__knob" style={{ left: `${String(share)}%` }} />
      </div>
      <button type="button" className="gk-round gk-round--small" aria-label={t('launch.more', { name: label })} {...more}>
        <span className="gk-round__face"><Glyph id="plus" /></span>
      </button>
      {readout === undefined
        ? <Chip label={t('launch.max', { name: label })} onPress={() => { set(max); }} disabled={value === max}>{t('launch.maxShort')}</Chip>
        : <output className="gk-slider__level gk-num">{readout}</output>}
    </div>
  );
}

/**
 * A SETTING'S CHOICES (G1-f, 2026-11-14): a few named positions on metal plates, the chosen one
 * lit as an open tab is. A radio group, since choosing one is the whole act: it takes effect on
 * the press, and the arrows walk it with one stop for the Tab key.
 */
export function Choices<T extends string>({ label, options, value, onChange }: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  const choose = (id: T): void => {
    if (id === value) return;
    playSound('tab');
    haptic('tap');
    onChange(id);
  };
  const walk = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const at = stepTo(event.key, options.findIndex((option) => option.id === value), options.length);
    const next = options[at];
    if (next === undefined || next.id === value) return;
    event.preventDefault();
    choose(next.id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[at]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="gk-tabs gk-choices" {...OWN_SOUND}>
      {options.map((option) => (
        <ChoicePlate key={option.id} label={option.label} chosen={option.id === value} onChoose={() => { choose(option.id); }} onKeyDown={walk} />
      ))}
    </div>
  );
}

function ChoicePlate({ label, chosen, onChoose, onKeyDown }: {
  label: string;
  chosen: boolean;
  onChoose: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const own = useOwnPress(onChoose);
  return (
    <button type="button" role="radio" aria-checked={chosen} tabIndex={chosen ? 0 : -1} className="gk-tab"
      onPointerDown={own.onPointerDown} onClick={own.onClick} onKeyDown={onKeyDown}>
      {label}
    </button>
  );
}

/** A setting that opens somewhere else, saying on its line where it stands (G1-f). */
export function SettingLink({ label, name, value, onPress }: {
  label: string;
  /** A fuller name for a reader than the line's short one ("Privacy & cookie settings"). */
  name?: string;
  value: string;
  onPress: () => void;
}) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onPress(); });
  return (
    <button type="button" {...OWN_SOUND} className="gk-setlink" {...(name === undefined ? {} : { 'aria-label': `${name}. ${value}` })}
      onPointerDown={own.onPointerDown} onClick={own.onClick}>
      <span className="gk-label gk-setlink__label">{label}</span>
      <span className="gk-setlink__value">{value}</span>
      <span className="gk-setlink__go" aria-hidden="true"><Glyph id="next" /></span>
    </button>
  );
}

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  /** What opens it; a locked tab says this instead of opening. */
  locked?: string | null;
  badge?: number;
  /** The tab's whole name as a reader hears it, with what its count means ("Clan — 2 unread"); the eye reads the count (C2). */
  spoken?: string;
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
      <div role="tablist" aria-label={label} className="gk-tabs" {...OWN_SOUND} onKeyDown={walk}>
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
      {...(tab.mark ? { 'aria-label': tab.mark.hint } : tab.spoken === undefined ? {} : { 'aria-label': tab.spoken })}
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
  /** What waits behind the place, said to a reader after its name. */
  said?: string;
  /** A count that is a state, not news (craft in the air): quiet, never the red of news. */
  tally?: number;
  /** A gap to close behind the place (a fault to repair): a warning dot with no number. */
  warn?: boolean;
  /** 0…1 toward the next thing there (the next landing): a ring round the art. */
  progress?: number | null;
  /** Just opened: the place shines and wears this word until pressed. */
  fresh?: string;
  /** Keeps its place but does nothing (a season with no clan layer): the order never moves. */
  disabled?: boolean;
  /** The key that opens it; the desk bar shows it. */
  shortcut?: string;
  /** A lesson's handle on the place. */
  guide?: string;
}

/** How long the bottom bar's "locked" word stays over the game. */
const REFUSED_MS = 2_500;

/**
 * THE BOTTOM BAR: painted art for each place; the current one rises and glows.
 * A locked place shows its padlock and, pressed, says what opens it. Each place says
 * what waits behind it without being opened: news in red, a state in a quiet count,
 * a gap to close in a warning dot, the next landing in a ring.
 *
 * `clear` lets the galaxy through (owner, 2026-09-24: no ground while the scene is
 * the page); `bar` sits the same places in a desk's top bar, each with its key.
 * A press on the open place goes to `onReselect` (the galaxy's: fly home).
 */
export function BottomNav({ label, items, value, onChange, onReselect, clear = false, bar = false }: {
  label: string;
  items: readonly NavItem[];
  /** The open place; null while a page from elsewhere is (the bell, the commander). */
  value: string | null;
  onChange: (id: string) => void;
  onReselect?: (id: string) => void;
  clear?: boolean;
  bar?: boolean;
}) {
  const [refused, setRefused] = useState<string | null>(null);
  // The word floats over the game: it says its piece and goes.
  useEffect(() => {
    if (refused === null) return undefined;
    const gone = window.setTimeout(() => { setRefused(null); }, REFUSED_MS);
    return () => { window.clearTimeout(gone); };
  }, [refused]);
  return (
    <nav
      aria-label={label}
      className={`gk gk-nav relative${bar ? ' gk-nav--bar' : ''}`}
      {...(bar ? { 'data-bar': '' } : clear ? { 'data-clear': '' } : {})}
      {...OWN_SOUND}
    >
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
          bar={bar}
          onPress={() => {
            if (item.locked) { playSound('refuse'); haptic('warn'); setRefused(item.locked); return; }
            setRefused(null);
            playSound('tab');
            haptic('tap');
            if (item.id === value) onReselect?.(item.id);
            else onChange(item.id);
          }}
        />
      ))}
    </nav>
  );
}

function NavButton({ item, current, bar, onPress }: { item: NavItem; current: boolean; bar: boolean; onPress: () => void }) {
  const own = useOwnPress(onPress);
  const ring = item.progress ?? null;
  const turn: CssVars = { '--turn': `${String(ring ?? 0)}turn` };
  return (
    <button
      type="button"
      className="gk-nav__item"
      aria-label={item.said === undefined ? item.label : `${item.label} · ${item.said}`}
      disabled={item.disabled}
      {...(item.shortcut === undefined ? {} : { 'aria-keyshortcuts': item.shortcut })}
      {...(item.guide === undefined ? {} : { 'data-guide': item.guide })}
      {...(current ? { 'aria-current': 'page' } : {})}
      {...(item.locked ? { 'data-locked': '' } : {})}
      {...(item.fresh === undefined ? {} : { 'data-fresh': '' })}
      onPointerDown={own.onPointerDown}
      onClick={own.onClick}
    >
      <span className="gk-nav__pic">
        {ring !== null && (
          <span
            data-ring=""
            data-progress={String(Math.round(ring * 100) / 100)}
            aria-hidden="true"
            className="gk-nav__ring"
            style={turn}
          />
        )}
        {item.art && <img className="gk-nav__art" src={item.art} alt="" />}
        {item.locked && <span className="gk-nav__lock"><Glyph id="lock" /></span>}
        {item.badge !== undefined && item.badge > 0 && <span className="gk-nav__badge"><Dot count={item.badge} /></span>}
        {item.tally !== undefined && item.tally > 0 && <span data-tally="" aria-hidden="true" className="gk-nav__tally gk-num">{item.tally > 99 ? '99+' : item.tally}</span>}
        {item.warn && <span data-warn="" aria-hidden="true" className="gk-nav__warn" />}
        {item.fresh !== undefined && <span aria-hidden="true" className="gk-nav__fresh">{item.fresh}</span>}
      </span>
      <span className="gk-nav__label">{item.label}</span>
      {bar && item.shortcut !== undefined && <kbd className="gk-nav__key gk-num">{item.shortcut}</kbd>}
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
  const choose = (language: Language): void => {
    if (language === value) return;
    playSound('tap');
    haptic('tap');
    onChange(language);
  };
  // One stop for the Tab key; the arrows walk the languages, as in any radio group.
  const walk = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (LANGUAGES.indexOf(value) + step + LANGUAGES.length) % LANGUAGES.length;
    const language = LANGUAGES[next];
    if (language === undefined) return;
    choose(language);
    event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="gk-langs" {...OWN_SOUND}>
      {LANGUAGES.map((language) => (
        <LanguageOption key={language} language={language} chosen={language === value} onChoose={() => { choose(language); }} onKeyDown={walk} />
      ))}
    </div>
  );
}

function LanguageOption({ language, chosen, onChoose, onKeyDown }: {
  language: Language;
  chosen: boolean;
  onChoose: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const own = useOwnPress(onChoose);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      tabIndex={chosen ? 0 : -1}
      className="gk-lang"
      onPointerDown={own.onPointerDown}
      onClick={own.onClick}
      onKeyDown={onKeyDown}
    >
      <img className="gk-lang__flag" src={LANGUAGE_FLAG[language]} alt="" width={40} height={41} draggable={false} />
      <span className="gk-lang__name">{LANGUAGE_LABEL[language]}</span>
      {chosen && <span className="gk-lang__tick"><Glyph id="check" /></span>}
    </button>
  );
}
