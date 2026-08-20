import type { ReactNode } from 'react';
import type { HullId } from '@astera/rules';
import type { IconProps } from './index.js';

/**
 * HULL SILHOUETTES — 48 × 48, filled rather than stroked.
 *
 * These are the one place the icon set uses fills, and `docs/visual-design.md` says
 * why: they need to read as *things* rather than as symbols. One viewing angle for all
 * five — top-down, nose up — chosen once and never mixed, because they have to be
 * separable **as shapes alone**:
 *
 *     WASP ▸ BULWARK ▸ LANCE ▸ WASP
 *
 * That counter cycle is the only combat skill in the game. If a player cannot tell a
 * Lance from a Wasp at a glance, the one decision combat offers stops being a decision.
 * So the five silhouettes are pushed apart deliberately:
 *
 *   WASP     small, sharp, mostly negative space — a thrown blade
 *   LANCE    extremely long and thin with a spinal gun projecting past the nose
 *   BULWARK  wide, blunt, slab-sided, not a single point on it
 *   HAULER   fat, lumpy, symmetrical, visibly unarmed — it must look defenceless
 *   BASTION  a turret on a heavy base plate, no engines and no wings. The plate is
 *            the whole point: it is what says this thing can never leave the planet.
 *   THORN    the same base plate — because it also never leaves — carrying three
 *            thin spikes instead of one heavy barrel. Read side by side with a
 *            Bastion the plate says "ground" and the spikes say "many, light".
 */

function Silhouette({
  children,
  className = 'size-8',
  title,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="currentColor"
      {...(title === undefined ? { 'aria-hidden': true } : { role: 'img' })}
    >
      {title === undefined ? null : <title>{title}</title>}
      {children}
    </svg>
  );
}

/** Cheapest damage, fastest home. The shortest time spent undefended. */
export function WaspHull(props: IconProps) {
  return (
    <Silhouette {...props}>
      {/* Wide swept wings and a lot of empty space around them. It has to be the
          thing on the row you could cut yourself on. */}
      <path d="M24 3.2 26.9 19 44.5 33.4 43.4 38.4 28.3 31.4 27.5 40.2 29.8 44.8 24 46.4 18.2 44.8 20.5 40.2 19.7 31.4 4.6 38.4 3.5 33.4 21.1 19Z" />
    </Silhouette>
  );
}

/** Hits hardest. Shreds Wasps, bounces off Bulwarks. All weapon, no armour. */
export function LanceHull(props: IconProps) {
  return (
    <Silhouette {...props}>
      {/* The spinal gun projects past the nose and is the whole silhouette: a long
          thin spine with a barrel on the front. All weapon, no armour. */}
      <path d="M22.7 1.4h2.6v10.2l2.5 3.2.5 15.4 5.4 3.2.4 5.4-5.7-2.2-.4 6.6L24 46.6l-4-3.4-.4-6.6-5.7 2.2.4-5.4 5.4-3.2.5-15.4 2.5-3.2Z" />
    </Silhouette>
  );
}

/** Survives what kills everything else. Nearly doubles your time away. */
export function BulwarkHull(props: IconProps) {
  return (
    <Silhouette {...props}>
      {/* Wider than it is long, flat-nosed, and stepped down the sides like bolted
          armour. Not one point on it. */}
      <path d="M13.5 9h21l5 5.2h5.5v6.6l-3.6 1.8 1 8.4-4 1.6-2.4 6.4h-24l-2.4-6.4-4-1.6 1-8.4L2.5 20.8v-6.6H8Z" />
    </Silhouette>
  );
}

/** Carries the loot home. Useless in the fight — escort it or lose it. */
export function HaulerHull(props: IconProps) {
  return (
    <Silhouette {...props}>
      {/* Four container blocks bolted to a fat body. Lumpy, symmetrical, and with
          nothing anywhere on it that could be a weapon. */}
      <path d="M19 5.5h10l3 4.5v3h6v8h-6v6h6v8h-6v4l-3 4H19l-3-4v-4h-6v-8h6v-6h-6v-8h6v-3Z" />
      {/* Two token engines, and deliberately token. A Hauler contributes nothing to
          the fight and the silhouette must not imply otherwise. */}
      <rect x="19.2" y="41.4" width="3.8" height="3.6" rx="1.2" />
      <rect x="25" y="41.4" width="3.8" height="3.6" rx="1.2" />
    </Silhouette>
  );
}

/** Ground defence. It can never leave, and the base plate is what says so. */
/**
 * Shares the Bastion's plate on purpose. The plate is the family mark for "this
 * never leaves"; what differs is the armament, which is what the player is choosing
 * between — one heavy barrel or a bank of light spikes.
 */
export function ThornHull(props: IconProps) {
  return (
    <Silhouette {...props}>
      {/* The same plate, so the pair reads as one family. */}
      <path d="M4.5 45.2 8.8 36.4h30.4l4.3 8.8Z" />
      {/* A low, wide mount rather than the Bastion's tall drum. */}
      <path d="M11.2 35.2v-5.6h25.6v5.6Z" />
      {/* Three spikes: many and light, against the Bastion's single heavy barrel. */}
      <path d="M13.4 28.4 16.1 9.6l2.7 18.8Z" />
      <path d="M21.3 28.4 24 4.8l2.7 23.6Z" />
      <path d="M29.2 28.4 31.9 9.6l2.7 18.8Z" />
    </Silhouette>
  );
}

export function BastionHull(props: IconProps) {
  return (
    <Silhouette {...props}>
      {/* The plate, first and widest — the silhouette's whole argument. */}
      <path d="M4.5 45.2 8.8 36.4h30.4l4.3 8.8Z" />
      <path d="M14.6 35.2v-8.4a9.4 9.4 0 0 1 18.8 0v8.4Z" />
      <path d="M21.3 27.4V6.2h5.4v21.2Z" />
    </Silhouette>
  );
}

/**
 * The Prospector: a hauler's body with a cutting head, and no gun anywhere.
 *
 * Deliberately the only silhouette with an asymmetric nose. A player scanning the
 * shipyard should be able to tell at a glance that this one does not fight —
 * every other hull here reads as a weapon pointed forward.
 */
function ProspectorHull(props: IconProps) {
  return (
    <Silhouette {...props}>
      {/* The hold, deep and slab-sided. */}
      <path d="M9.6 38.4h28.8v9.2H9.6Z" />
      <path d="M12.8 20.4h22.4v18H12.8Z" />
      {/* The cutting head, offset to one side and unmistakably not a barrel. */}
      <path d="M17.2 20.4V9.6h6.2v10.8Z" />
      <path d="M14.4 9.6h11.8l-2.6-5.2h-6.6Z" />
      <path d="M27.6 24.4h7.8v5.2h-7.8Z" />
    </Silhouette>
  );
}

const HULL_ICON: Record<HullId, (props: IconProps) => ReactNode> = {
  WASP: WaspHull,
  LANCE: LanceHull,
  BULWARK: BulwarkHull,
  HAULER: HaulerHull,
  BASTION: BastionHull,
  THORN: ThornHull,
  PROSPECTOR: ProspectorHull,
};

/**
 * The silhouette for a hull id.
 *
 * Used where a hull is chosen at runtime — the launch composer, loss lines in a battle
 * report — so those surfaces cannot drift out of sync with the five above.
 */
export function HullMark({ hull, ...props }: IconProps & { hull: HullId }) {
  const Mark = HULL_ICON[hull];
  return <Mark {...props} />;
}
