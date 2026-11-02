import { closeAnalyticsWork } from './analyticsRecorder.js';
/** One bounded maintenance owner; a slow sweep cannot accumulate another sweep. */
export function startAnalyticsMaintenance(sweep: () => Promise<void>, failed: (error: unknown) => void): () => Promise<void> {
  let flight: Promise<void> | null = null;
  const run = () => {
    if (flight) return;
    flight = sweep().catch(failed).finally(() => { flight = null; });
  };
  run();
  const timer = setInterval(run, 3_600_000); timer.unref();
  return async () => { clearInterval(timer); await closeAnalyticsWork(flight, failed); };
}
