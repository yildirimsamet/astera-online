import { FAULT } from '@astera/rules';
import type { IntelView, PlanetView, ReturnEntry } from '../api/schemas.js';

/**
 * WHILE YOU WERE AWAY: WHETHER TO SPEAK, AND WHICH THREE THINGS TO SAY. E10 · K5.
 *
 * The old overlay opened on nearly every return, because a phone reloads a
 * backgrounded tab, and it said whatever came first. It speaks now only after a real
 * absence with something to tell, and says at most three things: the threat first,
 * then the gain, then the opportunity — one of each where there is one, the rest
 * filled in the same order. Each line carries the one door that answers it.
 */

/** How long an absence has to be before the game tells its story. */
export const AWAY_THRESHOLD_MINUTES = 30;

const MAX_ROWS = 3;

export type AwayTone = 'alarm' | 'gain' | 'opportunity';
/**
 * Where a line's one action goes. The shell maps each to a page; the two that name a world
 * (a sighted world's dossier, a broken world's base) carry its id beside the door.
 */
export type AwayDoor = 'report' | 'intel' | 'base' | 'orbit' | 'signals' | 'dossier' | 'repair';

/** A watched world whose fleet the Telescope sees out, now: the mock's "Orin'in filosu ayrıldı". */
export interface Sighting {
  planetId: string;
  planetName: string;
  owner: string;
  /** Minutes until it is home again, where the Telescope can tell. */
  etaMinutes: number | null;
}

export type AwayRow =
  | { kind: 'entry'; entry: ReturnEntry; tone: AwayTone; door: AwayDoor }
  | { kind: 'sighting'; sighting: Sighting; tone: 'opportunity'; door: 'dossier' };

const ORDER: readonly AwayTone[] = ['alarm', 'gain', 'opportunity'];

function classify(entry: ReturnEntry): { tone: AwayTone; door: AwayDoor } {
  switch (entry.kind) {
    case 'raided':
      // A raid you held is good news, not a threat.
      return { tone: entry.params.grade === 'REPELLED' ? 'gain' : 'alarm', door: 'report' };
    case 'raid_result':
      return { tone: 'gain', door: 'report' };
    case 'scan_detected':
      return { tone: 'alarm', door: 'intel' };
    case 'convoy_result':
    case 'fleet_returned':
      return { tone: 'gain', door: 'signals' };
    case 'accrued':
      return { tone: 'gain', door: 'base' };
    case 'unlock':
      return { tone: 'opportunity', door: 'orbit' };
  }
}

export function shouldShowAway(story: { awayMinutes: number; entries: readonly ReturnEntry[] }): boolean {
  return story.awayMinutes >= AWAY_THRESHOLD_MINUTES && story.entries.length > 0;
}

/**
 * THE OPENINGS THE TELESCOPE HOLDS NOW (M4). Read live off its slots rather than stored
 * as a return entry: what matters is that the fleet is out now, not that it once left.
 * A world watched from two worlds is one opening.
 */
export function sightingsOf(watching: IntelView['watching']): Sighting[] {
  const seen = new Set<string>();
  const out: Sighting[] = [];
  for (const slot of watching) {
    if (slot.reading.status !== 'AWAY' || seen.has(slot.targetPlanetId)) continue;
    seen.add(slot.targetPlanetId);
    out.push({
      planetId: slot.targetPlanetId,
      planetName: slot.targetName,
      owner: slot.ownerName,
      etaMinutes: slot.reading.etaMinutes,
    });
  }
  return out;
}

/** The world that needs you most: its faults standing, and its loyalty where it is falling. */
export interface WorldCare {
  planetId: string;
  name: string;
  faults: number;
  /** Percent, or null where it is whole or cannot move. */
  loyalty: number | null;
}

/**
 * THE MOCK'S WARN LINE: "Thistle-88 sadakati %50 · 2 arıza duruyor · onar". A standing
 * fault is what drains a colony's loyalty (`FAULT`), so the line speaks only where one
 * stands — a gap you can close (K2's warn), with the door to the repairs.
 */
export function worldCare(worlds: readonly PlanetView[]): WorldCare | null {
  let worst: WorldCare | null = null;
  for (const world of worlds) {
    const faults = world.faults?.length ?? 0;
    if (faults === 0) continue;
    const value = world.loyalty?.value ?? null;
    const loyalty = value === null || value >= FAULT.loyaltyMax ? null : Math.round(value);
    const care = { planetId: world.planet.id, name: world.planet.name, faults, loyalty };
    if (!worst || faults > worst.faults || (faults === worst.faults && (loyalty ?? 101) < (worst.loyalty ?? 101))) {
      worst = care;
    }
  }
  return worst;
}

export function awayRows(entries: readonly ReturnEntry[], sightings: readonly Sighting[] = []): AwayRow[] {
  const told: AwayRow[] = entries.map((entry) => ({ kind: 'entry' as const, entry, ...classify(entry) }));
  const seen: AwayRow[] = sightings.map((sighting) => ({ kind: 'sighting' as const, sighting, tone: 'opportunity' as const, door: 'dossier' as const }));
  /* A live opening outranks a remembered one within its kind, so sightings lead; entries newest first. */
  const at = (row: AwayRow): number => (row.kind === 'entry' ? row.entry.at.getTime() : Number.POSITIVE_INFINITY);
  const groups = ORDER.map((tone) => [...seen, ...told]
    .filter((row) => row.tone === tone)
    .sort((a, b) => at(b) - at(a)));
  const picked: AwayRow[] = [];
  // One of each kind first…
  for (const group of groups) {
    const first = group.shift();
    if (first) picked.push(first);
  }
  // …then the rest, in the same order, until three.
  for (const group of groups) {
    while (picked.length < MAX_ROWS && group.length > 0) picked.push(group.shift()!);
  }
  return picked
    .slice(0, MAX_ROWS)
    .sort((a, b) => ORDER.indexOf(a.tone) - ORDER.indexOf(b.tone));
}
