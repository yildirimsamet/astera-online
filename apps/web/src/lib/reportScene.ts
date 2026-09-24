import { ALL_HULLS, HULLS, counteredBy, type CombatClass, type Fleet, type HullId } from '@astera/rules';

/**
 * WHY THE READER LOST WHAT THEY LOST, FROM THE CLASS DATA. Spec B15.
 *
 * The class the reader lost the most of, what is strong against it, and what is strong
 * against that. A statement of the counter cycle, never a claim about the other side's
 * fleet — the report does not carry it (rule 15), so the sentence cannot say "their
 * Lances" and stays true either way. Null when nothing that fights was lost.
 */
export function lossReason(losses: Fleet): { lost: CombatClass; by: CombatClass; bring: CombatClass } | null {
  const byClass = new Map<CombatClass, number>();
  for (const hull of ALL_HULLS) {
    const count = losses[hull] ?? 0;
    const cls = HULLS[hull].cls;
    if (count <= 0 || cls === 'SUPPORT') continue;
    byClass.set(cls, (byClass.get(cls) ?? 0) + count);
  }
  let lost: CombatClass | null = null;
  for (const [cls, count] of byClass) {
    if (lost === null || count > (byClass.get(lost) ?? 0)) lost = cls;
  }
  if (lost === null) return null;
  const by = counteredBy(lost);
  return { lost, by, bring: counteredBy(by) };
}

export interface SideRow {
  hull: HullId;
  sent: number;
  lost: number;
  left: number;
}

/** Every hull a side brought, with what it lost and what is left, in the roster's order. */
export function sentAndLeft(sent: Fleet, losses: Fleet): SideRow[] {
  const rows: SideRow[] = [];
  for (const hull of ALL_HULLS) {
    const count = sent[hull] ?? 0;
    if (count <= 0) continue;
    const lost = Math.min(count, losses[hull] ?? 0);
    rows.push({ hull, sent: count, lost, left: count - lost });
  }
  return rows;
}
