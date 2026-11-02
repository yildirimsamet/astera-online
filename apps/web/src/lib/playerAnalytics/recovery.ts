import { z } from 'zod';
import { analyticsHeaders, analyticsRecording, observe } from './runtime.js';
const failureCode = z.object({ code: z.string().regex(/^[A-Z0-9_]{1,128}$/) });

/** Only request stages cross this boundary; callback inputs and results never do. */
export async function observeRecovery<T>(stage: 'request' | 'complete', operation: () => Promise<T>): Promise<T> {
  if (!analyticsRecording()) return operation();
  let attemptId: string;
  try { attemptId = crypto.randomUUID(); } catch { return operation(); }
  const visit = analyticsHeaders()['x-analytics-visitor'];
  const report = (phase: string, code?: string) => {
    if (analyticsRecording() && visit === analyticsHeaders()['x-analytics-visitor']) {
      observe('recovery_result', { attemptId, subject: 'password_reset', phase, ...(code ? { code } : {}) }, 'live');
    }
  };
  report(`${stage}_attempted`);
  try {
    const result = await operation();
    report(stage === 'request' ? 'challenge_issued' : 'completed');
    return result;
  } catch (error) {
    const parsed = failureCode.safeParse(error);
    report(`${stage}_failed`, parsed.success ? parsed.data.code : 'unavailable');
    throw error;
  }
}
