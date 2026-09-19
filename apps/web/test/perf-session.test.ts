import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  perfGalaxyFrame,
  perfSessionState,
  resetPerfSession,
  retryPerfSession,
  setPerfExtra,
  setPerfGalaxyContext,
  startPerfSession,
  stopPerfSession,
  type PerfPayload,
} from '../src/lib/perfSession.js';

/**
 * THE RECORDING, FROM START TO THE ROW ON THE SERVER. Owner request, 2026-09-19.
 * One sample a second while it runs, whatever screen is open; the galaxy adds what
 * it drew and what was on the disc; stopping sends the lot, and a failed send can
 * be tried again without losing the recording.
 */

const info = { calls: 150, triangles: 90_000, geometries: 60, textures: 40, programs: 25 };

describe('a performance recording', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'],
    });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => {
      cb(performance.now());
    }, 16));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      clearTimeout(id);
    });
    resetPerfSession();
  });
  afterEach(() => {
    resetPerfSession();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('is idle until started, and samples once a second while it runs', () => {
    expect(perfSessionState().status).toBe('idle');
    startPerfSession();
    expect(perfSessionState().status).toBe('recording');
    setPerfGalaxyContext({ planets: 1230, flights: 3 });
    for (let i = 0; i < 24; i += 1) perfGalaxyFrame(3, info);
    vi.advanceTimersByTime(3000);
    expect(perfSessionState().seconds).toBe(3);
  });

  it('ignores galaxy frames while nothing is recording', () => {
    perfGalaxyFrame(3, info);
    expect(perfSessionState().seconds).toBe(0);
  });

  it('sends the device, the summary and every sample when stopped', async () => {
    const send = vi.fn((_payload: PerfPayload) => Promise.resolve({ id: 'row' }));
    startPerfSession();
    setPerfGalaxyContext({ planets: 1230 });
    for (let i = 0; i < 30; i += 1) perfGalaxyFrame(4, info);
    vi.advanceTimersByTime(2000);
    await stopPerfSession(send);

    expect(send).toHaveBeenCalledOnce();
    const payload = send.mock.calls[0]![0];
    expect(payload.samples.length).toBeGreaterThanOrEqual(2);
    expect(payload.samples[0]).toMatchObject({ fps: 30, calls: 150, galaxy: true, ctx: { planets: 1230 } });
    expect(payload.device.dpr).toBeGreaterThan(0);
    expect(payload.device.quality).toMatch(/^(high|balanced|low)$/);
    expect(payload.summary.seconds).toBe(payload.samples.length);
    expect(new Date(payload.endedAt).getTime()).toBeGreaterThanOrEqual(new Date(payload.startedAt).getTime());
    expect(perfSessionState().status).toBe('sent');
  });

  it('keeps the recording when the send fails, and sends it again on retry', async () => {
    const send = vi.fn<(payload: PerfPayload) => Promise<{ id: string }>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ id: 'row' });
    startPerfSession();
    vi.advanceTimersByTime(2000);
    await stopPerfSession(send);
    expect(perfSessionState().status).toBe('failed');
    await retryPerfSession(send);
    expect(perfSessionState().status).toBe('sent');
    expect(send.mock.calls[1]![0]).toEqual(send.mock.calls[0]![0]);
  });

  it('marks the seconds the galaxy was not on screen', async () => {
    const send = vi.fn((_payload: PerfPayload) => Promise.resolve({ id: 'row' }));
    startPerfSession();
    setPerfGalaxyContext(null);
    vi.advanceTimersByTime(1000);
    await stopPerfSession(send);
    expect(send.mock.calls[0]![0].samples[0]).toMatchObject({ galaxy: false });
  });

  /**
   * WHAT THE PLAYER WAS DOING, NOT ONLY WHAT WAS ON THE DISC. The first recording
   * could not say why draw calls jumped to 473 at the end; the camera's range, a
   * focused subject and an open sheet ride beside every second now.
   */
  it('carries the camera, the focus and the open sheet beside the disc', async () => {
    const send = vi.fn((_payload: PerfPayload) => Promise.resolve({ id: 'row' }));
    startPerfSession();
    setPerfGalaxyContext({ planets: 1230 });
    setPerfExtra('camera', 42);
    setPerfExtra('focus', 1);
    setPerfExtra('panel', 1);
    vi.advanceTimersByTime(1000);
    await stopPerfSession(send);
    expect(send.mock.calls[0]![0].samples[0]?.ctx).toEqual({ planets: 1230, camera: 42, focus: 1, panel: 1 });
  });
});
