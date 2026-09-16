import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import type { Contact } from '../api/schemas.js';

/**
 * THE PICK VOLUMES, PAINTED.
 *
 * Everything tappable on the disc is an INVISIBLE solid, and none of them are the
 * shape of the thing they belong to: a squadron is a padded box round its whole
 * formation, a rock is a sphere at 2.4x its radius with a floor under it, a wreck
 * is a torus that deliberately leaves its own world's centre open, a pirate is one
 * sphere per hull rather than one box across the wedge. Every one of those numbers
 * was chosen against a fingertip on a 350px phone, and not one of them can be
 * checked by looking at the game — the volume is invisible, so the only feedback
 * anyone gets is a tap that opened the wrong panel.
 *
 * This is the switch that makes them visible. It answers the questions the numbers
 * cannot: how much of the screen does a squadron box actually cover at close zoom,
 * does a rock's generous sphere swallow the world behind it, do two of them
 * overlap at the range the player is usually looking from.
 *
 * ONE COLOUR PER KIND, because the interesting failures are all about WHICH volume
 * won. A single debug colour would show the coverage and hide the collision.
 *
 * HOW IT IS TURNED ON. `?hitboxes=1` on the galaxy URL, which sticks (per device,
 * like the render quality) until `?hitboxes=0` clears it, or `__hitboxes(true)`
 * from the console for a look without a reload.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: change the pick meshes. The volumes drawn here
 * ARE the volumes that are raycast — the same mesh, the same geometry, the same
 * transform — because a debug view built from a parallel copy is a debug view that
 * drifts and then lies. The single exception is a world, whose pick target is its
 * own billboard with the planet's art on it; that one gets a second quad on the
 * same matrices, and that quad is never raycast (see `PlanetField`).
 *
 * THE ONE HONEST DIFFERENCE: while the switch is on the material is DoubleSide, so
 * a volume the camera is standing inside is still drawn — and, because Three.js
 * raycasts against `material.side`, is also tappable from inside, which it is not
 * in the real game. Off, the side is `FrontSide` exactly as it has always been.
 */

export type HitboxKind =
  /** A world. Its pick target is the billboard the art is drawn on. */
  | 'planet'
  /** A rock: a sphere well outside the tumbling body. */
  | 'asteroid'
  /** A ring of debris round a world, hollow on purpose. */
  | 'wreck'
  /** Your own squadron — one box round the whole formation. */
  | 'fleet'
  /** A scout, yours or somebody else's. */
  | 'probe'
  /** The strategic weapon. */
  | 'deathStar'
  /** A mining or harvest run, yours or somebody else's. */
  | 'miner'
  /** Another commander's craft, identified or not. */
  | 'contact'
  /** A pirate formation — one sphere per hull, not one box. */
  | 'pirate'
  /** The merchant. */
  | 'trade'
  /** The intergalactic convoy, whose sphere is sized off the whole train. */
  | 'convoy';

export const HITBOX_KINDS = [
  'planet',
  'asteroid',
  'wreck',
  'fleet',
  'probe',
  'deathStar',
  'miner',
  'contact',
  'pirate',
  'trade',
  'convoy',
] as const satisfies readonly HitboxKind[];

/**
 * ELEVEN HUES THAT SURVIVE BEING OVERLAID ON EACH OTHER.
 *
 * Not the game's own craft palette, and that is the point: a pirate is violet on
 * the disc and red here, so nobody mistakes a debug volume for the thing it wraps.
 * Two volumes that overlap blend, so neighbouring kinds are kept far apart on the
 * wheel — a squadron (green) against a contact (yellow) against a pirate (red) is
 * readable through two layers of 25% fill; three shades of blue would not be.
 */
export const HITBOX_COLOURS: Record<HitboxKind, string> = {
  planet: '#38bdf8',
  asteroid: '#a3e635',
  wreck: '#94a3b8',
  fleet: '#22c55e',
  probe: '#e879f9',
  deathStar: '#ffffff',
  miner: '#fb923c',
  contact: '#facc15',
  pirate: '#ef4444',
  trade: '#2dd4bf',
  convoy: '#8b5cf6',
};

/**
 * Light enough to see the hull through it, solid enough to read the silhouette of
 * a box seen edge-on. Below about 0.15 a single face disappears against space;
 * above 0.35 a squadron box hides the squadron.
 */
export const HITBOX_OPACITY = 0.25;

/** The radar's own vocabulary, mapped onto the colour key. Exhaustive by type. */
export const CONTACT_HITBOX_KIND: Record<Contact['kind'], HitboxKind> = {
  /** An unidentified return is still somebody's craft; it gets the contact hue. */
  unknown: 'contact',
  fleet: 'contact',
  probe: 'probe',
  mining: 'miner',
  harvest: 'miner',
  death_star: 'deathStar',
  pirate: 'pirate',
};

export interface HitboxMaterialProps {
  readonly color: string;
  readonly transparent: true;
  readonly opacity: number;
  readonly colorWrite: boolean;
  readonly depthWrite: false;
  readonly side: THREE.Side;
  readonly toneMapped: false;
}

/**
 * The props both states share, so the switch never changes anything that would
 * force a shader recompile — `transparent` stays true, only `opacity`,
 * `colorWrite` and `side` move, and Three.js applies all three per draw.
 */
export const hitboxMaterialProps = (kind: HitboxKind, debug: boolean): HitboxMaterialProps => ({
  color: HITBOX_COLOURS[kind],
  transparent: true,
  opacity: debug ? HITBOX_OPACITY : 0,
  // `colorWrite: false` rather than `visible: false`: an invisible object is not
  // raycast at all, which would leave nothing to press.
  colorWrite: debug,
  depthWrite: false,
  side: debug ? THREE.DoubleSide : THREE.FrontSide,
  // Exact hues, so two overlapping volumes stay tellable apart after the scene's
  // tone mapping and bloom have had their say.
  toneMapped: false,
});

const KEY = 'astera.hitboxes';

const store = (): Storage | null => {
  try {
    // Safari in private browsing throws on ACCESS rather than on write — see
    // `lib/quality.ts`, which learned this first.
    return globalThis.localStorage;
  } catch {
    return null;
  }
};

/**
 * The query string wins over what was stored, so one URL both turns it on and
 * turns it off again — `?hitboxes=0` has to be able to clear a sticky `1`, or a
 * device that saw the volumes once keeps them forever.
 *
 * Pure, and exported, because the real thing reads `location` at module load and
 * that is not a thing a test can arrange.
 */
export function initialHitboxDebug(search: string, stored: string | null): boolean {
  const params = new URLSearchParams(search);
  const asked = params.get('hitboxes');
  // `?hitboxes` with no value is a person asking for it, not an empty answer.
  if (asked !== null) return asked === '' || asked === '1' || asked === 'true' || asked === 'on';
  return stored === '1';
}

let current: boolean = ((): boolean => {
  try {
    return initialHitboxDebug(location.search, store()?.getItem(KEY) ?? null);
  } catch {
    return false;
  }
})();

const listeners = new Set<() => void>();

export const hitboxDebug = (): boolean => current;

export function setHitboxDebug(next: boolean): void {
  if (next === current) return;
  current = next;
  try {
    store()?.setItem(KEY, next ? '1' : '0');
  } catch {
    // A read-only store still leaves the switch working for this session.
  }
  for (const notify of listeners) notify();
}

const subscribe = (notify: () => void): (() => void) => {
  listeners.add(notify);
  return () => listeners.delete(notify);
};

/** Subscribe a component to the switch. Safe to call from inside the canvas. */
export const useHitboxDebug = (): boolean =>
  useSyncExternalStore(subscribe, hitboxDebug, () => false);

/** Drop-in for the hand-written invisible material every pick mesh used to carry. */
export function HitboxMaterial({ kind }: { kind: HitboxKind }) {
  const debug = useHitboxDebug();
  return <meshBasicMaterial {...hitboxMaterialProps(kind, debug)} />;
}

interface HitboxWindow {
  __hitboxes?: (on: boolean) => void;
}

// A console handle, so the volumes can be put on and taken off while looking at
// the same frame instead of reloading the galaxy around them.
try {
  (globalThis as unknown as HitboxWindow).__hitboxes = setHitboxDebug;
} catch {
  // No global to hang it on. The query string still works.
}

/**
 * THE COLOUR KEY, because eleven hues is more than anyone holds in their head.
 *
 * Deliberately not translated and deliberately not styled like the game: this is
 * an instrument, it is only ever on screen when a developer asked for it, and a
 * locale entry for `deathStar` would be a string the players' translators have to
 * carry forever.
 */
export function HitboxLegend() {
  const debug = useHitboxDebug();
  if (!debug) return null;
  return (
    <div
      data-testid="hitbox-legend"
      className="pointer-events-none fixed left-2 top-2 z-50 rounded-chip bg-black/70 px-2 py-1.5 font-mono text-micro text-white/85"
    >
      <div className="mb-1 tracking-wide text-white/50">HIT BOXES</div>
      {/*
        TWO COLUMNS, because eleven rows down the left edge of a 350px phone is a
        strip across the very galaxy the key is there to help read.
      */}
      <div className="grid grid-cols-2 gap-x-2">
        {HITBOX_KINDS.map((kind) => (
          <div key={kind} data-testid="hitbox-legend-row" className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block size-2 shrink-0 rounded-cell"
              style={{ backgroundColor: HITBOX_COLOURS[kind] }}
            />
            <span>{kind}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
