import { pino } from 'pino';
import { afterAll, afterEach, expect, it, vi } from 'vitest';
import { EventWorker } from '../src/worker/loop.js';
import * as maintenance from '../src/services/silentSpace.js';
import { seedWorld, testDb } from './helpers.js';
afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => { await (await testDb()).close(); });
const log = pino({ level: 'silent' });
it('runs maintenance independently, once per five minutes, and waits on stop', async () => {
  const f = await seedWorld(0);
  let release: (() => void) | undefined;
  const sweep = vi.spyOn(maintenance, 'runSilentSpaceSweep').mockImplementation(() => new Promise(resolve => {
    release = () => { resolve({ ran: true, checked: 0, movedOut: 0, returned: 0, deferred: {}, failed: 0 }); };
  }));
  const worker = new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 10, staleMinutes: 5, silentSpaceEnabled: true }, log);
  await worker.tick(); // Must finish even though the sweep is still pending.
  expect(sweep).toHaveBeenCalledTimes(1);
  f.clock.advance(6);
  await worker.tick();
  expect(sweep).toHaveBeenCalledTimes(1);
  release!();
  await worker.stop();
});
it('keeps the five minute cadence after failures and never enables destructive reclaim', async () => {
  const f = await seedWorld(0);
  const sweep = vi.spyOn(maintenance, 'runSilentSpaceSweep').mockRejectedValue(new Error('maintenance unavailable'));
  const worker = new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 10, staleMinutes: 5, silentSpaceEnabled: true }, log);
  expect((await worker.tick()).reclaimed).toBe(0);
  // Finish the independent rejection handler before advancing the injected clock.
  await new Promise<void>(resolve => setImmediate(resolve));
  f.clock.advance(4);
  await worker.tick();
  expect(sweep).toHaveBeenCalledTimes(1);
  f.clock.advance(1);
  await worker.tick();
  expect(sweep).toHaveBeenCalledTimes(2);
  await worker.stop();
});
it('does not start maintenance when disabled', async () => {
  const f = await seedWorld(0);
  const sweep = vi.spyOn(maintenance, 'runSilentSpaceSweep');
  const worker = new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 10, staleMinutes: 5 }, log);
  await worker.tick();
  expect(sweep).not.toHaveBeenCalled();
});
it('does not spend the next five-minute opportunity before the persisted lease is due', async () => {
  const f = await seedWorld(0);
  let finish: (() => void) | undefined;
  const sweep = vi.spyOn(maintenance, 'runSilentSpaceSweep').mockImplementation(() => new Promise(resolve => {
    finish = () => { resolve({ ran: true, checked: 0, movedOut: 0, returned: 0, deferred: {}, failed: 0 }); };
  }));
  const worker = new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 10, staleMinutes: 5, silentSpaceEnabled: true }, log);
  await worker.tick();
  // The database lease reads its clock after the tick started, not at tick entry.
  f.clock.advance(1);
  finish!();
  await new Promise<void>(resolve => setImmediate(resolve));
  f.clock.advance(4);
  await worker.tick();
  expect(sweep).toHaveBeenCalledTimes(1);
  f.clock.advance(1);
  await worker.tick();
  expect(sweep).toHaveBeenCalledTimes(2);
  finish!();
  await worker.stop();
});
