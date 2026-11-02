/** 32 fixed buckets (8 ms each); no frame trace, hardware string or per-frame event leaves the device. */
export class FrameObservations {
  private buckets = new Uint32Array(32);
  private previous: number | null = null;
  private count = 0;
  get size(): number { return this.buckets.length; }
  frame(at: number, active: boolean): void {
    if (!active) { this.previous = null; return; }
    const delta = this.previous === null ? 0 : at - this.previous;
    this.previous = at;
    if (delta <= 0 || delta > 250 || this.count >= 1_000_000) return;
    const index = Math.max(0, Math.min(31, Math.ceil(delta / 8) - 1));
    this.buckets[index] = (this.buckets[index] ?? 0) + 1; this.count++;
  }
  take(): { count: number; value: number } | null {
    if (!this.count) return null;
    const count = this.count, threshold = Math.ceil(count * 0.95);
    let sum = 0, value = 256;
    for (let i = 0; i < this.buckets.length; i++) {
      sum += this.buckets[i] ?? 0;
      if (sum >= threshold) { value = (i + 1) * 8; break; }
    }
    this.buckets.fill(0); this.count = 0;
    return { count, value };
  }
}
