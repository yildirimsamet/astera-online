import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { declutterLabels, type UniverseBall } from './universe.js';

const FADE_SECONDS = 1.2;
/** The main galaxy's glow: as wide as its monument shell, and the brightest thing on the map. */
const MAIN_SIZE = 280;

let ballTexture: THREE.Texture | undefined;

/** A bell curve with a hot middle. The game's soft glow shows its edge at this size. */
function glowingBall(): THREE.Texture {
  if (ballTexture) return ballTexture;
  const size = 256, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    const floor = Math.exp(-11);
    for (let step = 0; step <= 28; step++) {
      const at = step / 28;
      const alpha = (Math.exp(-11 * at * at) - floor) / (1 - floor);
      gradient.addColorStop(at, `rgba(255,255,255,${alpha.toFixed(4)})`);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  ballTexture = new THREE.CanvasTexture(canvas);
  return ballTexture;
}

const LABEL_BOX = { width: 66, height: 28 };
const MAIN_LABEL = 0;

function Word({ at, children, onElement }: {
  at: readonly [number, number, number];
  children: ReactNode;
  onElement: (element: HTMLDivElement | null) => void;
}) {
  return (
    <Html position={[at[0], at[1], at[2]]} center zIndexRange={[8, 0]} pointerEvents="none">
      <div ref={onElement} className="whitespace-nowrap text-center text-micro leading-tight transition-opacity duration-200 [text-shadow:0_1px_2px_#000,0_0_6px_#000,0_0_10px_#000]">{children}</div>
    </Html>
  );
}

function Glow({ at, size, color, opacity, order }: {
  at: readonly [number, number, number];
  size: number;
  color: string;
  opacity: number;
  order: number;
}) {
  return (
    <sprite position={[at[0], at[1], at[2]]} scale={size} renderOrder={order} raycast={() => null} userData={{ opacity }}>
      <spriteMaterial map={glowingBall()} color={color} opacity={0} transparent depthWrite={false} depthTest={false}
        blending={THREE.AdditiveBlending} fog={false} toneMapped={false} />
    </sprite>
  );
}

/**
 * THE VIEW PAST THE ZOOM LIMIT: the main galaxy in the middle and the starter galaxies around it as
 * balls of light, in the same 3D space as everything else. Only for looking at: nothing here is an
 * order, and a ball says only how many ships it holds.
 */
export function UniverseBalls({ balls, main, mineIsMain }: {
  balls: readonly UniverseBall[];
  main: readonly [number, number, number];
  mineIsMain: boolean;
}) {
  const { t } = useTranslation();
  const invalidate = useThree((state) => state.invalidate);
  const group = useRef<THREE.Group>(null);
  const shown = useRef(0);
  const words = useRef(new Map<number, HTMLDivElement>());
  const keep = (id: number) => (element: HTMLDivElement | null): void => {
    if (element) words.current.set(id, element);
    else words.current.delete(id);
  };
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }, delta) => {
    if (shown.current < 1 && group.current) {
      shown.current = Math.min(1, shown.current + delta / FADE_SECONDS);
      group.current.traverse((node) => {
        if (node instanceof THREE.Sprite && node.material instanceof THREE.SpriteMaterial) {
          node.material.opacity = shown.current * Number(node.userData.opacity);
        }
      });
      invalidate();
    }
    // Your own and the main galaxy always keep their names; then the nearest.
    const nearestFirst = [...balls].sort((a, b) =>
      Number(b.own) - Number(a.own)
      || camera.position.distanceToSquared(point.set(...a.position)) - camera.position.distanceToSquared(point.set(...b.position)));
    const onScreen = [{ id: MAIN_LABEL, at: main }, ...nearestFirst.map(ball => ({ id: ball.ordinal, at: ball.position }))].map(({ id, at }) => {
      point.set(at[0], at[1], at[2]).project(camera);
      return { id, x: (point.x + 1) * size.width / 2, y: (1 - point.y) * size.height / 2 };
    });
    const room = declutterLabels(onScreen, LABEL_BOX);
    for (const [id, element] of words.current) element.style.opacity = room.has(id) ? '1' : '0';
  });
  return (
    <group ref={group} name="universe">
      <Glow at={main} size={MAIN_SIZE} color="#ffc48a" opacity={0.3} order={-71} />
      <Glow at={main} size={MAIN_SIZE * 0.34} color="#fff0dc" opacity={0.75} order={-70} />
      <Word at={[main[0], main[1] + MAIN_SIZE * 0.2, main[2]]} onElement={keep(MAIN_LABEL)}>
        <span className="font-semibold text-v2-ink">{t('universe.main')}</span>
        {mineIsMain && <span className="block text-v2-self">{t('universe.you')}</span>}
      </Word>
      {balls.map((ball) => (
        <group key={ball.ordinal}>
          <Glow at={ball.position} size={ball.size * 2.2} color={ball.own ? '#35e6c8' : '#8fb6ff'} opacity={ball.own ? 1 : 0.8} order={-69} />
          <Glow at={ball.position} size={ball.size * 0.8} color={ball.own ? '#d8fff6' : '#e6efff'} opacity={0.7} order={-68} />
          <Word at={[ball.position[0], ball.position[1] + ball.size * 0.72, ball.position[2]]} onElement={keep(ball.ordinal)}>
            <span className={ball.own ? 'font-semibold text-v2-self' : 'text-v2-ink'}>{ball.own ? t('universe.you') : t('universe.starter', { number: ball.ordinal })}</span>
            <span className="block font-v2-mono text-v2-ink-2">{t('universe.ships', { count: ball.ships })}</span>
          </Word>
        </group>
      ))}
    </group>
  );
}
