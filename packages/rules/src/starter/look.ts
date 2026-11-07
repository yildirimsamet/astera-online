import { repairProgress, type VesselProgress } from './ladder.js';

/** Three hulls, so that a galaxy of ships is not one ship copied. Plan §3.11. */
export const VESSEL_HULLS = ['SPINE', 'WEDGE', 'SEED'] as const;
export type VesselHull = (typeof VESSEL_HULLS)[number];

export const VESSEL_LOOKS = ['WRECKED', 'PATCHED', 'RENEWED'] as const;
export type VesselLook = (typeof VESSEL_LOOKS)[number];

const PATCHED_FROM = 0.35;
const RENEWED_FROM = 0.8;

/** How far along the hull has come. The owner's own ship only: anyone else's is a probe's to read. */
export const lookOfShare = (share: number): VesselLook => {
  if (share < PATCHED_FROM) return 'WRECKED';
  return share < RENEWED_FROM ? 'PATCHED' : 'RENEWED';
};

export const vesselLook = (progress: VesselProgress): VesselLook => lookOfShare(repairProgress(progress).share);

/** FNV-1a. A ship keeps its hull for life, and needs no column to do it. */
export function vesselHull(id: string): VesselHull {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 0x01000193);
  return VESSEL_HULLS[(hash >>> 0) % VESSEL_HULLS.length]!;
}
