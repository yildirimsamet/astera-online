import { matchupsAgainst, type ClassReading, type CombatClass, type WingMatchup } from '@astera/rules';

export type MatchupHint = { kind: 'BRING'; cls: CombatClass } | { kind: 'SINGLE' } | { kind: 'PROBE' };

/**
 * ONE HINT, AND ONLY WHEN IT CHANGES WHAT THE COMMANDER WOULD DO.
 *
 * Bring the class the reading names when the wing does not carry it; warn a
 * single-class wing that its counter may be in the part the probe left unread;
 * point a mixed reading at a stronger probe. Congratulating a correct choice
 * spends a line to say nothing, so a wing that already answers the wall gets null.
 */
export function matchupHint(m: WingMatchup): MatchupHint | null {
  if (m.beats !== null && !m.rows.some((row) => row.cls === m.beats)) return { kind: 'BRING', cls: m.beats };
  if (m.wingSingleClass && m.unknownShare > 0) return { kind: 'SINGLE' };
  if (m.kind === 'MIXED') return { kind: 'PROBE' };
  return null;
}

/**
 * THE CLASS A READING NAMES, or null where it names none (an even or unread wall): what each hull's
 * mark is read against where ships are built and picked (plan §5.5, F4c).
 */
export function namedWall(reading: ClassReading | null | undefined): CombatClass | null {
  return matchupsAgainst({}, reading ?? undefined)?.wall ?? null;
}
