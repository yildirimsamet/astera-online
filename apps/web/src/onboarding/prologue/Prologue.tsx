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
  PROLOGUE_STEPS, clearPrologue, openPrologue, prologueAct, prologueBatch, prologueHeld, prologueHull, prologueLit, prologueShare, prologueStep,
  prologueTick, refineryRunning, restorePrologue, savePrologue, sensorsListening, type PrologueAction, type PrologueWorld,
} from './world.js';

const ART = '/assets/images/starter/prologue-bridge';
/** How long a hold control must be held: a deliberate act, never an accident. */
export const HOLD_MS = 850;
/** The breaker's swing home before the lights try. */
export const THROW_MS = 420;
/** Where the signal burns, as a share of the bridge art; the jump flies at wherever it is drawn. */
const SIGNAL_AT = { x: '84%', y: '23%' };
interface Point { x: string; y: string }

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
 */
function Breaker({ label, onThrow }: { label: string; onThrow: () => void }) {
  const [pull, setPull] = useState(0);
  const [thrown, setThrown] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ from: number; moved: boolean } | null>(null);
  const TRAVEL = 44;
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
    drag.current = { from: event.clientY, moved: false };
    setDragging(true);
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current || thrown) return;
    const share = Math.min(1, Math.max(0, (event.clientY - drag.current.from) / TRAVEL));
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
    <div className={`prologue-breaker prologue-rise relative flex items-center gap-3 rounded-plate border border-v2-line-hi bg-gradient-to-b from-[#0c131c] to-[#05080d] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_30px_-10px_#000] ${thrown ? 'is-thrown' : ''}`}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-v2-mono text-micro uppercase tracking-label text-v2-ink-3">AUX · 01</span>
        <span className="text-body font-semibold text-v2-ink">{label}</span>
      </div>
      {/* Owner 2026-11-06: no words, three arrows running down beside the lever say "pull". */}
      {!thrown && (
        <span aria-hidden="true" data-testid="prologue-pull" className="flex shrink-0 flex-col items-center text-v2-self">
          {[0, 1, 2].map(index => (
            <svg key={index} viewBox="0 0 16 10" className="prologue-chevron -my-0.5 h-2.5 w-4" style={{ animationDelay: `${String(index * 0.18)}s` }}>
              <path d="M2 2l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ))}
        </span>
      )}
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
        className="prologue-breaker-track prologue-hold relative h-[84px] w-14 shrink-0 rounded-control border border-black/80"
      >
        <span aria-hidden="true" className="absolute inset-x-[22px] inset-y-2 rounded-full bg-black/80 shadow-[inset_0_0_4px_#000]" />
        <span aria-hidden="true" className={`prologue-breaker-handle absolute left-1.5 right-1.5 top-1.5 h-7 rounded-cell ${dragging ? 'is-dragging' : ''}`} style={{ transform: `translateY(${String(pull * TRAVEL)}px)` }}>
          <span className="prologue-breaker-cap absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full" />
        </span>
        <span aria-hidden="true" className={`absolute -right-1 top-2 size-1.5 rounded-full ${thrown ? 'bg-v2-self shadow-[0_0_8px_var(--color-v2-self)]' : 'bg-v2-hostile/60'}`} />
        {thrown && <Sparks at={{ left: '50%', top: '78%' }} />}
      </button>
    </div>
  );
}

/**
 * A CONTROL THAT IS HELD, not tapped: the ring fills under the thumb, letting go early lets it drain.
 * The ignition, the weld and the claim each wear their own colour and glyph.
 */
function HoldControl({ testId, label, hint, tone, glyph, onHeld, onHolding }: {
  testId: string; label: string; hint: string; tone: string; glyph: ReactNode; onHeld: () => void; onHolding?: (holding: boolean) => void;
}) {
  const [share, setShare] = useState(0);
  const [held, setHeld] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const done = useRef(false);
  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setHeld(false);
    onHolding?.(false);
    if (!done.current) setShare(0);
  }, [onHolding]);
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
    onHolding?.(true);
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
        className={`prologue-hold relative grid size-[68px] shrink-0 place-items-center rounded-full ${held ? 'is-held' : ''}`}
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
function Bridge({ lit, burning, signal, diving, origin }: { lit: boolean; burning: boolean; signal: ReactNode; diving: boolean; origin: Point }) {
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
        <img src={`${ART}-dark-frame.webp`} alt="" draggable={false} className="object-cover" />
        <img src={`${ART}-lit-frame.webp`} alt="" draggable={false} className={`object-cover ${lit ? 'prologue-lit' : 'opacity-0'}`} />
        {burning && <span data-testid="prologue-furnace-light" className="prologue-furnace-light" />}
      </div>
      {/* The signal sits on the art, so it stays in the window however the art is fitted. */}
      <div className="prologue-signal-art pointer-events-none"><div>{signal}</div></div>
    </div>
  );
}

/**
 * THE VIEW FROM THE PILOT'S SEAT. Plan §3.9, and owner 2026-11-06: a game, not a form. A breaker that
 * lights the room, a furnace held until it catches, a harvest that flies to the hold, a weld, and a
 * signal the ship jumps to — where it is seen from outside for the first time, and claimed.
 */
export function Prologue({ onClaim, onSignIn, onLeave, replay = false }: Props) {
  const { t } = useTranslation();
  const [world, setWorld] = useState<PrologueWorld>(() => replay ? openPrologue(Date.now()) : restorePrologue(Date.now()));
  const [now, setNow] = useState(() => Date.now());
  const [problem, setProblem] = useState<string | undefined>();
  const [telemetry] = useState(() => prologueTelemetry(replay));
  const [hull] = useState(prologueHull);
  const [flying, setFlying] = useState(false);
  const [welding, setWelding] = useState(false);
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
      {!ship && <Bridge lit={lit} burning={refineryRunning(world)} signal={signalMark} diving={stage === 'warping'} origin={origin.stage} />}
      {stage === 'warping' && <Warp origin={origin.main} />}
      {ship && <span aria-hidden="true" data-testid="prologue-whiteout" className="prologue-whiteout pointer-events-none absolute inset-0 z-20" />}
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[46%] bg-gradient-to-t from-v2-void from-40% via-v2-void/60 via-70% to-transparent" />
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
      <div className={`relative mt-auto flex flex-col gap-2.5 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] v2-split:mx-auto v2-split:w-full v2-split:max-w-md ${ship ? 'pointer-events-none [&_button]:pointer-events-auto' : ''}`}>
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
          <Machine art={moduleArt('SURVEY', 1)} name={t('starter.prologue.feed')} share={prologueShare(world, now) * (stage === 'patching' ? 1 : 0)} figure={null} burning={false} tall focus="50% 26%">
            {(welding || stage === 'patching') && <>
              <Torch at={{ left: '50%', top: '42%' }} />
              <Sparks count={14} at={{ left: '50%', top: '42%' }} key={Math.floor(now / 500)} />
            </>}
          </Machine>
        )}
        <div className="flex flex-col gap-1">
          <h1 data-testid="prologue-title" className="text-title font-semibold leading-tight text-v2-ink [text-shadow:0_1px_6px_#000]">{copy.title}</h1>
          {copy.body && <p className="text-caption leading-snug text-v2-ink-2 [text-shadow:0_1px_4px_#000]">{copy.body}</p>}
        </div>

        {stage === 'dark' && <Breaker label={t('starter.prologue.action.power')} onThrow={() => { act('power'); }} />}
        {stage === 'powered' && (
          <HoldControl testId="prologue-ignite" label={t('starter.prologue.action.burn')} hint={t('starter.prologue.hint.hold')} tone="#ff9a3d"
            glyph={<Icon id={SYSTEM_ICON.REFINERY} className="size-6" />} onHeld={() => { playSound('ignite'); haptic('rumble'); act('burn'); }} />
        )}
        {stage === 'collected' && (
          <HoldControl testId="prologue-weld" label={t('starter.prologue.action.patch')} hint={t('starter.prologue.hint.weld')} tone="#7fd6ff"
            glyph={<Icon id={SYSTEM_ICON.SURVEY} className="size-6" />} onHolding={(on) => { setWelding(on); if (on) playSound('arc'); }}
            onHeld={() => { playSound('weld'); haptic('commit'); act('patch'); }} />
        )}
        {stage === 'signal' && (
          <button type="button" data-testid="prologue-action" onClick={travel} className="prologue-action flex min-h-11 items-center justify-center gap-2 rounded-control border border-v2-warn/70 bg-v2-warn/10 px-3 text-body font-semibold text-v2-warn shadow-[0_0_16px_-4px_var(--color-v2-warn)]">
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
