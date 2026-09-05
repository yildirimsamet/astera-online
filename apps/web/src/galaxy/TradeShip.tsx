import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type * as THREE from 'three';
import type { TradeShipEvent } from '../lib/trade.js';
import { MODEL } from '../ui/assets.js';
import { Exhaust, Hull } from './Fleets.jsx';
import { CRAFT_SCALE, isHeading, tradeShipWorldPosition } from './scene.js';
import { markHit, wasTap } from './tap.js';
import { serverNow } from '../lib/clock.js';

/**
 * TİCARET GEMİSİ — a shop that comes to the galaxy. D156.
 *
 * EVERY OTHER MOVING THING IN THIS FOLDER IS FOGGED. A fleet is drawn in full
 * only for its owner; a stranger's craft is a `Contact`, sensed and bounded by a
 * sensor circle; a pirate is never remembered once it leaves one. The trade ship
 * is none of those, by owner decision: it is an ANNOUNCED public moment, so its
 * whole orbit is on the wire (`ActiveGalaxyEvent`'s `TRADE_SHIP` variant) and it
 * is drawn for every player with no sensor check at all — no zoning helper of
 * any kind has business anywhere in this file, and never will.
 *
 * A SINGLE CRAFT ON A CLOSED ORBIT, positioned every frame from the clock —
 * `Asteroids.tsx` is the closest existing thing and this follows its discipline:
 * nothing here fetches or stores a position, `tradeShipWorldPosition` (`scene.ts`)
 * is the only place that answer is computed, and it must never drift from
 * `tradeShipPosition` in `@astera/rules` — the launch screen solves a rendezvous
 * against this merchant and the server solves the same rendezvous again.
 */

/**
 * Re-exported rather than declared twice.
 *
 * `lib/trade.ts` owns the narrowing — it is also where the "which merchant is up
 * right now" question is answered — and a second `Extract` here would be a type
 * that has to be kept in step with it by hand.
 */
export type { TradeShipEvent };

/**
 * Draco off, exactly like every other craft in the galaxy (`Fleets.tsx`,
 * `Asteroids.tsx`). Drei's default would build a DRACOLoader that pulls its
 * decoder from a CDN, and this model is not Draco-compressed — the app has to
 * work offline and under a strict content policy.
 *
 * Deliberately absent from `preload.ts`'s landing-scene lists (slice 0): that
 * file carries a measured transfer-byte budget test, and the merchant is not
 * part of the door the whole galaxy waits behind.
 */
useGLTF.preload(MODEL.tradeShip, false);

/**
 * A NORMAL SHIP'S OWN BASE, before any per-craft multiplier — the same shape
 * every `MODEL_STYLE`/`CONTACT_STYLE` entry in `Fleets.tsx` is built from: a
 * fraction of `CRAFT_SCALE`, the one dial that moves every hull, probe and drill
 * in the galaxy together. 0.2 sits in the middle of that existing family (0.15
 * for a probe, 0.34 for the Death Star).
 */
export const TRADE_SHIP_BASE_SCALE = 0.2 * CRAFT_SCALE;

/**
 * HOW BIG THE MERCHANT IS DRAWN. Owner instruction: four times a normal ship.
 *
 * The Death Star is the working precedent for "bigger than the rest of the
 * fleet" — `style.scale * 3.4`, spelled out at six separate call sites in
 * `Fleets.tsx`, which is a repetition worth not copying here. One constant
 * instead, read at the one place this file needs it: the hull.
 */
export const TRADE_SHIP_SCALE_MULT = 4;

export const TRADE_SHIP_SCALE = TRADE_SHIP_BASE_SCALE * TRADE_SHIP_SCALE_MULT;

/** A gold, commerce-coloured glow — nothing else on the disc means "a shop". */
const TRADE_SHIP_GLOW = '#ffcf6e';

/**
 * THE FLAME, IN THE HULL'S OWN HUE. `visual-design.md`: the hue carries the
 * category, so the merchant's amber runs through its rim light and its plume
 * alike — and every `CONTACT_STYLE` entry in `Fleets.tsx` pairs a neon with a
 * paler, whiter flame of the same family (`#3fa9ff`/`#8fd8ff`, `#c46bff`/
 * `#e7c2ff`). This is that pair for amber.
 */
const TRADE_SHIP_FLAME = '#ffe9b8';

/**
 * A SEPARATE, GENEROUS, INVISIBLE HIT TARGET — the same answer `Asteroids.tsx`
 * reached, for the same reason: a fingertip on a phone is nowhere near the
 * precision of a hull, and raycasting the model itself means the hit area changes
 * shape as the ship turns. A plain sphere is stable and forgiving.
 *
 * `opacity={0}` rather than `visible={false}`: an invisible object is not raycast
 * at all, which would leave nothing to press.
 */
const TRADE_SHIP_HIT_RADIUS = TRADE_SHIP_SCALE * 1.8;

/**
 * How far ahead the heading sample looks, in milliseconds.
 *
 * `TRADE.speed` is a slow, deliberate pace (D156: half an Atlas) so a short
 * sample is still comfortably clear of `HEADING_EPSILON` at the tightest orbit
 * in the band, and short enough that the sampled heading reads as "now" rather
 * than "in a while".
 */
const HEADING_LOOKAHEAD_MS = 5_000;

/**
 * Render nothing when no `TRADE_SHIP` event is currently active — the ordinary
 * state, for nine of every twenty-four hours' worth of minutes the ship is not
 * yet in the sky at all.
 */
export function TradeShip({
  event,
  seasonStart,
  focused = false,
  onSelect,
}: {
  event: TradeShipEvent | null;
  seasonStart: Date | undefined;
  /** Selected on the disc, so the hull carries the same rim every craft does. */
  focused?: boolean;
  /**
   * TAPPING THE MERCHANT FOCUSES IT. D156, slice 3a.
   *
   * This file's docblock reserved the seat: the craft was drawn from slice 2a and
   * deliberately had no pick handler until the rail that answers a tap existed.
   * Nothing about the gesture is special — it is `Asteroids.tsx`'s tap guard and
   * `markHit`, so a drag across the galaxy still pans instead of selecting, and
   * the canvas's own miss handler does not clear the selection this tap just made.
   */
  onSelect?: (id: string) => void;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame(() => {
    const node = group.current;
    if (!node || !event || !seasonStart) return;
    const now = serverNow();
    const at = tradeShipWorldPosition(event.orbit, seasonStart, now);
    node.position.set(at[0], at[1], at[2]);

    /**
     * POINTED ALONG ITS OWN MOTION, NEVER LEFT TO `lookAt`'S OWN DEFAULT.
     *
     * `Matrix4.lookAt` answers a zero-length direction by substituting world +Z —
     * three.js does not refuse — which is how a pirate formation once turned away
     * mid-fight. `isHeading` is asked first for the same reason it is asked
     * everywhere else in this folder; on the rare degenerate frame the ship keeps
     * whatever heading it already had.
     */
    const ahead = tradeShipWorldPosition(event.orbit, seasonStart, now + HEADING_LOOKAHEAD_MS);
    if (isHeading(at, ahead)) node.lookAt(ahead[0], ahead[1], ahead[2]);
  });

  if (!event || !seasonStart) return null;

  const pick = (pointer: ThreeEvent<PointerEvent>): void => {
    if (!wasTap() || !onSelect) return;
    markHit();
    pointer.stopPropagation();
    onSelect(event.id);
  };

  return (
    <group ref={group} name="trade-ship">
      <Hull
        url={MODEL.tradeShip}
        scale={TRADE_SHIP_SCALE}
        glow={TRADE_SHIP_GLOW}
        focused={focused}
      />
      {/*
        A FOUR-TIMES-SIZE FREIGHTER WAS FLYING WITH DEAD ENGINES. Owner report:
        *"geminin kıçında motor alevi yok?"*

        `Hull` draws the model and nothing else; the plume is a separate component
        that every other craft in the galaxy mounts behind it, and the merchant
        reused the first and forgot the second. The offsets are the ones
        `Fleets.tsx` uses at all four of its call sites, taken off this craft's own
        drawn scale so the flame grows with the hull — `posedCraft` has already
        turned the authored nose onto +Z, so the stern is -Z.

        No lift term: the merchant has no `MODEL_POSE` entry, so `hullPoseLift` is
        zero for it and the hull sits at its own origin. The moment it is given a
        pose, this offset has to read that lift too (D154).
      */}
      <group position={[0, 0, -TRADE_SHIP_SCALE * 0.42]}>
        <Exhaust
          colour={TRADE_SHIP_FLAME}
          length={TRADE_SHIP_SCALE * 0.8}
          width={TRADE_SHIP_SCALE * 0.46}
        />
      </group>
      {onSelect && (
        <mesh name="trade-ship-hit" onPointerUp={pick} renderOrder={-1}>
          <sphereGeometry args={[TRADE_SHIP_HIT_RADIUS, 8, 6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
