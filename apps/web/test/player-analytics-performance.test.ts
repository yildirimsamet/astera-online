import { expect, it } from 'vitest';
import { FrameObservations } from '../src/lib/playerAnalytics/performance.js';
it('uses bounded buckets, ignores background/suspension gaps and emits only an aggregate', () => {
  const frames = new FrameObservations();
  frames.frame(0, true); for (let i = 1; i <= 1000; i++) frames.frame(i * 16, true);
  expect(frames.size).toBeLessThanOrEqual(32);
  expect(frames.take()).toEqual({ count: 1000, value: 16 });
  frames.frame(1_000_000, false); frames.frame(1_000_016, true);
  expect(frames.take()).toBeNull();
  expect(JSON.stringify(frames)).not.toContain('1000000');
});
