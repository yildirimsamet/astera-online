import { sql } from 'drizzle-orm';
import { returnReminders } from '../db/schema.js';
const DAY = 86_400_000;
export function nextReturnCheck(absenceAt: Date, stage: number, nextRepairAt: Date | null): Date | null {
  const summary = stage < 2 ? new Date(absenceAt.getTime() + (stage === 0 ? 1 : 3) * DAY) : null;
  if (!summary) return nextRepairAt;
  return nextRepairAt && nextRepairAt < summary ? nextRepairAt : summary;
}
/** Reuse the row's current absence and stage when an order replaces its affordability appointment. */
export const plannedReturnCheck = sql`least(excluded.next_repair_at, CASE WHEN ${returnReminders.summaryStage} = 0 THEN ${returnReminders.absenceAt} + interval '24 hours' WHEN ${returnReminders.summaryStage} = 1 THEN ${returnReminders.absenceAt} + interval '72 hours' END)`;
