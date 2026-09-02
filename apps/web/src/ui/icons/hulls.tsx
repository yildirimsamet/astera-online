import type { ReactNode } from 'react';
import type { HullId } from '@astera/rules';
import type { IconProps } from './index.js';
import { FLEET_V2_ASSET_MANIFEST } from '../fleet-v2-assets.js';

/**
 * PRESERVED HULL SILHOUETTES — 48 × 48, filled rather than stroked.
 *
 * These are the one place the icon set uses fills, and `docs/visual-design.md` says
 * why: they need to read as *things* rather than as symbols. One viewing angle for all
 * one — top-down, nose up — chosen once and never mixed. Fleet V2 mobile craft use
 * their canonical supplied icon renders below; these hand-authored marks remain only
 * for the three preserved craft whose assets were explicitly left unchanged:
 *
 *   BASTION  a turret on a heavy base plate, no engines and no wings. The plate is
 *            the whole point: it is what says this thing can never leave the planet.
 *   THORN    the same base plate — because it also never leaves — carrying three
 *            thin spikes instead of one heavy barrel. Read side by side with a
 *            Bastion the plate says "ground" and the spikes say "many, light".
 *   PROSPECTOR a deep hold with an asymmetric cutting head, unmistakably not a gun
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

const PRESERVED_HULL_ICON = {
  BASTION: BastionHull,
  THORN: ThornHull,
  PROSPECTOR: ProspectorHull,
} as const;
const FLEET_V2_ICON_IDS = new Set<string>(Object.keys(FLEET_V2_ASSET_MANIFEST));

/**
 * The silhouette for a hull id.
 *
 * Used where a hull is chosen at runtime — the launch composer, loss lines in a battle
 * report — so those surfaces cannot drift out of sync with the silhouettes above.
 */
export function HullMark({ hull, className = 'size-8', title }: IconProps & { hull: HullId }) {
  if (FLEET_V2_ICON_IDS.has(hull)) {
    const asset = FLEET_V2_ASSET_MANIFEST[hull as keyof typeof FLEET_V2_ASSET_MANIFEST];
    return (
      <img
        src={asset.icon}
        className={className}
        alt={title ?? ''}
        draggable={false}
        {...(title === undefined ? { 'aria-hidden': true } : {})}
      />
    );
  }
  const Mark = PRESERVED_HULL_ICON[hull as keyof typeof PRESERVED_HULL_ICON];
  return <Mark className={className} {...(title === undefined ? {} : { title })} />;
}
