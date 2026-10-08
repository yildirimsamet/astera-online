import { Vector3, type Camera } from 'three';
import type { RivalMark } from '../api/schemas.js';
import { rivalSlotOf, type PlanetNode } from './scene.js';
import { commanderLabel } from '../lib/identity.js';

export const PLANET_LABEL_RANGE = 70;
const PAD = 8;
const GAP = 6;
const MAX_LABELS = 32;
const anchor = new Vector3();

export interface PlanetLabelPlacement {
  id: string;
  x: number;
  y: number;
  left: number;
  top: number;
  width: number;
  height: number;
  detail: boolean;
}

// Conservative text budgets, capped for long names. No font measurement or
// layout reads in the frame loop. Wider glyphs (e.g. Japanese) use two cells.
const textCells = (value: string): number => {
  let cells = 0;
  for (const character of value) cells += character.codePointAt(0)! > 0x2ff ? 2 : 1;
  return cells;
};
export function planetLabelWidth(node: PlanetNode, detail: boolean): number {
  if (detail) return 180;
  if (node.intel === 'REMEMBERED') return 150;
  const ownerWidth = node.kind === 'NEUTRAL' ? 0
    : textCells(commanderLabel(node.owner, node.clan?.tag)) * 5.5 + (node.country ? 16 : 0) + (node.dominionRank ? 16 : 0);
  return Math.min(150, Math.max(64, textCells(node.name) * 6 + 12, ownerWidth + 12));
}

/** Priority also decides who keeps a name when two worlds share screen space. */
export function planetLabelRank(node: PlanetNode, selectedId: string | null, rivals: readonly RivalMark[], now: number): number {
  if (node.id === selectedId) return 0;
  if (node.isOwned) return 1;
  if (node.isClanmate) return 2;
  if (node.dominionRank) return 3;
  if (rivalSlotOf(node, rivals) !== null) return 4;
  if (node.state.kind === 'RECOVERY' || node.state.kind === 'EMP' || (node.claimUntil?.getTime() ?? 0) > now) return 5;
  return node.stance === 'window' ? 6 : 7;
}

/**
 * Fixed-size, readable names: project only once per candidate and keep a bounded
 * pool of non-overlapping labels. No DOM reads or per-world React/Html frame work
 * for hundreds of worlds outside the current neighbourhood.
 */
export function layoutPlanetLabels({ nodes, camera, width, height, selectedId, rivals, now }: {
  nodes: readonly PlanetNode[];
  camera: Camera;
  width: number;
  height: number;
  selectedId: string | null;
  rivals: readonly RivalMark[];
  now: number;
}): PlanetLabelPlacement[] {
  if (width < 40 || height < 100) return [];
  const candidates: (PlanetLabelPlacement & { rank: number; range: number })[] = [];
  for (const node of nodes) {
    if (node.intel === 'UNKNOWN' && node.id !== selectedId) continue;
    anchor.set(node.position[0], node.position[1] + node.radius * 1.85, node.position[2]);
    const range = camera.position.distanceTo(anchor);
    if (range > PLANET_LABEL_RANGE) continue;
    anchor.project(camera);
    if (anchor.z < -1 || anchor.z > 1) continue;
    const x = (anchor.x + 1) * width / 2;
    const y = (1 - anchor.y) * height / 2;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > width || y < 0 || y > height) continue;
    const rank = planetLabelRank(node, selectedId, rivals, now);
    const detail = rank < 7;
    const boxWidth = Math.min(planetLabelWidth(node, detail), width - PAD * 2);
    const boxHeight = node.intel === 'UNKNOWN' ? 20 : (detail ? 56 : 38) + (node.intel === 'REMEMBERED' ? 13 : 0);
    candidates.push({ id: node.id, x, y, width: boxWidth, height: boxHeight, detail, rank, range,
      left: Math.max(PAD, Math.min(x - boxWidth / 2, width - PAD - boxWidth)),
      top: Math.max(PAD, Math.min(y - boxHeight, height - PAD - boxHeight)),
    });
  }
  candidates.sort((a, b) => a.rank - b.rank || a.range - b.range || a.id.localeCompare(b.id));
  const placed: PlanetLabelPlacement[] = [];
  for (const candidate of candidates) {
    if (placed.some((other) => candidate.left < other.left + other.width + GAP
      && candidate.left + candidate.width + GAP > other.left
      && candidate.top < other.top + other.height + GAP
      && candidate.top + candidate.height + GAP > other.top)) continue;
    placed.push(candidate);
    if (placed.length === MAX_LABELS) break;
  }
  return placed;
}
