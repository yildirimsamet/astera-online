import { analyticsHeaders, analyticsRecording, observe } from './runtime.js';
type Surface = 'public_landing' | 'native_landing';
let pending: { attemptId: string; surface: Surface; visit: string | undefined } | null = null;

/** Memory only, tied to the current permission scope; never reconstructs an earlier click. */
export function beginTrainingEntry(surface: Surface): string | null {
  if (!analyticsRecording()) return null;
  let attemptId: string;
  try { attemptId = crypto.randomUUID(); } catch { return null; }
  pending = { attemptId, surface, visit: analyticsHeaders()['x-analytics-visitor'] };
  observe('play_clicked', { surface, attemptId }, 'live');
  return attemptId;
}
function take() {
  const entry = pending; pending = null;
  return entry && analyticsRecording() && entry.visit === analyticsHeaders()['x-analytics-visitor'] ? entry : null;
}
export function finishTrainingEntry(): string | undefined { return take()?.attemptId; }
export function failTrainingEntry(attemptId?: string): void {
  if (attemptId && pending?.attemptId !== attemptId) return;
  const entry = take();
  if (entry) observe('training_load_failed', { surface: entry.surface, attemptId: entry.attemptId, code: 'unavailable' }, 'live');
}
