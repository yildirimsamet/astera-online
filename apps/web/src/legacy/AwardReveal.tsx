/**
 * THE REVEAL: every piece a commander wins is shown to them once, with ceremony, whether it
 * was won while they watched or while they slept. The server keeps a piece in the queue until
 * the reveal has actually played (`revealed_at`), so closing the app halfway shows the rest
 * next time and nothing is shown twice.
 *
 * The rarest piece comes first. A long queue — a veteran's first visit, when years of past
 * achievements arrive at once — shows three pieces one by one and opens the rest together,
 * so the moment stays a moment instead of a chore.
 */
import { Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as THREE from 'three';
import { LEGACY_CATALOGUE, LEGACY_SHOWCASE_SLOTS } from '@astera/rules';
import { useApi } from '../api/context.js';
import { keys } from '../api/keys.js';
import { coverGalaxy } from '../lib/galaxyCover.js';
import { useNativeBack } from '../platform/nativeBack.js';
import { isAppActive, watchAppActivity } from '../platform/activity.js';
import type { LegacyAward } from '../api/legacySchemas.js';
import { Button } from '../v2/kit/Surface.js';
import { AwardEngines, StudioLight, TurntableFrames, useBuiltAward } from './AwardScene.js';
import { AwardPicture } from './AwardTile.js';
import { legacyAwardTitle, legacyEditionLabel, legacyGoalText, sortLegacyAwards } from './presentation.js';
import { useLegacyProfile, useSetLegacyShowcase } from './queries.js';

/** Pieces shown one by one before the rest open together. */
const ONE_BY_ONE = 3;
/** The entrance of one piece; a tap finishes it early. */
const INTRO_MS = 1_900;
/** How often a commander in the galaxy is checked for a new piece. */
const POLL_MS = 60_000;

/**
 * Watches for won pieces and plays them when the galaxy is free. `ready` is false while a
 * sheet, the loading cover or a lesson holds the screen; the queue waits for it.
 */
export function LegacyRevealHost({ ready, live = true }: { ready: boolean; live?: boolean }) {
  const api = useApi();
  const client = useQueryClient();
  // The first read of a session evaluates the whole ledger, so season-end pieces arrive too.
  const evaluated = useRef(false);
  const played = useRef(new Set<string>());
  const reveals = useQuery({
    queryKey: keys.legacyReveals,
    enabled: ready,
    refetchInterval: POLL_MS,
    staleTime: POLL_MS / 2,
    queryFn: async () => {
      const result = await api.legacyReveals(!evaluated.current);
      evaluated.current = true;
      return result;
    },
  });
  const ack = useMutation({ mutationFn: (ids: readonly string[]) => api.revealLegacyAwards(ids) });
  const [queue, setQueue] = useState<LegacyAward[] | null>(null);
  const waiting = reveals.data?.awards.filter(award => !played.current.has(award.id)) ?? [];

  useEffect(() => {
    if (queue === null && ready && waiting.length > 0) setQueue(sortLegacyAwards(waiting));
  }, [queue, ready, waiting]);

  if (!queue) return null;
  return createPortal(
    <AwardReveal queue={queue} live={live}
      onSeen={ids => {
        for (const id of ids) played.current.add(id);
        // A failed mark leaves the piece on the server's queue: it is shown again next visit.
        ack.mutate(ids);
      }}
      onDone={() => {
        // Dismissal skips only this visit; unseen pieces stay on the server for next time.
        for (const award of queue) played.current.add(award.id);
        setQueue(null);
        void client.invalidateQueries({ queryKey: keys.legacy });
      }} />,
    document.body,
  );
}

function AwardReveal({ queue, live, onSeen, onDone }: {
  queue: readonly LegacyAward[];
  live: boolean;
  onSeen: (ids: readonly string[]) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const panel = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(isAppActive);
  useEffect(() => watchAppActivity(() => { setActive(isAppActive()); }), []);
  useNativeBack(panel, onDone);
  useEffect(() => {
    const previous = document.activeElement;
    panel.current?.focus({ preventScroll: true });
    const release = coverGalaxy('whole');
    return () => {
      release();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  const long = queue.length > ONE_BY_ONE + 1;
  const singles = long ? queue.slice(0, ONE_BY_ONE) : queue;
  const rest = long ? queue.slice(ONE_BY_ONE) : [];
  const [step, setStep] = useState(0);
  // Which step has finished its entrance. Tied to the step, so moving on can never carry a
  // finished state into a piece that has not been shown yet.
  const [shownStep, setShownStep] = useState(-1);
  const shown = shownStep === step;
  const group = step < singles.length ? singles.slice(step, step + 1) : rest;
  const piece = step < singles.length ? singles[step] ?? null : null;
  const seen = useRef(onSeen);
  const acknowledged = useRef(new Set<string>());
  seen.current = onSeen;

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => { setShownStep(step); }, piece ? INTRO_MS : 700 + Math.min(rest.length, 16) * 90);
    return () => { window.clearTimeout(timer); };
  }, [step, piece, rest.length, active]);

  const groupIds = group.map(award => award.id).join(',');
  useEffect(() => {
    if (active && shown && groupIds && !acknowledged.current.has(groupIds)) {
      acknowledged.current.add(groupIds);
      seen.current(groupIds.split(','));
    }
  }, [shown, groupIds, active]);

  const lastSingle = step === singles.length - 1;
  const rarest = piece?.rarity ?? rest[0]?.rarity ?? 'COMMON';
  const total = singles.length + (rest.length > 0 ? 1 : 0);

  return (
    <div ref={panel} tabIndex={-1} data-testid="legacy-reveal" role="dialog" aria-modal="true" aria-label={t('legacy.reveal.eyebrow')}
      data-rarity={rarest} data-shown={shown || undefined}
      onClick={() => { if (!shown) setShownStep(step); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); onDone(); return; }
        if (event.key === 'Enter' && !shown) { event.preventDefault(); setShownStep(step); return; }
        if (event.key !== 'Tab') return;
        const buttons = panel.current?.querySelectorAll<HTMLButtonElement>('.legacy-reveal-actions:not(.invisible) button:not(:disabled)');
        const first = buttons?.[0], last = buttons?.[buttons.length - 1];
        if (!first || !last) { event.preventDefault(); panel.current?.focus(); return; }
        const focused = document.activeElement;
        if (focused === panel.current || (event.shiftKey ? focused === first : focused === last)) {
          event.preventDefault(); (event.shiftKey ? last : first).focus();
        }
      }}
      className="legacy-reveal fixed inset-0 z-[70] flex select-none flex-col items-center overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-6 font-v2-ui text-v2-ink outline-none">
      <div key={`fx-${String(step)}`} aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="legacy-reveal-rays" />
        <div className="legacy-reveal-core" />
        <div className="legacy-reveal-flash" />
        <div className="legacy-reveal-sparks">
          {Array.from({ length: 14 }, (_, i) => <span key={i} style={{ ['--a' as string]: `${String(i * (360 / 14) + (i % 2) * 9)}deg`, ['--d' as string]: `${String(90 + (i % 4) * 26)}px` }} />)}
        </div>
      </div>

      <div data-single={piece ? '' : undefined} className="legacy-reveal-layout relative my-auto flex w-full shrink-0 flex-col items-center">
      {total > 1 && (
        <p className="legacy-reveal-counter relative mb-2 font-v2-mono text-micro text-v2-ink-3">{t('legacy.reveal.counter', { index: Math.min(step + 1, total), count: total })}</p>
      )}

      <div key={`piece-${String(step)}`} className="legacy-reveal-piece relative flex w-full max-w-sm flex-col items-center">
        {piece ? <>
          <div className="legacy-reveal-stage relative aspect-square w-[min(74vw,320px)]">
            {live
              ? <RevealCanvas award={piece} settled={shown} />
              : <AwardPicture award={piece} className="legacy-reveal-picture size-full" />}
          </div>
          <RevealCopy award={piece} />
        </> : (
          <>
            <p className="legacy-reveal-eyebrow v2-legend">{t('legacy.reveal.eyebrowMany')}</p>
            <h2 className="legacy-reveal-name mt-1 text-center text-title font-semibold">{t('legacy.reveal.restTitle', { count: rest.length })}</h2>
            <ul className="mt-4 grid max-h-[52dvh] w-full grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {rest.map((award, index) => (
                <li key={award.id} data-testid="legacy-reveal-rest-piece" data-rarity={award.rarity}
                  className="legacy-tile legacy-reveal-pop flex flex-col items-center gap-1 rounded-control px-1 pb-2 pt-1.5 text-center"
                  style={{ animationDelay: `${String(500 + Math.min(index, 16) * 90)}ms` }}>
                  <AwardPicture award={award} className="aspect-square w-[88%]" />
                  <span className="line-clamp-2 text-label font-semibold leading-tight">{legacyAwardTitle(award)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className={`legacy-reveal-actions relative mt-5 flex w-full max-w-sm flex-col gap-2 ${shown ? '' : 'invisible'}`}>
        {piece && <ShelfButton award={piece} />}
        {piece && !lastSingle && <Button variant="primary" full onClick={() => { setStep(step + 1); }}>{t('legacy.reveal.next')}</Button>}
        {piece && lastSingle && rest.length > 0 && (
          <Button variant="primary" full onClick={() => { setStep(step + 1); }}>{t('legacy.reveal.openRest', { count: rest.length })}</Button>
        )}
        {(!piece || (lastSingle && rest.length === 0)) && <Button variant="primary" full onClick={onDone}>{t('legacy.reveal.close')}</Button>}
      </div>
      </div>
    </div>
  );
}

/** Name, metal and the reason it was won, entering one after another under the piece. */
function RevealCopy({ award }: { award: LegacyAward }) {
  const { t } = useTranslation();
  const definition = LEGACY_CATALOGUE.find(row => row.id === award.definitionId);
  const goal = definition?.goals[award.tier - 1];
  const edition = legacyEditionLabel(award);
  return (
    <div className="legacy-reveal-copy flex flex-col items-center text-center">
      <p className="legacy-reveal-eyebrow v2-legend">{t('legacy.reveal.eyebrow')}</p>
      <h2 className="legacy-reveal-name mt-1 text-title font-semibold leading-tight">{legacyAwardTitle(award)}</h2>
      <p className="legacy-reveal-chips mt-2 flex flex-wrap items-center justify-center gap-1.5 text-micro">
        <span className="legacy-tile legacy-rarity-text inline-flex items-center gap-1 rounded-chip px-2 py-0.5 font-semibold" data-rarity={award.rarity}>
          <span className="legacy-rarity-dot size-1.5 rounded-full" />{t(`legacy.rarity.${award.rarity}`)}
        </span>
        {edition && <span className="rounded-chip border border-v2-line-hi px-2 py-0.5 font-v2-mono text-v2-ink-2">{edition}</span>}
        <span className="rounded-chip border border-v2-line-hi px-2 py-0.5 text-v2-ink-2">{t(`legacy.category.${award.category}`)}</span>
      </p>
      {definition && goal !== undefined && (
        <p className="legacy-reveal-goal mt-2 max-w-[30ch] text-caption leading-snug text-v2-ink-2">{legacyGoalText(definition, goal)}</p>
      )}
    </div>
  );
}

/** The one thing worth doing with a new piece right away: putting it where others see it. */
function ShelfButton({ award }: { award: LegacyAward }) {
  const { t } = useTranslation();
  const me = useLegacyProfile({ kind: 'me' }).data;
  const save = useSetLegacyShowcase();
  const [placed, setPlaced] = useState(false);
  if (!me) return null;
  const ids = me.showcase.map(row => row.awardId);
  if (placed || ids.includes(award.id)) return <p className="text-center text-label font-semibold text-v2-premium">{t('legacy.reveal.onShelf')}</p>;
  if (ids.length >= LEGACY_SHOWCASE_SLOTS) return null;
  return (
    <Button disabled={save.isPending} onClick={() => { save.mutate([...ids, award.id], { onSuccess: () => { setPlaced(true); } }); }}>
      {t('legacy.award.showOnShelf')}
    </Button>
  );
}

const easeOut = (x: number) => 1 - (1 - x) ** 3;
const easeOutBack = (x: number) => { const c = 1.9; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };

/** The piece rises out of the light spinning, overshoots a little and settles into a slow turn. */
function RevealPiece({ award, settled }: { award: LegacyAward; settled: boolean }) {
  const built = useBuiltAward(award);
  const group = useRef<THREE.Group>(null);
  const progress = useRef(0);
  const turn = useRef(0);
  useFrame((state, delta) => {
    const node = group.current;
    if (!node || !built) return;
    // Waits for the flash (≈0.4 s) before rising; a tap hurries the rest.
    const wait = state.clock.elapsedTime < 0.4 && !settled;
    if (!wait) progress.current = Math.min(1, progress.current + delta * (settled ? 4 : 1 / 1.1));
    const p = progress.current;
    node.scale.setScalar(Math.max(0.001, easeOutBack(p)));
    node.position.y = (1 - easeOut(p)) * -0.35 + (built.hovers ? 0.08 + Math.sin(state.clock.elapsedTime * 1.3) * 0.025 : 0);
    turn.current += delta * (0.5 + (1 - easeOut(p)) * 14);
    node.rotation.y = turn.current;
  });
  return <group ref={group} scale={0.001}>{built && <primitive object={built.object} />}<AwardEngines built={built} /></group>;
}

function RevealCanvas({ award, settled }: { award: LegacyAward; settled: boolean }) {
  return (
    <Canvas
      orthographic
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ manual: true, left: -0.6, right: 0.6, top: 1.08, bottom: -0.12, near: -10, far: 10, position: [0, 0, 5], zoom: 1 }}
      onCreated={({ gl, camera }) => {
        // A manual camera is never fitted by the canvas, so its projection is built here once.
        camera.updateProjectionMatrix();
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.12;
        gl.setClearColor(0x000000, 0);
      }}
      className="!absolute inset-0"
      aria-hidden="true"
    >
      <StudioLight keyIntensity={3} />
      <TurntableFrames />
      <Suspense fallback={null}><RevealPiece award={award} settled={settled} /></Suspense>
    </Canvas>
  );
}
