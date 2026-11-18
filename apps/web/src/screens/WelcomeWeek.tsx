import { WELCOME_WEEK } from '@astera/rules';
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useOpenWelcome, useWelcome } from '../api/queries.js';
import { Glyph } from '../game-ui/index.js';
import { compact } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { roughDuration, useNow } from '../lib/time.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { describe, useToast } from '../ui/Toast.js';
import { welcomeBoard, type WelcomeCell } from './welcomeBoard.js';
import './welcome.css';

/*
  VFX brief (owner 2026-11-18: every effect is its own event).
  - In the world: a supply crate's latches give under the thumb. Its lid strains and lifts while you
    hold, then blows off and spins away; what it held leaps out of the open crate into your store, and
    sparks scrape off the latches. The open, empty crate stays where it stood.
  - Assets: Synty POLYGON Sci-Fi Space `SM_Prop_Crate_01` (silver lid, texture B) for boxes 1–6 and
    `SM_Prop_Crate_Wide_01` (gold lid, texture A) for the seventh, each rendered as body and lid apart in
    the game's light (`assets/images/welcome/`); the haul is the resources' own art; sparks are hard streaks.
  - Why: a lid that flies and goods that jump out are what opening a crate is; the empty crate says "taken".
*/
const CRATE = {
  small: { body: '/assets/images/welcome/crate-small-body.webp', lid: '/assets/images/welcome/crate-small-lid.webp' },
  big: { body: '/assets/images/welcome/crate-big-body.webp', lid: '/assets/images/welcome/crate-big-lid.webp' },
} as const;
/** As long as a launch's hold: one gesture that cannot happen by accident. */
const HOLD_MS = 600;
/** The lid's flight and the haul's leap, before the box reads as opened. */
const OPEN_MS = 1_100;
/** How long the purse stays over the board. */
const POURED_MS = 2_600;
const SPARKS = Array.from({ length: 8 }, (_, i) => ({ '--a': `${String(i * 45 + 20)}deg`, animationDelay: `${String((i % 3) * 30)}ms` }) as CSSProperties);

interface Purse { alloy: number; crystal: number }

function Holds({ holds, estimate }: { holds: Purse; estimate: boolean }) {
  const { t } = useTranslation();
  return (
    <span className="ww-holds" {...(estimate ? { 'data-estimate': '', title: t('rewards.welcome.later') } : {})}>
      {(['crystal', 'alloy'] as const).map(resource => (
        <span key={resource} className={`ww-hold ww-hold--${resource}`} aria-label={`${compact(holds[resource])} ${t(`vocabulary.resource.${resource}`)}`}>
          <img src={RESOURCE_ART[resource]} alt="" draggable={false} />
          {estimate && <span aria-hidden="true">≈</span>}{compact(holds[resource])}
        </span>
      ))}
    </span>
  );
}

/** The crate itself, body and lid apart so the lid can fly; once opened only the empty body stands. */
function Crate({ big, opened, opening }: { big: boolean; opened: boolean; opening: boolean }) {
  const art = big ? CRATE.big : CRATE.small;
  return (
    <span className="ww-crate" aria-hidden="true">
      <span className="ww-shadow" />
      <img className="ww-body" src={art.body} alt="" draggable={false} />
      {!opened && <img className="ww-lid" src={art.lid} alt="" draggable={false} />}
      {opening && (
        <>
          {SPARKS.map((style, i) => <span key={i} className="ww-spark" style={style} />)}
          <img className="ww-haul ww-haul--a" src={RESOURCE_ART.crystal} alt="" draggable={false} />
          <img className="ww-haul ww-haul--b" src={RESOURCE_ART.alloy} alt="" draggable={false} />
          <img className="ww-haul ww-haul--c" src={RESOURCE_ART.crystal} alt="" draggable={false} />
        </>
      )}
    </span>
  );
}

function Box({ cell, opening, fresh, onOpen }: { cell: WelcomeCell; opening: boolean; fresh: boolean; onOpen: () => void }) {
  const { t } = useTranslation();
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const title = t('rewards.welcome.title', { box: cell.box, of: WELCOME_WEEK.boxes });
  const state = opening ? 'ready' : cell.state;
  const wait = cell.state === 'waiting' && cell.readyInMs !== null ? t('rewards.welcome.wait', { time: roughDuration(cell.readyInMs / 60_000) }) : null;

  const stop = (): void => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  const commit = (): void => { stop(); onOpen(); };
  const start = (): void => {
    if (timer.current !== null) return;
    playSound('rattle');
    haptic('tap');
    setHolding(true);
    timer.current = window.setTimeout(() => { timer.current = null; commit(); }, HOLD_MS);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    commit();
  };
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  const face = (
    <>
      <span className="ww-num">{cell.box}</span>
      {state === 'opened' && <span className="ww-check"><Glyph id="check" className="gk-glyph" /></span>}
      <Crate big={cell.big} opened={state === 'opened'} opening={opening} />
      {/* The wait sits on the crate it belongs to, not on a line of its own. */}
      {wait && <span className="ww-wait"><Glyph id="clock" className="gk-glyph" />{wait}</span>}
      <span className="ww-foot">
        {cell.big && <span className="ww-big">{t('rewards.welcome.big')}<b>×{WELCOME_WEEK.hours[cell.box - 1]}</b></span>}
        {cell.holds && state !== 'opened' && <Holds holds={cell.holds} estimate={state === 'later'} />}
        {/* The plate under the thumb: hold here. */}
        {state === 'ready' && !opening && <span className="ww-plate">{t('rewards.welcome.hold')}</span>}
      </span>
    </>
  );
  const marks = {
    'data-testid': `welcome-box-${String(cell.box)}`,
    'data-state': opening ? 'opening' : cell.state,
    ...(cell.big ? { 'data-big': '' } : {}),
    ...(fresh ? { 'data-fresh': '' } : {}),
  };
  if (cell.state === 'ready' || opening) {
    const purse = cell.holds ? `${compact(cell.holds.crystal)} ${t('vocabulary.resource.crystal')}, ${compact(cell.holds.alloy)} ${t('vocabulary.resource.alloy')}` : '';
    return (
      <div className="ww-cell" {...marks} {...(holding ? { 'data-holding': '' } : {})}>
        <button type="button" className="ww-hit" disabled={opening}
          aria-label={`${title} · ${t('rewards.welcome.ready')}. ${t('rewards.welcome.hold')}: ${purse}`}
          onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
          onKeyDown={onKeyDown} onContextMenu={(event) => { event.preventDefault(); }}>
          {face}
        </button>
      </div>
    );
  }
  const said = cell.state === 'opened' ? t('rewards.welcome.opened') : wait ?? t('rewards.welcome.later');
  return <div className="ww-cell" role="group" aria-label={`${title} · ${said}`} {...marks}>{face}</div>;
}

/**
 * NEW COMMANDER 7 DAYS AS ONE BOARD (owner 2026-11-18: "7 günlük ödül tablosu", after the boards of
 * other games). The week at a glance: the opened crates standing empty, the one to open now with what it
 * holds, the wait for the next, and those ahead at today's output, the seventh the big gold one. The
 * ready crate opens where it stands, with the crate's own hold. `titled` off: the host names it.
 */
export function WelcomeWeek({ titled = true }: { titled?: boolean }) {
  const { t } = useTranslation();
  const say = useToast();
  const now = useNow(30_000);
  const welcome = useWelcome().data?.welcome;
  const open = useOpenWelcome();
  const [opening, setOpening] = useState<number | null>(null);
  /** The box just opened: its stamp lands once, not on every visit. */
  const [fresh, setFresh] = useState<number | null>(null);
  const [poured, setPoured] = useState<Purse | null>(null);

  useEffect(() => {
    if (opening === null) return undefined;
    const done = window.setTimeout(() => { setFresh(opening); setOpening(null); }, OPEN_MS);
    return () => { window.clearTimeout(done); };
  }, [opening]);
  useEffect(() => {
    if (!poured) return undefined;
    const clear = window.setTimeout(() => { setPoured(null); }, POURED_MS);
    return () => { window.clearTimeout(clear); };
  }, [poured]);

  const board = welcomeBoard(welcome, now);
  if (!board || (welcome?.box == null && opening === null && !poured)) return null;
  const opened = board.filter(cell => cell.state === 'opened').length;

  const openBox = (box: number) => {
    playSound('crate');
    haptic('commit');
    setOpening(box);
    open.mutate(undefined, {
      onSuccess: (result) => { setPoured(result.granted); },
      onError: (error) => { setOpening(null); say(describe(error), 'error'); },
    });
  };

  return (
    <section data-testid="welcome-week" className="ww" aria-label={t('rewards.welcome.board')}>
      <header className="ww-head">
        {/* A host that already names the board (the landing's ribbon) keeps the count and drops the name. */}
        {titled && <h3 className="v2-legend">{t('rewards.welcome.board')}</h3>}
        <span className="ww-count">{opened}/{WELCOME_WEEK.boxes}</span>
      </header>
      <p data-testid="welcome-rule" className="ww-rule">
        {t('rewards.welcome.rule', { hours: WELCOME_WEEK.hours[0], big: WELCOME_WEEK.hours[WELCOME_WEEK.boxes - 1], gap: WELCOME_WEEK.gapHours })}
      </p>
      <div className="ww-grid">
        {board.map(cell => <Box key={cell.box} cell={cell} opening={opening === cell.box} fresh={fresh === cell.box} onOpen={() => { openBox(cell.box); }} />)}
      </div>
      {poured && (
        <p data-testid="welcome-poured" className="ww-poured" aria-live="polite">
          {t('rewards.welcome.poured', { purse: `+${compact(poured.crystal)} ${t('vocabulary.resource.crystal')} · +${compact(poured.alloy)} ${t('vocabulary.resource.alloy')}` })}
        </p>
      )}
    </section>
  );
}
