import type { ReturnEntry } from '../api/schemas.js';

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
/** Where a line's one action goes. The shell maps each to a page. */
export type AwayDoor = 'report' | 'intel' | 'base' | 'orbit' | 'signals';

export interface AwayRow {
  entry: ReturnEntry;
  tone: AwayTone;
  door: AwayDoor;
}

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

export function awayRows(entries: readonly ReturnEntry[]): AwayRow[] {
  const groups = ORDER.map((tone) => entries
    .map((entry) => ({ entry, ...classify(entry) }))
    .filter((row) => row.tone === tone)
    .sort((a, b) => b.entry.at.getTime() - a.entry.at.getTime()));
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
