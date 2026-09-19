import { useSyncExternalStore } from 'react';
import { renderQuality } from './quality.js';
import {
  createPerfRecorder,
  type PerfRecorder,
  type PerfSample,
  type PerfSummary,
  type RendererCounts,
} from './perfRecorder.js';

/**
 * ONE PERFORMANCE RECORDING AT A TIME, DRIVEN FROM THE ADMIN PANEL. Owner request,
 * 2026-09-19.
 *
 * Module state rather than a component's, because the recording has to outlive the
 * sheet that started it: the owner opens the panel, taps record, closes it and
 * plays. Everything that feeds the recorder lives here — a display-rate
 * `requestAnimationFrame` for stalls, the Long Tasks and Resource Timing observers
 * where the browser has them, and a one-second clock that closes each sample — and
 * the galaxy adds its own frames through `perfGalaxyFrame`.
 */

export type PerfStatus = 'idle' | 'recording' | 'sending' | 'sent' | 'failed';

export interface PerfState {
  status: PerfStatus;
  seconds: number;
  summary: PerfSummary | null;
}

export interface PerfPayload {
  startedAt: string;
  endedAt: string;
  device: {
    userAgent: string;
    dpr: number;
    width: number;
    height: number;
    quality: string;
    refreshHz: number | null;
    cores: number | null;
    memoryGb: number | null;
  };
  summary: PerfSummary;
  samples: readonly PerfSample[];
}

export type PerfSend = (payload: PerfPayload) => Promise<unknown>;

let state: PerfState = { status: 'idle', seconds: 0, summary: null };
let recorder: PerfRecorder | null = null;
let startedAt = 0;
let startedWall = new Date(0);
let payload: PerfPayload | null = null;
let galaxyContext: Record<string, number> | null = null;
/** What the player was doing: camera range, a focused subject, an open sheet. */
let extras: Record<string, number> = {};
let displayGaps: number[] = [];
let lastDisplay: number | null = null;
let rafHandle = 0;
let clockHandle: ReturnType<typeof setInterval> | null = null;
let observers: PerformanceObserver[] = [];

const listeners = new Set<() => void>();
const publish = (next: Partial<PerfState>): void => {
  state = { ...state, ...next };
  for (const notify of listeners) notify();
};

export const perfSessionState = (): PerfState => state;
export const usePerfSession = (): PerfState =>
  useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    perfSessionState,
    perfSessionState,
  );

export const perfRecording = (): boolean => state.status === 'recording';

/** The galaxy reports what is on the disc; `null` when it is not mounted. */
export function setPerfGalaxyContext(context: Record<string, number> | null): void {
  galaxyContext = context;
}

/**
 * One number about what the player was doing, carried beside the disc's context
 * in every sample. The first recording could not say why draw calls jumped at the
 * end; the camera's range, a focused subject and an open sheet can.
 */
export function setPerfExtra(key: 'camera' | 'focus' | 'panel', value: number): void {
  extras[key] = value;
}

/** One frame the galaxy drew: its CPU submission time and what it drew. */
export function perfGalaxyFrame(renderMs: number, counts: RendererCounts): void {
  recorder?.galaxyFrame(renderMs, counts);
}

const heapMb = (): number | null => {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return memory ? Math.round((memory.usedJSHeapSize / 1_048_576) * 10) / 10 : null;
};

const onDisplay = (at: number): void => {
  rafHandle = requestAnimationFrame(onDisplay);
  if (lastDisplay !== null && displayGaps.length < 600) displayGaps.push(at - lastDisplay);
  lastDisplay = at;
  recorder?.displayFrame(at);
};

function observe(type: string, each: (entry: PerformanceEntry) => void): void {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) each(entry);
    });
    observer.observe({ type, buffered: false });
    observers.push(observer);
  } catch {
    // Safari has no Long Tasks API; the rest of the recording still stands.
  }
}

function teardown(): void {
  if (rafHandle !== 0) cancelAnimationFrame(rafHandle);
  rafHandle = 0;
  if (clockHandle !== null) clearInterval(clockHandle);
  clockHandle = null;
  for (const observer of observers) observer.disconnect();
  observers = [];
}

const refreshHz = (): number | null => {
  if (displayGaps.length < 10) return null;
  const sorted = [...displayGaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  return median > 0 ? Math.round(1000 / median) : null;
};

export function startPerfSession(): void {
  if (state.status === 'recording' || state.status === 'sending') return;
  startedAt = performance.now();
  startedWall = new Date();
  recorder = createPerfRecorder(startedAt);
  payload = null;
  displayGaps = [];
  lastDisplay = null;
  rafHandle = requestAnimationFrame(onDisplay);
  observe('longtask', (entry) => recorder?.longTask(entry.duration));
  observe('resource', (entry) => {
    const size = (entry as PerformanceResourceTiming).transferSize;
    recorder?.resource((Number.isFinite(size) ? size : 0) / 1024);
  });
  clockHandle = setInterval(() => {
    const active = recorder;
    if (!active) return;
    active.flush(performance.now(), {
      heapMb: heapMb(),
      galaxy: galaxyContext !== null,
      hidden: typeof document !== 'undefined' && document.visibilityState === 'hidden',
      ctx: { ...(galaxyContext ?? {}), ...extras },
    });
    publish({ seconds: active.samples().length });
  }, 1000);
  publish({ status: 'recording', seconds: 0, summary: null });
}

async function send(sendFn: PerfSend): Promise<void> {
  if (!payload) return;
  publish({ status: 'sending' });
  try {
    await sendFn(payload);
    publish({ status: 'sent' });
  } catch {
    publish({ status: 'failed' });
  }
}

/** Stop, summarise and send. The recording is kept until a new one starts. */
export async function stopPerfSession(sendFn: PerfSend): Promise<void> {
  if (state.status !== 'recording' || !recorder) return;
  teardown();
  const summary = recorder.summary();
  payload = {
    startedAt: startedWall.toISOString(),
    endedAt: new Date().toISOString(),
    device: {
      userAgent: navigator.userAgent.slice(0, 400),
      dpr: window.devicePixelRatio || 1,
      width: window.innerWidth,
      height: window.innerHeight,
      quality: renderQuality(),
      refreshHz: refreshHz(),
      cores: navigator.hardwareConcurrency || null,
      memoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
    },
    summary,
    samples: recorder.samples(),
  };
  recorder = null;
  publish({ summary, seconds: payload.samples.length });
  await send(sendFn);
}

export async function retryPerfSession(sendFn: PerfSend): Promise<void> {
  if (state.status !== 'failed') return;
  await send(sendFn);
}

/** Back to nothing. For tests, and for a recording the owner throws away. */
export function resetPerfSession(): void {
  teardown();
  recorder = null;
  payload = null;
  galaxyContext = null;
  extras = {};
  publish({ status: 'idle', seconds: 0, summary: null });
}
