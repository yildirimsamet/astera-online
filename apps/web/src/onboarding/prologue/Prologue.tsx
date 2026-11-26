import { STARTER, VESSEL_SYSTEMS, type CountryCode, type VesselHull, type VesselSystem } from '@astera/rules';
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { CommunityPolicyConsent } from '../../api/communityPolicySchemas.js';
import { describeError } from '../../i18n/errors.js';
import { full } from '../../lib/format.js';
import { haptic } from '../../lib/haptics.js';
import { playSound } from '../../lib/sound.js';
import { moduleArt, SYSTEM_ICON } from '../../starter/shipScreen.js';
import { RESOURCE_ART } from '../../ui/assets.js';
import { Icon } from '../../v2/icons.js';
import { ClaimDialog } from '../ClaimDialog.js';
import { TutorialHand } from '../TutorialHand.js';
import { prologueTelemetry } from './telemetry.js';
import './prologue.css';
import {
  BURN_MS, PATCH_MS, PROLOGUE_STEPS, clearPrologue, openPrologue, prologueAct, prologueBatch, prologueHeld, prologueHull, prologueLit, prologueShare, prologueStep,
  prologueTick, refineryRunning, restorePrologue, savePrologue, sensorsListening, type PrologueAction, type PrologueWorld,
} from './world.js';
import { useAppScreen } from '../../lib/appHeight.js';

const ART = '/assets/images/starter/prologue-bridge';
/** How long a hold control must be held: a deliberate act, never an accident. */
export const HOLD_MS = 850;
/** The breaker's swing home before the lights try. */
export const THROW_MS = 420;
/** Where the signal burns, as a share of the bridge art; the jump flies at wherever it is drawn. */
const SIGNAL_AT = { x: '84%', y: '23%' };
/** The furnace's roar and the torch end with what they belong to (item 1 halved the burn, made the patch a beat). */
const ROAR_S = BURN_MS / 1000 + 0.3;
const TORCH_S = PATCH_MS / 1000 + 0.3;
interface Point { x: string; y: string }
const HANDLE = '/assets/images/starter/prologue-breaker-handle';
/**
 * WHERE THE PAINTED BREAKER IS (owner 2026-11-27: painted into the `-v2` bridge frames), as shares of the
 * 1024×1536 art: the box at x 780–958, y 1152–1390; its slot centred on x 877 from y 1222 to 1318; the
 * lamp at (918.5, 1206.5). The lever is 100 art px wide (53 tall) and rides 53 px down the slot.
 */
const BREAKER_AT = {
  handle: { left: '80.76%', top: '78.78%', width: '9.77%' },
  lamp: { left: '89.7%', top: '78.55%' },
  hit: { left: '75%', top: '74.2%', width: '19.5%', height: '13.7%' },
  sparks: { left: '85.64%', top: '84.64%' },
  // Owner 2026-11-27, marked on a 375 px phone shot: the arrows run on the slot's line (x 877) from just under
  // the lever down the box's lower face (y 1309–1390). The plate over the box is placed in prologue.css.
  pull: { left: '85.64%', top: '85.2%' },
} as const;
/** The lever's travel down the slot, as a share of its own drawn height (53 of 53 art px). */
const HANDLE_TRAVEL = 1;

interface Props {
  onClaim: (username: string, password: string, progress: readonly [], country?: CountryCode, policy?: CommunityPolicyConsent, hull?: VesselHull) => Promise<void>;
  onSignIn: () => void;
  onLeave: () => void;
  /** From the menu, for a commander who already has an account: nothing to claim at the end. */
  replay?: boolean;
}

/** Each system, as the player has it right now. Five is the promise of the whole ship. */
function Systems({ world }: { world: PrologueWorld }) {
  const { t } = useTranslation();
  const tone = (system: VesselSystem): string => {
    if (system === 'REFINERY' && refineryRunning(world)) return 'border-v2-self text-v2-self shadow-[0_0_12px_-2px_var(--color-v2-self)]';
    if (system === 'SURVEY' && sensorsListening(world)) return 'border-v2-warn text-v2-warn prologue-pulse';
    return prologueLit(world) ? 'border-v2-hostile/70 text-v2-hostile' : 'border-v2-line text-v2-ink-3';
  };
  return (
    <ul data-testid="prologue-systems" className="flex justify-between gap-1">
      {VESSEL_SYSTEMS.map(system => (
        <li key={system} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
          <span className={`grid size-8 place-items-center rounded-full border bg-v2-void/70 transition-all duration-700 ${tone(system)}`}>
            <Icon id={SYSTEM_ICON[system]} className="size-4" />
          </span>
          <span className="max-w-full truncate text-micro leading-none text-v2-ink-2 [text-shadow:0_1px_3px_#000]">{t(`starter.systemShort.${system}`)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Flames licking up a furnace, and embers rising off it. Drawn with gradients: no light, no blur. */
function Fire({ strength }: { strength: number }) {
  const flames = [{ left: '30%', width: '22%', delay: '0s' }, { left: '44%', width: '26%', delay: '-0.3s' }, { left: '60%', width: '18%', delay: '-0.55s' }];
  return (
    <span data-testid="prologue-fire" aria-hidden="true" className="prologue-fire pointer-events-none absolute inset-0" style={{ opacity: 0.35 + 0.65 * strength }}>
      {flames.map(flame => (
        <span key={flame.left} className="prologue-flame" style={{ left: flame.left, width: flame.width, height: `${String(40 + 50 * strength)}%`, animationDelay: flame.delay }} />
      ))}
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className="prologue-ember" style={{ left: `${String(28 + ((index * 37) % 46))}%`, animationDelay: `${String(-index * 0.27)}s`, '--ex': `${String(((index * 13) % 30) - 15)}px` } as CSSProperties} />
      ))}
    </span>
  );
}

/** The machine at work: the same picture the real repair card shows, so nothing is strange afterwards. */
function Machine({ art, name, share, figure, burning, cold = false, tall = false, focus = '50% 50%', children }: { art: string; name: string; share: number; figure: string | null; burning: boolean; cold?: boolean; tall?: boolean; focus?: string; children?: ReactNode }) {
  return (
    <div data-testid="prologue-machine" className={`relative ${tall ? 'h-32' : 'h-28'} overflow-hidden rounded-control border bg-v2-void transition-colors duration-700 ${burning ? 'border-[#ff8a3d]/70 shadow-[0_0_24px_-6px_#ff7a2a]' : 'border-v2-line-hi'}`}>
      <img src={art} alt="" draggable={false} style={{ objectPosition: focus }} className={`absolute inset-0 size-full object-cover transition-[filter] duration-1000 ${burning ? 'brightness-125 saturate-150' : cold ? 'brightness-[0.4] grayscale-[0.7]' : 'opacity-90 brightness-75'}`} />
      <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-v2-void/90 via-transparent to-transparent" />
      {burning && <Fire strength={share} />}
      <div className="absolute inset-x-2 bottom-1.5 flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-caption font-semibold text-v2-ink [text-shadow:0_1px_3px_#000]">{name}</span>
          {figure && <span data-testid="prologue-figure" className="shrink-0 font-v2-mono text-caption text-v2-alloy [text-shadow:0_0_8px_#000]">{figure}</span>}
        </div>
        <span className="block h-1 overflow-hidden rounded-full bg-v2-void">
          <span className={`block h-full rounded-full ${burning ? 'bg-[#ff9a3d] shadow-[0_0_8px_#ff7a2a]' : 'bg-v2-self shadow-[0_0_8px_var(--color-v2-self)]'}`} style={{ width: `${String(Math.round(share * 100))}%` }} />
        </span>
      </div>
      {children}
    </div>
  );
}

/** Sparks off a struck contact, scattered once. */
function Sparks({ count = 10, at }: { count?: number; at: { left: string; top: string } }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute" style={at}>
      {Array.from({ length: count }, (_, index) => {
        const angle = (index / count) * Math.PI * 2 + index;
        const reach = 18 + ((index * 7) % 22);
        return <span key={index} className="prologue-spark" style={{ '--sx': `${String(Math.cos(angle) * reach)}px`, '--sy': `${String(Math.sin(angle) * reach - 6)}px`, animationDelay: `${String((index % 4) * 0.03)}s` } as CSSProperties} />;
      })}
    </span>
  );
}

/**
 * A PLASMA TORCH ON THE PATCH (owner playtest 2026-11-06: "çekiç daha modern bişey olsun"). The jet
 * flickers at the seam and the torch works along it while the sparks fly.
 */
function Torch({ at }: { at: { left: string; top: string } }) {
  return (
    <span aria-hidden="true" data-testid="prologue-torch" className="pointer-events-none absolute" style={at}>
      <svg viewBox="0 0 48 48" className="prologue-torch overflow-visible" style={{ left: '-10px', top: '-48px' }}>
        <defs>
          <radialGradient id="prologue-plasma-glow">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.35" stopColor="#9fe8ff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#3aa8ff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="prologue-torch-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6b7886" />
            <stop offset="1" stopColor="#1f262e" />
          </linearGradient>
        </defs>
        {/* Drawn lying along +x with the tip at the origin, then turned to point at the seam. */}
        <g transform="translate(8 40) rotate(-45)">
          <path d="M41 0c5 0 8 3 14 3" stroke="#0b0f14" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <ellipse className="prologue-plasma" cx="-4" cy="0" rx="6.5" ry="3.2" fill="url(#prologue-plasma-glow)" />
          <ellipse cx="-1.8" cy="0" rx="3" ry="1" fill="#ffffff" />
          <path d="M0 -1.5L7 -3L7 3L0 1.5Z" fill="#c98d55" stroke="#141a20" strokeWidth="0.8" />
          <rect x="7" y="-4" width="3" height="8" rx="1" fill="#cfd8e2" stroke="#141a20" strokeWidth="0.8" />
          <rect x="10" y="-2.5" width="10" height="5" fill="#8d9aa8" stroke="#141a20" strokeWidth="1" />
          <rect x="19" y="-5" width="22" height="10" rx="4" fill="url(#prologue-torch-body)" stroke="#0b0f14" strokeWidth="1.4" />
          <rect x="21" y="-3.6" width="18" height="1.6" rx="0.8" fill="#eef3f8" opacity="0.5" />
          <rect x="23" y="-5" width="2" height="10" fill="#7fd6ff" />
          <path d="M26 5h6l-1.5 3h-3z" fill="#3a4450" stroke="#0b0f14" strokeWidth="0.8" />
        </g>
      </svg>
    </span>
  );
}

/**
 * THE BREAKER (owner 2026-11-06: "en alttaki buton yerine bir şalter"). Pulled down, it lands with a
 * knock, the contact sparks, and only then do the lights try. A tap throws it too.
 *
 * ON THE CONSOLE (owner phone playtest 2026-11-27): at the foot of the screen the cookie note covered
 * it. Its box is painted into the bridge on the right-hand console, and only the lever is drawn here,
 * riding its slot. Its name stands beside it on a plate and the arrows run down beside the lever. Once
 * thrown (`settled`) it stays down in the slot, and its lit face comes on with the bridge's lights.
 */
function Breaker({ label, onThrow, settled, lit }: { label: string; onThrow: () => void; settled: boolean; lit: boolean }) {
  const [pull, setPull] = useState(settled ? 1 : 0);
  const [thrown, setThrown] = useState(settled);
  const [dragging, setDragging] = useState(false);
  // Once a finger has been on the breaker, the arrows saying "pull" have done their work (owner 2026-11-27).
  const [touched, setTouched] = useState(false);
  const drag = useRef<{ from: number; travel: number; moved: boolean } | null>(null);
  const handle = useRef<HTMLSpanElement>(null);
  const fire = () => {
    if (thrown) return;
    setThrown(true);
    setPull(1);
    playSound('switch');
    haptic('thunk');
    setTimeout(onThrow, THROW_MS);
  };
  const down = (event: PointerEvent<HTMLButtonElement>) => {
    if (thrown) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    // The finger travels as far as the lever is drawn to, and never less than a deliberate 24 px.
    const drawn = (handle.current?.getBoundingClientRect().height ?? 0) * HANDLE_TRAVEL;
    drag.current = { from: event.clientY, travel: Math.max(24, drawn), moved: false };
    setDragging(true);
    setTouched(true);
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current || thrown) return;
    const share = Math.min(1, Math.max(0, (event.clientY - drag.current.from) / drag.current.travel));
    if (share > 0.08) drag.current.moved = true;
    setPull(share);
    if (share >= 0.85) { drag.current = null; setDragging(false); fire(); }
  };
  const up = () => {
    if (!drag.current) return;
    const tapped = !drag.current.moved;
    drag.current = null;
    setDragging(false);
    if (tapped) fire(); else setPull(0);
  };
  return (
    <div data-testid="prologue-console" data-breaker={thrown ? 'down' : 'up'} className={`prologue-breaker absolute inset-0 ${thrown ? 'is-thrown' : ''}`}>
      {!settled && (
        // The plate says it once; the switch carries the same words for a reader.
        <span aria-hidden="true" data-testid="prologue-breaker-label"
          className="prologue-breaker-tag prologue-rise absolute max-w-[9.5rem] text-right text-micro font-semibold leading-tight">{label}</span>
      )}
      {/* Owner 2026-11-06: no words, three arrows running down under the lever say "pull". Gone at the first touch. */}
      {!thrown && !touched && (
        <span aria-hidden="true" data-testid="prologue-pull" style={BREAKER_AT.pull}
          className="absolute flex -translate-x-1/2 flex-col items-center text-v2-self">
          {[0, 1, 2].map(index => (
            <svg key={index} viewBox="0 0 16 10" className="prologue-chevron -my-0.5 h-2.5 w-4" style={{ animationDelay: `${String(index * 0.18)}s` }}>
              <path d="M2 2l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ))}
        </span>
      )}
      <span ref={handle} aria-hidden="true" className={`prologue-breaker-handle absolute ${dragging ? 'is-dragging' : ''}`}
        style={{ ...BREAKER_AT.handle, transform: `translateY(${String(pull * HANDLE_TRAVEL * 100)}%)` }}>
        <img src={`${HANDLE}-dark.webp`} alt="" draggable={false} className="block w-full" />
        <img src={`${HANDLE}-lit.webp`} alt="" draggable={false} className={`absolute inset-0 block w-full ${lit ? 'prologue-lit' : 'opacity-0'}`} />
      </span>
      <span aria-hidden="true" className="prologue-breaker-led absolute" style={BREAKER_AT.lamp} />
      {thrown && !settled && <Sparks at={BREAKER_AT.sparks} />}
      {!settled && (
        <button
          type="button"
          role="switch"
          aria-checked={thrown}
          aria-label={label}
          data-testid="prologue-switch"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => { drag.current = null; setDragging(false); if (!thrown) setPull(0); }}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fire(); } }}
          className="prologue-hold pointer-events-auto absolute"
          style={BREAKER_AT.hit}
        />
      )}
    </div>
  );
}

/**
 * A CONTROL THAT IS HELD, not tapped: the ring fills under the thumb, letting go early lets it drain.
 * The ignition, the weld and the claim each wear their own colour and glyph.
 */
function HoldControl({ testId, label, hint, tone, glyph, onHeld }: {
  testId: string; label: string; hint: string; tone: string; glyph: ReactNode; onHeld: () => void;
}) {
  const [share, setShare] = useState(0);
  const [held, setHeld] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const done = useRef(false);
  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setHeld(false);
    if (!done.current) setShare(0);
  }, []);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const complete = () => {
    if (done.current) return;
    done.current = true;
    setShare(1);
    stop();
    onHeld();
  };
  const start = (event: PointerEvent<HTMLButtonElement>) => {
    if (done.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const began = Date.now();
    setHeld(true);
    haptic('tap');
    timer.current = setInterval(() => {
      const next = Math.min(1, (Date.now() - began) / HOLD_MS);
      setShare(next);
      if (next >= 1) complete();
    }, 30);
  };
  const R = 27;
  const C = 2 * Math.PI * R;
  return (
    <div className="prologue-rise flex flex-row-reverse items-center gap-3">
      <button
        type="button"
        data-testid={testId}
        aria-label={label}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onContextMenu={(event) => { event.preventDefault(); }}
        onKeyDown={(event: KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); complete(); } }}
        className={`prologue-hold relative grid size-[61px] shrink-0 place-items-center rounded-full ${held ? 'is-held' : ''}`}
        style={{ color: tone }}
      >
        <span aria-hidden="true" className="prologue-hold-halo absolute inset-0 rounded-full" style={{ boxShadow: `0 0 22px -2px ${tone}` }} />
        <svg aria-hidden="true" viewBox="0 0 64 64" className="absolute inset-0 size-full -rotate-90">
          <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
          <circle className="prologue-hold-ring" cx="32" cy="32" r={R} fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - share)} />
        </svg>
        <span className="prologue-hold-core grid size-12 place-items-center rounded-full border border-current/50 bg-gradient-to-b from-white/10 to-black/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_14px_-4px_#000]">
          {glyph}
        </span>
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body font-semibold leading-tight" style={{ color: tone }}>{label}</span>
        <span className="text-micro text-v2-ink-2">{hint}</span>
      </div>
    </div>
  );
}

/**
 * THE SENSOR LINE'S THREE CRACKS (owner phone playtest 2026-11-18, item 1): not a hold but three taps,
 * each one a repair. Placed on the satellite as the card frames it: the dish, the body, the panel arm.
 */
const CRACKS = [{ left: '34%', top: '40%' }, { left: '57%', top: '50%' }, { left: '74%', top: '64%' }] as const;

/** A crack in the line: a fault that flickers until the torch closes it, then a seam that cools. */
function WeldSeam({ at, done, next }: { at: { left: string; top: string }; done: boolean; next: boolean }) {
  return (
    <span aria-hidden="true" data-weld={done ? 'done' : 'open'} className={`prologue-seam ${done ? 'is-done' : next ? 'is-next' : ''}`} style={at}>
      <svg viewBox="-12 -7 24 14" className="overflow-visible">
        <path d="M-11 -2L-6 2L-2 -4L2 3L6 -2L11 1" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/**
 * THE TORCH, TAPPED (owner 2026-11-18): each tap is one weld. The ring is cut in three, one third for
 * each crack, and fills as the seams close; the face punches in under the finger.
 */
function WeldControl({ welds, label, hint, tone, glyph, onWeld }: { welds: number; label: string; hint: string; tone: string; glyph: ReactNode; onWeld: () => void }) {
  return (
    <div className="prologue-rise flex flex-row-reverse items-center gap-3">
      <button
        type="button"
        data-testid="prologue-weld"
        aria-label={label}
        onClick={onWeld}
        onContextMenu={(event) => { event.preventDefault(); }}
        className="prologue-hold prologue-tap relative grid size-[61px] shrink-0 place-items-center rounded-full"
        style={{ color: tone }}
      >
        <svg aria-hidden="true" viewBox="0 0 64 64" className="absolute inset-0 size-full -rotate-90">
          {CRACKS.map((_, index) => (
            <circle key={index} cx="32" cy="32" r="27" pathLength={300} fill="none" strokeWidth={index < welds ? 3.5 : 3} strokeLinecap="round"
              stroke={index < welds ? 'currentColor' : 'rgba(255,255,255,0.14)'} strokeDasharray="88 212" strokeDashoffset={-(index * 100 + 6)} />
          ))}
        </svg>
        <span key={welds} className="prologue-hold-core prologue-tap-core grid size-12 place-items-center rounded-full border border-current/50 bg-gradient-to-b from-white/10 to-black/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_14px_-4px_#000]">
          {glyph}
        </span>
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body font-semibold leading-tight" style={{ color: tone }}>{label}</span>
        <span className="text-micro text-v2-ink-2">{hint} <span className="font-v2-mono text-v2-ink">{welds}/{CRACKS.length}</span></span>
      </div>
    </div>
  );
}

/**
 * THE JUMP (owner 2026-11-06: the first version was weak, and the cockpit showed again after the
 * white). The drive spools and shakes the bridge, rings run out of the signal, the stars stretch, and
 * the white fills the screen and HOLDS: the ship scene opens underneath it, so nothing shows between.
 */
function Warp({ origin }: { origin: Point }) {
  const at = { '--wx': origin.x, '--wy': origin.y } as CSSProperties;
  return (
    <div data-testid="prologue-warp" aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 overflow-hidden" style={at}>
      <span className="prologue-warp absolute inset-0" />
      {Array.from({ length: 6 }, (_, index) => (
        <span key={`ring${String(index)}`} className="prologue-ring" style={{ animationDelay: `${String(0.25 + index * 0.18)}s` }} />
      ))}
      {Array.from({ length: 48 }, (_, index) => (
        <span key={index} className="prologue-streak" style={{ '--wa': `${String((index * 137.5) % 360)}deg`, animationDelay: `${String(0.2 + ((index * 0.173) % 0.9))}s` } as CSSProperties} />
      ))}
      <span className="prologue-flash absolute inset-0" />
    </div>
  );
}

const ShipScene = lazy(() => import('./ShipScene.js'));
/** The first batch's Collect: the one plain button a commander can stall at (owner playtest 2026-11-07). */
const COLLECT = (): Element[] => [...document.querySelectorAll('[data-testid="prologue-action"]')];

/**
 * THE SHIP, IN 3D, OUT OF THE JUMP (owner 2026-11-06: "modelleri koy, hareket ettirilebilir bir 3D
 * ortamda olsun"). Mounted under the bridge while the jump runs, so it is loaded and drawing when the
 * white clears; the camera's drop toward it starts on `arrived`.
 */
function Reveal({ hull, arrived }: { hull: VesselHull; arrived: boolean }) {
  return (
    <div data-testid="prologue-reveal" data-hull={hull} className="absolute inset-0 -z-10 overflow-hidden bg-v2-void">
      <Suspense fallback={null}><ShipScene hull={hull} arrived={arrived} /></Suspense>
    </div>
  );
}

/**
 * THE GALAXY TURNING IN ITS OWN PLANE (owner 2026-11-06: "çok yavaş dönüyor, döndüğü anlaşılmıyor").
 * The picture is a tilted disc, so it is flattened back to face-on, turned, and tilted again; the
 * disc's own ellipse is masked so only the galaxy turns and the stars around it stay put.
 */
function GalaxySky() {
  return (
    <span className="prologue-galaxy">
      <span>
        <span className="prologue-galaxy-spin">
          <span><span><img src={`${ART}-dark.webp`} alt="" draggable={false} className="object-cover" /></span></span>
        </span>
      </span>
    </span>
  );
}

/** The bridge, with the window cut out of it and the sky moving behind. */
function Bridge({ lit, burning, signal, breaker, diving, origin }: { lit: boolean; burning: boolean; signal: ReactNode; breaker: ReactNode; diving: boolean; origin: Point }) {
  const glints = [[18, 20], [74, 12], [33, 41], [88, 46], [57, 15], [12, 51], [66, 38]];
  return (
    <div data-testid="prologue-bridge" style={{ '--wx': origin.x, '--wy': origin.y } as CSSProperties}
      className={`prologue-stage absolute inset-0 -z-10 overflow-hidden v2-split:inset-y-0 v2-split:left-1/2 v2-split:right-auto v2-split:aspect-[2/3] v2-split:-translate-x-1/2 v2-split:[mask-image:linear-gradient(90deg,transparent,#000_14%,#000_86%,transparent)] ${diving ? 'is-diving' : ''}`}>
      <div aria-hidden="true" className="prologue-art">
        <img src={`${ART}-dark.webp`} alt="" draggable={false} className="prologue-sky object-cover" />
        <GalaxySky />
        <span className="prologue-core" />
        <span>
          {glints.map(([x, y], index) => <span key={index} className="prologue-glint" style={{ left: `${String(x)}%`, top: `${String(y)}%`, animationDelay: `${String(index * 1.37)}s`, animationDuration: `${String(7 + (index % 3) * 2.3)}s` }} />)}
          <span className="prologue-comet" />
        </span>
        {/* `-v2`: the breaker box painted on the right-hand console (owner 2026-11-27). */}
        <img src={`${ART}-dark-frame-v2.webp`} alt="" draggable={false} className="object-cover" />
        <img src={`${ART}-lit-frame-v2.webp`} alt="" draggable={false} className={`object-cover ${lit ? 'prologue-lit' : 'opacity-0'}`} />
        {burning && <span data-testid="prologue-furnace-light" className="prologue-furnace-light" />}
      </div>
      {/* The signal and the breaker's lever sit on the art, so they stay in place however the art is fitted. */}
      <div className="prologue-on-art pointer-events-none"><div>{signal}{breaker}</div></div>
    </div>
  );
}

/**
 * THE VIEW FROM THE PILOT'S SEAT. Plan §3.9, and owner 2026-11-06: a game, not a form. A breaker that
 * lights the room, a furnace held until it catches, a harvest that flies to the hold, a weld, and a
 * signal the ship jumps to — where it is seen from outside for the first time, and claimed.
 */
export function Prologue({ onClaim, onSignIn, onLeave, replay = false }: Props) {
  useAppScreen();
  const { t } = useTranslation();
  const [world, setWorld] = useState<PrologueWorld>(() => replay ? openPrologue(Date.now()) : restorePrologue(Date.now()));
  const [now, setNow] = useState(() => Date.now());
  const [problem, setProblem] = useState<string | undefined>();
  const [telemetry] = useState(() => prologueTelemetry(replay));
  const [hull] = useState(prologueHull);
  const [flying, setFlying] = useState(false);
  const [welds, setWelds] = useState(0);
  /** Where the jump flies: the signal as drawn, measured when it is pressed (main and bridge frames). */
  const [origin, setOrigin] = useState<{ main: Point; stage: Point }>({ main: SIGNAL_AT, stage: SIGNAL_AT });
  const mainRef = useRef<HTMLElement>(null);
  const started = useRef(false);

  const busy = world.stage === 'burning' || world.stage === 'patching' || world.stage === 'warping';
  useEffect(() => {
    if (!busy) return undefined;
    const timer = setInterval(() => {
      const at = Date.now();
      setNow(at);
      setWorld(current => prologueTick(current, at));
    }, 100);
    return () => { clearInterval(timer); };
  }, [busy]);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      telemetry.started(world.stage, world.stage !== 'dark');
    }
    telemetry.visible(world.stage);
    if (world.stage === 'signal') telemetry.completed(world.stage);
    if (!replay) savePrologue(world.stage === 'warping' ? 'signal' : world.stage);
  }, [world.stage, replay, telemetry]);

  // Every turn of the road answers with a sound and a touch.
  useEffect(() => {
    if (world.stage === 'batch') { playSound('confirm'); haptic('commit'); }
    if (world.stage === 'signal') { playSound('alert'); haptic('warn'); }
    if (world.stage === 'found') { playSound('claim'); haptic('commit'); }
  }, [world.stage]);

  // The ship scene and its model start loading as soon as the signal shows, so the jump lands on them.
  useEffect(() => {
    if (world.stage !== 'signal' && world.stage !== 'warping') return;
    import('./ShipScene.js').then((scene) => { scene.preloadShip(hull); }, () => undefined);
  }, [world.stage, hull]);

  const act = useCallback((action: PrologueAction) => {
    const at = Date.now();
    telemetry.accepted(world.stage, action);
    setNow(at);
    setWorld(current => prologueAct(current, action, at));
  }, [telemetry, world.stage]);

  const { stage } = world;
  const held = prologueHeld(world);
  const lit = prologueLit(world);
  const step = prologueStep(stage);
  const ship = stage === 'found' || stage === 'claim';
  const copy: { title: string; body: string } = {
    dark: { title: t('starter.prologue.dark.title'), body: t('starter.prologue.dark.body') },
    powered: { title: t('starter.prologue.powered.title'), body: t('starter.prologue.powered.body', { crystal: full(STARTER.opening.crystal) }) },
    burning: { title: t('starter.prologue.burning.title'), body: t('starter.prologue.burning.body') },
    batch: { title: t('starter.prologue.batch.title', { alloy: full(STARTER.opening.alloy) }), body: t('starter.prologue.batch.body') },
    collected: { title: t('starter.prologue.collected.title'), body: t('starter.prologue.collected.body') },
    patching: { title: t('starter.prologue.patching.title'), body: t('starter.prologue.patching.body') },
    signal: { title: t('starter.prologue.signal.title'), body: t(replay ? 'starter.prologue.signal.replayBody' : 'starter.prologue.signal.body') },
    warping: { title: t('starter.prologue.warping.title'), body: '' },
    found: { title: t('starter.prologue.found.title'), body: t('starter.prologue.found.body') },
    claim: { title: t('starter.prologue.claim.title'), body: '' },
  }[stage];

  const collect = () => {
    playSound('cargo');
    haptic('commit');
    setFlying(true);
    setTimeout(() => { setFlying(false); }, 900);
    act('collect');
  };

  /** One tap, one crack closed; the third holds the line (owner 2026-11-18). */
  const weld = () => {
    if (stage !== 'collected' || welds >= CRACKS.length) return;
    const next = welds + 1;
    playSound('arc');
    haptic(next === CRACKS.length ? 'commit' : 'tap');
    setWelds(next);
    if (next === CRACKS.length) { playSound('weld', { seconds: TORCH_S }); act('patch'); }
  };
  const travel = () => {
    if (replay) { onLeave(); return; }
    const main = mainRef.current;
    const mark = main?.querySelector('[data-testid="prologue-signal"] > span')?.getBoundingClientRect();
    const stage = main?.querySelector('[data-testid="prologue-bridge"]')?.getBoundingClientRect();
    const frame = main?.getBoundingClientRect();
    if (mark && stage && frame && mark.width > 0) {
      const x = mark.left + mark.width / 2;
      const y = mark.top + mark.height / 2;
      const px = (value: number) => `${String(Math.round(value))}px`;
      setOrigin({ main: { x: px(x - frame.left), y: px(y - frame.top) }, stage: { x: px(x - stage.left), y: px(y - stage.top) } });
    }
    playSound('warp');
    haptic('warp');
    act('travel');
  };

  const signalMark = sensorsListening(world) && !ship && (
    <button
      type="button"
      data-testid="prologue-signal"
      aria-label={t('starter.prologue.signal.go')}
      disabled={stage !== 'signal'}
      onClick={travel}
      className="pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-v2-warn"
      style={{ left: SIGNAL_AT.x, top: SIGNAL_AT.y }}
    >
      <span aria-hidden="true" className="relative grid size-20 place-items-center">
        <span className="prologue-signal absolute inset-0 rounded-full border border-v2-warn" />
        <span className="prologue-signal absolute inset-0 rounded-full border border-v2-warn [animation-delay:0.8s]" />
        <span className="absolute inset-3 rounded-full border border-dashed border-v2-warn/40" />
        <span className="size-2.5 rounded-full bg-v2-warn shadow-[0_0_12px_3px_var(--color-v2-warn)]" />
      </span>
      <span className="rounded-chip bg-v2-void/70 px-1.5 py-0.5 font-v2-mono text-micro [text-shadow:0_1px_3px_#000]">{t('starter.prologue.signal.mark')}</span>
    </button>
  );

  return (
    <main ref={mainRef} data-testid="prologue" data-stage={stage} className="relative isolate flex h-dvh w-full flex-col overflow-hidden bg-v2-void font-v2-ui">
      {(ship || stage === 'warping') && <Reveal hull={hull} arrived={ship} />}
      {!ship && <Bridge lit={lit} burning={refineryRunning(world)} signal={signalMark} diving={stage === 'warping'} origin={origin.stage}
        breaker={<Breaker label={t('starter.prologue.action.power')} onThrow={() => { act('power'); }} settled={stage !== 'dark'} lit={lit} />} />}
      {stage === 'warping' && <Warp origin={origin.main} />}
      {ship && <span aria-hidden="true" data-testid="prologue-whiteout" className="prologue-whiteout pointer-events-none absolute inset-0 z-20" />}
      {/*
        None in the dark: the art's own foot already fades to black under the words, and this shade would
        swallow the breaker on the console (on a wide screen the art runs the full height). It rises with the power.
      */}
      <span aria-hidden="true" className={`pointer-events-none absolute inset-x-0 bottom-0 -z-10 ${stage === 'dark' ? 'h-0' : 'h-[46%]'} bg-gradient-to-t from-v2-void from-40% via-v2-void/60 via-70% to-transparent transition-[height] duration-700`} />
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-20 bg-gradient-to-b from-v2-void/80 to-transparent" />

      <header className="flex items-center gap-3 px-3 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <ol aria-label={t('starter.prologue.progress', { step, total: PROLOGUE_STEPS })} className="flex flex-1 gap-1">
          {Array.from({ length: PROLOGUE_STEPS }, (_, index) => (
            <li key={index} className={`h-0.5 flex-1 rounded-full transition-colors duration-500 ${index < step ? 'bg-v2-self shadow-[0_0_6px_var(--color-v2-self)]' : 'bg-v2-line-hi'}`} />
          ))}
        </ol>
        {replay
          ? <button type="button" onClick={onLeave} className="min-h-8 text-micro font-semibold text-v2-ink-2">{t('starter.prologue.close')}</button>
          : <>
            <button type="button" onClick={onSignIn} className="min-h-8 text-micro font-semibold text-v2-ink-2">{t('starter.prologue.signIn')}</button>
            {stage !== 'claim' && (
              <button type="button" onClick={() => { telemetry.skipped(stage); act('skip'); }} className="min-h-8 text-micro font-semibold text-v2-ink-2">{t('starter.prologue.skip')}</button>
            )}
          </>}
      </header>

      {/* Over the ship, the words let a finger through to turn it; only the controls take a touch. */}
      {/*
        Over the cookie note while it shows (`--consent-h`), where the screen is tall enough that the
        words still clear the breaker (a phone taller than 1.7× its width, or a wide screen). On a short
        phone the note covers the words instead of the words covering the breaker; a touch removes it.
      */}
      <div data-testid="prologue-foot" className={`relative mt-auto flex flex-col gap-2.5 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [@media(max-aspect-ratio:10/17)]:pb-[calc(max(0.75rem,env(safe-area-inset-bottom))+var(--consent-h,0px))] v2-split:pb-[calc(max(0.75rem,env(safe-area-inset-bottom))+var(--consent-h,0px))] v2-split:mx-auto v2-split:w-full v2-split:max-w-md ${ship ? 'pointer-events-none [&_button]:pointer-events-auto' : ''}`}>
        {lit && !ship && (
          <div data-testid="prologue-holds" className="relative flex gap-3 font-v2-mono text-caption [text-shadow:0_1px_3px_#000]">
            <span className="text-v2-alloy">{t('starter.prologue.alloy', { value: full(held.alloy) })}</span>
            <span className="text-v2-crystal">{t('starter.prologue.crystal', { value: full(held.crystal) })}</span>
            {flying && Array.from({ length: 8 }, (_, index) => (
              <img key={index} src={RESOURCE_ART.alloy} alt="" aria-hidden="true" className="prologue-fly size-4" style={{ left: `${String(20 + index * 9)}%`, top: '140px', animationDelay: `${String(index * 0.05)}s`, '--fx': `${String(-index * 9)}px`, '--fy': '-140px' } as CSSProperties} />
            ))}
          </div>
        )}
        {lit && !ship && <Systems world={world} />}
        {(stage === 'powered' || stage === 'burning' || stage === 'batch') && (
          // One machine from cold to burning, so the furnace visibly catches instead of being swapped in.
          <Machine art={moduleArt('REFINERY', 1)} name={t('starter.prologue.refinery')} share={stage === 'powered' ? 0 : prologueShare(world, now)}
            figure={stage === 'powered' ? null : `+${full(prologueBatch(world, now))}`} burning={stage !== 'powered'} cold={stage === 'powered'}>
            {stage === 'batch' && (
              <button type="button" data-testid="prologue-action" onClick={collect} className="prologue-action absolute right-2 top-2 flex items-center gap-1.5 rounded-pill border border-v2-alloy/70 bg-v2-void/80 px-3 py-1.5 text-caption font-semibold text-v2-alloy shadow-[0_0_14px_-3px_var(--color-v2-alloy)]">
                <img src={RESOURCE_ART.alloy} alt="" className="size-4" />{t('starter.prologue.action.collect')}
              </button>
            )}
          </Machine>
        )}
        {(stage === 'collected' || stage === 'patching') && (
          // The whole satellite, dish to panels: the band a short card keeps is set on its body.
          <Machine art={moduleArt('SURVEY', 1)} name={t('starter.prologue.feed')} share={stage === 'patching' ? 1 : welds / CRACKS.length} figure={null} burning={false} tall focus="50% 26%">
            {CRACKS.map((at, index) => <WeldSeam key={index} at={at} done={index < welds} next={stage === 'collected' && index === welds} />)}
            {stage === 'collected' && welds < CRACKS.length && <Torch at={CRACKS[welds] ?? CRACKS[0]} />}
            {welds > 0 && <Sparks count={14} at={CRACKS[welds - 1] ?? CRACKS[0]} key={welds} />}
          </Machine>
        )}
        <div className="flex flex-col gap-1">
          <h1 data-testid="prologue-title" className="text-title font-semibold leading-tight text-v2-ink [text-shadow:0_1px_6px_#000]">{copy.title}</h1>
          {copy.body && <p className="text-caption leading-snug text-v2-ink-2 [text-shadow:0_1px_4px_#000]">{copy.body}</p>}
        </div>

        {stage === 'powered' && (
          <HoldControl testId="prologue-ignite" label={t('starter.prologue.action.burn')} hint={t('starter.prologue.hint.hold')} tone="#ff9a3d"
            glyph={<Icon id={SYSTEM_ICON.REFINERY} className="size-6" />} onHeld={() => { playSound('ignite', { seconds: ROAR_S }); haptic('rumble'); act('burn'); }} />
        )}
        {stage === 'collected' && (
          <WeldControl welds={welds} label={t('starter.prologue.action.patch')} hint={t('starter.prologue.hint.weld')} tone="#7fd6ff"
            glyph={<Icon id={SYSTEM_ICON.SURVEY} className="size-6" />} onWeld={weld} />
        )}
        {stage === 'signal' && (
          <button type="button" data-testid="prologue-action" onClick={travel} className="prologue-action flex min-h-[var(--gk-hit)] items-center justify-center gap-2 rounded-control border border-v2-warn/70 bg-v2-warn/10 px-3 text-body font-semibold text-v2-warn shadow-[0_0_16px_-4px_var(--color-v2-warn)]">
            <span aria-hidden="true">↗</span>{replay ? t('starter.prologue.signal.replayAction') : t('starter.prologue.signal.go')}
          </button>
        )}
        {stage === 'found' && (
          <HoldControl testId="prologue-claim" label={t('starter.prologue.found.action')} hint={t('starter.prologue.hint.claim')} tone="#ffd27a"
            glyph={<Icon id="i-check" className="size-6" />} onHeld={() => { haptic('commit'); act('claim'); }} />
        )}
      </div>

      {stage === 'batch' && <TutorialHand targets={COLLECT} />}
      {stage === 'claim' && !replay && (
        <ClaimDialog
          planetName={t('starter.prologue.claim.ship')}
          introduction={t('starter.prologue.claim.intro', { alloy: full(STARTER.opening.alloy), crystal: full(STARTER.opening.crystal) })}
          onSignIn={onSignIn}
          {...(problem ? { error: problem } : {})}
          onClaim={async (username, password, country, policy) => {
            try {
              // No progress goes with it: the server builds the ship from `STARTER.opening`, in the hull shown.
              await onClaim(username, password, [], country, policy, hull);
              clearPrologue();
            } catch (error) {
              setProblem(describeError(error));
              throw error;
            }
          }}
        />
      )}
    </main>
  );
}
