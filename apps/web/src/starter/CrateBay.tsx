import type { CrateView } from '@astera/rules';
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { compact } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { RESOURCE_ART } from '../ui/assets.js';
import './crate.css';

export type CrateBayCrate = CrateView;

/** As long as a launch's hold (`HOLD_MS`): one gesture that cannot happen by accident. */
const HOLD_MS = 600;
/** How long the purse stays above the opened crate before the bay clears. */
const PURSE_MS = 2_400;
const SPARKS = Array.from({ length: 9 }, (_, i) => {
  const angle = (i / 9) * Math.PI * 2 - Math.PI / 2;
  return { dx: `${String(Math.round(Math.cos(angle) * 34))}px`, dy: `${String(Math.round(Math.sin(angle) * 26 - 10))}px`, delay: `${String(i * 25)}ms` };
});

/**
 * A SALVAGE CRATE DRAWN IN CODE (owner playtest 2026-11-07: "çok çirkin, amatörce"). A plated metal case
 * with a hazard band, corner caps and a lock, standing in a lit bay; its lid apart so it can fly, and the
 * seam between them leaking the light of what is inside.
 */
function Crate() {
  const id = useId().replace(/:/g, '');
  const body = `crate-body-${id}`, lid = `crate-lid-${id}`, glow = `crate-glow-${id}`, beam = `crate-beam-${id}`;
  return (
    <svg viewBox="0 0 72 64" className="size-[68px] overflow-visible" aria-hidden="true">
      {/* Soft edges come from gradients alone: no blur filter (sharp image contract). */}
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#56606f" />
          <stop offset="0.5" stopColor="#323a47" />
          <stop offset="1" stopColor="#1b2029" />
        </linearGradient>
        <linearGradient id={lid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a8596" />
          <stop offset="1" stopColor="#3b4452" />
        </linearGradient>
        <radialGradient id={glow}>
          <stop offset="0" stopColor="#ffe3a0" stopOpacity="1" />
          <stop offset="0.5" stopColor="#ffb547" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ff9a2a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={beam} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ffcf73" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffcf73" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx="36" cy="60" rx="30" ry="3.5" fill="#000" opacity="0.55" />
      <ellipse cx="36" cy="59" rx="26" ry="2.5" fill={`url(#${glow})`} opacity="0.35" className="crate-floor" />
      <path className="crate-rays" d="M14 24 L4 -6 L68 -6 L58 24 Z" fill={`url(#${beam})`} />
      <circle className="crate-burst opacity-0" cx="36" cy="24" r="30" fill={`url(#${glow})`} style={{ transformOrigin: '36px 24px' }} />
      <g>
        <rect x="9" y="26" width="54" height="32" rx="3" fill={`url(#${body})`} stroke="#11151b" strokeWidth="1.5" />
        <rect x="10.5" y="27.5" width="51" height="2" rx="1" fill="#9aa5b5" opacity="0.35" />
        <path d="M9 40h54v6H9z" fill="#c9922e" />
        <path d="M13 40l-4 6M21 40l-6 6M29 40l-6 6M37 40l-6 6M45 40l-6 6M53 40l-6 6M61 40l-6 6" stroke="#1b1408" strokeWidth="2.2" />
        <path d="M9 26h7v32H9zM56 26h7v32h-7z" fill="#262c36" opacity="0.9" />
        {[[12.5, 30], [59.5, 30], [12.5, 54], [59.5, 54]].map(([cx, cy]) => <circle key={`${String(cx)}-${String(cy)}`} cx={cx} cy={cy} r="1.1" fill="#aab4c2" />)}
        <rect x="30" y="31" width="12" height="11" rx="2" fill="#1d232c" stroke="#c9922e" strokeWidth="1.2" />
        <circle cx="36" cy="35.5" r="1.8" fill="#ffcf73" className="crate-lock" />
        <rect x="35.2" y="36.5" width="1.6" height="3" rx="0.8" fill="#ffcf73" className="crate-lock" />
      </g>
      <rect className="crate-seam" x="9" y="23.2" width="54" height="2.8" rx="1.2" fill="#ffd27a" />
      <g className="crate-lid" style={{ transformOrigin: '60px 22px', transformBox: 'view-box' }}>
        <path d="M7 15.5a3 3 0 0 1 3-3h52a3 3 0 0 1 3 3V23H7z" fill={`url(#${lid})`} stroke="#11151b" strokeWidth="1.5" />
        <rect x="9" y="14" width="54" height="1.6" rx="0.8" fill="#dfe6ef" opacity="0.5" />
        <path d="M7 18h7v5H7zM58 18h7v5h-7z" fill="#2b323d" />
        <rect x="28" y="16" width="16" height="3" rx="1.5" fill="#262c36" stroke="#566070" strokeWidth="0.8" />
      </g>
      {SPARKS.map((spark, i) => (
        <circle key={i} className="crate-spark opacity-0" cx="36" cy="22" r="1.7" fill="#ffe08a"
          style={{ '--dx': spark.dx, '--dy': spark.dy, animationDelay: spark.delay } as CSSProperties} />
      ))}
    </svg>
  );
}

/** A pennant on a staff: an outpost's flag, taken. */
export function VictoryMark() {
  return (
    <svg viewBox="0 0 16 16" className="crate-victory-mark size-3.5 shrink-0" aria-hidden="true">
      <path d="M4 1.5v13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4.8 2.2h8.4l-2.3 2.9 2.3 2.9H4.8z" fill="currentColor" />
    </svg>
  );
}

/** One resource of the purse: its own picture and the amount, the news of the card. */
function Haul({ resource, amount }: { resource: 'alloy' | 'crystal'; amount: number }) {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-1" aria-label={`${compact(amount)} ${t(`vocabulary.resource.${resource}`)}`}>
      <img src={RESOURCE_ART[resource]} alt="" draggable={false} className="size-5 drop-shadow-[0_0_6px_rgba(255,200,120,0.35)]" />
      <span className={`font-v2-mono text-body font-semibold leading-none ${resource === 'alloy' ? 'text-v2-alloy' : 'text-v2-crystal'}`}>+{compact(amount)}</span>
    </span>
  );
}

/**
 * KURTARMA KASALARI (retention plan §6.2). A repair frees a sealed crate in its bay. The player lifts
 * the lid by holding it: the crate strains, the latch snaps, the lid flies, and what it held pours
 * out over it while the store fills. Every ready crate opens with the one gesture. The first outpost
 * victory's crate (N9) wears its win: a gilded bay, and its own name when it stands alone.
 */
export function CrateBay({ crates, onOpen }: { crates: readonly CrateBayCrate[]; onOpen: () => void }) {
  const { t } = useTranslation();
  const ready = crates.filter(crate => crate.state === 'ready');
  const purse = {
    alloy: ready.reduce((sum, c) => sum + c.alloy, 0), crystal: ready.reduce((sum, c) => sum + c.crystal, 0),
    victory: ready.some(c => c.fact !== null), alone: ready.length === 1,
  };
  const [holding, setHolding] = useState(false);
  const [poured, setPoured] = useState<typeof purse | null>(null);
  const timer = useRef<number | null>(null);

  const stop = (): void => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  const commit = (): void => {
    stop();
    if (ready.length === 0) return;
    playSound('crate');
    haptic('commit');
    setPoured(purse);
    onOpen();
  };
  const start = (): void => {
    if (ready.length === 0 || timer.current !== null) return;
    haptic('tap');
    setHolding(true);
    timer.current = window.setTimeout(() => { timer.current = null; commit(); }, HOLD_MS);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    commit();
  };

  useEffect(() => {
    if (!poured) return undefined;
    const clear = window.setTimeout(() => { setPoured(null); }, PURSE_MS);
    return () => { window.clearTimeout(clear); };
  }, [poured]);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  if (ready.length === 0 && !poured) return null;
  const shown = poured ?? purse;
  const title = shown.victory && shown.alone ? t('starter.crate.victory') : t('starter.crate.title', { count: Math.max(1, ready.length) });
  const words = `${compact(shown.alloy)} ${t('vocabulary.resource.alloy')}, ${compact(shown.crystal)} ${t('vocabulary.resource.crystal')}`;
  return (
    <div className="relative">
      <button
        type="button"
        data-guide="crate"
        {...(holding ? { 'data-holding': '' } : {})}
        {...(poured ? { 'data-open': '' } : {})}
        {...(shown.victory ? { 'data-victory': '' } : {})}
        aria-label={t('starter.crate.open', { purse: words })}
        disabled={poured !== null && ready.length === 0}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onKeyDown={onKeyDown}
        onContextMenu={(event) => { event.preventDefault(); }}
        className="crate-card relative flex w-full touch-none select-none items-center gap-2.5 overflow-hidden rounded-plate border border-v2-alloy/45 bg-v2-panel py-1.5 pl-1.5 pr-2.5 text-left font-v2-ui text-v2-ink shadow-[0_10px_28px_-12px_rgba(0,0,0,0.8),0_0_22px_-10px_var(--color-v2-alloy)]"
      >
        <span aria-hidden="true" className="crate-sheen pointer-events-none absolute inset-0" />
        <span className="crate-bay relative grid h-[72px] w-[84px] shrink-0 place-items-center overflow-hidden rounded-control">
          <Crate />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {shown.victory && <VictoryMark />}
            <span className="crate-legend v2-legend text-v2-alloy">{title}</span>
            {ready.length > 1 && <span className="rounded-chip bg-v2-alloy/15 px-1 font-v2-mono text-micro text-v2-alloy">×{ready.length}</span>}
          </span>
          <span className="mt-1 flex items-center gap-3">
            <Haul resource="alloy" amount={shown.alloy} />
            {shown.crystal > 0 && <Haul resource="crystal" amount={shown.crystal} />}
          </span>
          {/* The gesture is the card's last line: a bar that fills under the thumb for as long as the hold takes. */}
          <span className="relative mt-1.5 flex h-6 items-center gap-1.5 overflow-hidden rounded-full border border-v2-alloy/40 bg-black/35 px-2">
            <span aria-hidden="true" className="crate-hold-fill absolute inset-y-0 left-0 bg-gradient-to-r from-v2-alloy/25 to-v2-alloy/60"
              style={{ width: holding || poured ? '100%' : '0%', transitionDuration: holding ? `${String(HOLD_MS)}ms` : '150ms' }} />
            <svg viewBox="0 0 24 24" className="crate-press relative size-4 shrink-0 text-v2-alloy" aria-hidden="true">
              <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0 0V4.5a1.5 1.5 0 0 1 3 0V10m0 0V6a1.5 1.5 0 0 1 3 0v7.5a6.5 6.5 0 0 1-6.5 6.5h-.6a6 6 0 0 1-4.6-2.2L4.4 14a1.5 1.5 0 0 1 2.3-1.9L9 14.5"
                fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="relative truncate text-micro font-semibold uppercase tracking-wide text-v2-ink">{t('starter.crate.hold')}</span>
          </span>
        </span>
      </button>
      {poured && (
        <span data-crate-purse="" aria-live="polite"
          className="crate-purse pointer-events-none absolute -top-3 left-20 flex items-center gap-2 rounded-chip border border-v2-alloy/50 bg-v2-deep/90 px-2 py-0.5 font-v2-mono text-caption font-semibold shadow-[0_0_14px_var(--color-v2-alloy)]">
          <span className="text-v2-alloy">+{compact(poured.alloy)}</span><span className="text-v2-crystal">+{compact(poured.crystal)}</span>
        </span>
      )}
    </div>
  );
}
