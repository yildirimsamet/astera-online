import { z } from 'zod';
import { BRAND_RECALL } from '@astera/rules';

const schema = z.object({
  activeMs: z.number().finite().min(0).max(BRAND_RECALL.delayMs),
  returnShown: z.boolean(),
  quizDone: z.boolean(),
});
export type RecallProgress = z.infer<typeof schema>;
const initial = (): RecallProgress => ({ activeMs: 0, returnShown: false, quizDone: false });
const key = (accountId: string) => `astera:recall:v1:${accountId}`;

export function readRecall(accountId: string): RecallProgress {
  try {
    const parsed = schema.safeParse(JSON.parse(localStorage.getItem(key(accountId)) ?? 'null'));
    return parsed.success ? parsed.data : initial();
  } catch { return initial(); }
}

export function saveRecall(accountId: string, progress: RecallProgress): RecallProgress {
  const other = readRecall(accountId);
  const merged = {
    activeMs: Math.max(progress.activeMs, other.activeMs),
    returnShown: progress.returnShown || other.returnShown,
    quizDone: progress.quizDone || other.quizDone,
  };
  try { localStorage.setItem(key(accountId), JSON.stringify(merged)); } catch { /* In-memory progress remains usable in private browsers. */ }
  return merged;
}

export function advanceRecall(progress: RecallProgress, deltaMs: number): RecallProgress {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return progress;
  return { ...progress, activeMs: Math.min(BRAND_RECALL.delayMs, progress.activeMs + deltaMs) };
}
