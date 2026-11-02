/** Coalesces wakeups, with durable rows as the backlog. No request closures or payloads are retained. */
export class AnalyticsRecorder {
  private flight: Promise<void> | null = null;
  private stopped = false;
  private readonly timer: ReturnType<typeof setInterval>;
  constructor(private recover: () => Promise<void>, private failed: (error: unknown) => void) {
    this.timer = setInterval(() => { this.wake(); }, 60_000); this.timer.unref();
  }
  get pending(): number { return this.flight ? 1 : 0; }
  wake(): void {
    if (this.stopped || this.flight) return;
    this.flight = Promise.resolve().then(this.recover).catch(this.failed).finally(() => { this.flight = null; });
  }
  async close(): Promise<void> { this.stopped = true; clearInterval(this.timer); await closeAnalyticsWork(this.flight, this.failed); }
}

/** Optional observation work cannot hold application shutdown indefinitely. */
export async function closeAnalyticsWork(flight: Promise<void> | null, failed: (error: unknown) => void): Promise<void> {
  if (!flight) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const finished = await Promise.race([flight.then(() => true), new Promise<boolean>(resolve => {
      timer = setTimeout(() => { resolve(false); }, 5000);
    })]);
    if (!finished) failed(new Error('Optional analytics work did not finish before shutdown deadline'));
  } finally { clearTimeout(timer); }
}
