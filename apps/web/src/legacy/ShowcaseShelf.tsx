/**
 * THE SHOWCASE: a painted cabinet with six plinths, and the commander's six chosen pieces
 * standing on them in 3D. The canvas is orthographic and laid exactly over the painting, so a
 * plinth's position in the picture IS the award's position in the scene — nothing drifts
 * at any phone width. Each plinth is also a real button with a name plate, so the shelf
 * reads to a screen reader and to a thumb before any model has loaded.
 */
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import type { LegacyAward } from '../api/legacySchemas.js';
import { legacyAwardTitle, legacyEditionLabel } from './presentation.js';
import { PlinthAward, StudioLight, TurntableFrames } from './AwardScene.js';

export const SHELF_ART = '/assets/legacy/shelf-v1.webp';
/** The painting's own size; every anchor below is in its pixels. */
const ART = { width: 1122, height: 1402 } as const;
/** Plinth top centres, measured on the painting: the top shelf first, left to right. */
export const SHELF_PLINTHS: readonly { x: number; y: number }[] = [
  { x: 212, y: 628 }, { x: 561, y: 628 }, { x: 910, y: 628 },
  { x: 212, y: 1216 }, { x: 561, y: 1216 }, { x: 910, y: 1216 },
];
/** A plinth is 247 px wide; a piece one plinth-unit wide fills it. */
const PLINTH_UNIT = 247 / ART.width;
/** How much of the compartment above a plinth a full-height piece may use. */
const PIECE_SCALE = PLINTH_UNIT * 1.26;

const pct = (value: number, of: number) => `${String((value / of) * 100)}%`;

export function ShowcaseShelf({ slots, onOpen, onEmpty, live = true }: {
  /** Exactly six entries: an award or an empty plinth. */
  slots: readonly (LegacyAward | null)[];
  onOpen: (award: LegacyAward) => void;
  /** The owner's own shelf invites filling an empty plinth; a visitor's does not. */
  onEmpty?: () => void;
  /** False draws the cabinet without a WebGL context (tests, reduced devices). */
  live?: boolean;
}) {
  const { t } = useTranslation();
  const aspect = ART.height / ART.width;
  return (
    <div data-legacy-shelf className="relative w-full overflow-hidden rounded-control border border-v2-line bg-v2-void"
      style={{ aspectRatio: `${String(ART.width)} / ${String(ART.height)}` }}>
      <img src={SHELF_ART} alt="" aria-hidden="true" decoding="async" className="absolute inset-0 size-full select-none object-cover" draggable={false} />
      {live && slots.some(Boolean) && (
        <Canvas
          orthographic
          frameloop="demand"
          dpr={[1, 2]}
          gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
          camera={{ manual: true, left: 0, right: 1, top: 0, bottom: -aspect, near: -10, far: 10, position: [0, 0, 5], zoom: 1 }}
          onCreated={({ gl, camera }) => {
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
            gl.setClearColor(0x000000, 0);
            // The frustum is the painting: one unit across, `aspect` units down, whatever the CSS size.
            const ortho = camera as THREE.OrthographicCamera;
            ortho.left = 0; ortho.right = 1; ortho.top = 0; ortho.bottom = -aspect;
            ortho.updateProjectionMatrix();
          }}
          resize={{ debounce: 0 }}
          className="pointer-events-none !absolute inset-0"
          aria-hidden="true"
        >
          <StudioLight />
          <TurntableFrames />
          <Suspense fallback={null}>
            {SHELF_PLINTHS.map((plinth, slot) => (
              // A slight bow towards the viewer: the painting looks down onto its plinths.
              <group key={slot} position={[plinth.x / ART.width, -plinth.y / ART.width, 0]} rotation-x={0.16}>
                <PlinthAward award={slots[slot] ?? null} scale={PIECE_SCALE} phase={slot * 1.7} />
              </group>
            ))}
          </Suspense>
        </Canvas>
      )}
      {SHELF_PLINTHS.map((plinth, slot) => {
        const award = slots[slot] ?? null;
        const left = pct(plinth.x - 165, ART.width);
        const width = pct(330, ART.width);
        // The hit area is the compartment above the plinth; the plate hangs on the shelf lip.
        const top = pct(plinth.y - 430, ART.height);
        const height = pct(470, ART.height);
        if (!award) {
          return onEmpty ? (
            <button key={slot} type="button" onClick={onEmpty} aria-label={t('legacy.shelf.edit')}
              className="group absolute grid place-items-center focus-visible:outline-2 focus-visible:outline-v2-self"
              style={{ left, width, top, height }}>
              <span aria-hidden="true" className="mt-[40%] grid size-8 place-items-center rounded-full border border-v2-premium/30 text-v2-premium/60 transition group-hover:border-v2-premium/70 group-hover:text-v2-premium">+</span>
            </button>
          ) : null;
        }
        const title = legacyAwardTitle(award);
        const edition = legacyEditionLabel(award);
        return (
          <button key={slot} type="button" onClick={() => { onOpen(award); }}
            aria-label={t('legacy.shelf.open', { name: edition ? `${title} · ${edition}` : title })}
            className="absolute flex flex-col items-center justify-end rounded-control focus-visible:outline-2 focus-visible:outline-v2-self"
            style={{ left, width, top, height }}>
            <span data-legacy-plate data-rarity={award.rarity} className="legacy-plate legacy-rarity-text mb-[-3%] flex max-w-full flex-col items-center rounded-cell px-1 py-0.5 text-center font-v2-ui text-micro font-semibold leading-[1.15]">
              <span className="line-clamp-2 break-words">{title}</span>
              {edition && <span className="font-v2-mono text-micro font-medium text-v2-ink-2">{edition}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
