/**
 * THE OWNER'S PERFORMANCE RECORDER. Owner request, 2026-09-19.
 *
 * *"Oyunu telefonumda belirli süre oynayacağım; bakalım neler artıyor, neler cihazı
 * zorluyor, peak seviyeler neler, ortalama neler."* This is the arithmetic: feed it
 * what the device reports, close each second with `flush`, and it keeps one sample
 * a second and summarises the lot. Pure — no clock, no DOM — so every figure the
 * summary prints is one a test has checked.
 *
 * TWO DIFFERENT RATES, AND THE DIFFERENCE MATTERS. `fps` is the frames the galaxy
 * DREW, which on a demand-rendered disc is 24–30 when nothing moves by design. A
 * STALL is measured on the DISPLAY's own frames (`displayFrame`, a separate
 * `requestAnimationFrame` loop), because a phone that freezes for half a second
 * freezes every screen, drawn or not.
 */

export const PERF_MAX_SAMPLES = 2 * 60 * 60;

/** A display frame this late is a hitch the player can feel… */
const HITCH_MS = 50;
/** …and this late, a freeze. */
const FREEZE_MS = 250;

export interface RendererCounts {
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
}

/** What the rest of the app reports at the end of each second. */
export interface PerfContext {
  heapMb: number | null;
  /** Whether the galaxy was mounted this second. */
  galaxy: boolean;
  /** Whether the page was in the background. */
  hidden: boolean;
  /** What was on the disc: planets, contacts, flights… */
  ctx: Record<string, number>;
}

export interface PerfSample extends RendererCounts, PerfContext {
  t: number;
  fps: number;
  jankMaxMs: number;
  jank50: number;
  jank250: number;
  longTaskMs: number;
  longTasks: number;
  renderMs: number;
  renderMaxMs: number;
  requests: number;
  kb: number;
}

export type PerfSummary = Record<string, number | string | null> & {
  seconds: number;
  fpsAvg: number | null;
};

export interface PerfRecorder {
  displayFrame: (atMs: number) => void;
  galaxyFrame: (renderMs: number, counts: RendererCounts) => void;
  longTask: (ms: number) => void;
  resource: (kb: number) => void;
  flush: (atMs: number, context: PerfContext) => void;
  samples: () => readonly PerfSample[];
  full: () => boolean;
  summary: () => PerfSummary;
}

const round = (value: number, places = 1): number => {
  const k = 10 ** places;
  return Math.round(value * k) / k;
};

const mean = (values: readonly number[]): number | null =>
  values.length === 0 ? null : round(values.reduce((a, b) => a + b, 0) / values.length);

const percentile = (values: readonly number[], p: number): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? null;
};

const max = (values: readonly number[]): number | null =>
  values.length === 0 ? null : values.reduce((a, b) => Math.max(a, b), -Infinity);

const min = (values: readonly number[]): number | null =>
  values.length === 0 ? null : values.reduce((a, b) => Math.min(a, b), Infinity);

export function createPerfRecorder(startMs: number): PerfRecorder {
  const samples: PerfSample[] = [];
  /** When the previous sample closed. The rate is frames over the time that passed. */
  let lastFlush = startMs;
  let lastDisplay: number | null = null;
  let second = {
    fps: 0, jankMaxMs: 0, jank50: 0, jank250: 0, longTaskMs: 0, longTasks: 0,
    renderMs: 0, renderMaxMs: 0, requests: 0, kb: 0,
    calls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0,
  };
  const fresh = (): typeof second => ({
    fps: 0, jankMaxMs: 0, jank50: 0, jank250: 0, longTaskMs: 0, longTasks: 0,
    renderMs: 0, renderMaxMs: 0, requests: 0, kb: 0,
    // Resource counts carry over: they are totals held, not events in the second.
    calls: 0, triangles: 0, geometries: second.geometries, textures: second.textures, programs: second.programs,
  });

  return {
    displayFrame(atMs) {
      if (lastDisplay !== null) {
        const gap = atMs - lastDisplay;
        if (gap > second.jankMaxMs) second.jankMaxMs = gap;
        if (gap > HITCH_MS) second.jank50 += 1;
        if (gap > FREEZE_MS) second.jank250 += 1;
      }
      lastDisplay = atMs;
    },
    galaxyFrame(renderMs, counts) {
      second.fps += 1;
      second.renderMs += renderMs;
      second.renderMaxMs = Math.max(second.renderMaxMs, renderMs);
      // Per frame, so the second keeps its worst frame's draw.
      second.calls = Math.max(second.calls, counts.calls);
      second.triangles = Math.max(second.triangles, counts.triangles);
      second.geometries = counts.geometries;
      second.textures = counts.textures;
      second.programs = counts.programs;
    },
    longTask(ms) {
      second.longTasks += 1;
      second.longTaskMs += ms;
    },
    resource(kb) {
      second.requests += 1;
      second.kb += kb;
    },
    flush(atMs, context) {
      // A timer that fired late must not read as a fast galaxy (see the test).
      const elapsed = Math.max(1, atMs - lastFlush);
      lastFlush = atMs;
      if (samples.length < PERF_MAX_SAMPLES) {
        samples.push({
          t: Math.round((atMs - startMs) / 1000),
          ...second,
          fps: Math.round((second.fps * 1000) / elapsed),
          renderMs: round(second.renderMs, 2),
          renderMaxMs: round(second.renderMaxMs, 2),
          jankMaxMs: round(second.jankMaxMs),
          longTaskMs: round(second.longTaskMs),
          kb: round(second.kb, 2),
          ...context,
        });
      }
      second = fresh();
    },
    samples: () => samples,
    full: () => samples.length >= PERF_MAX_SAMPLES,
    summary() {
      // Frame-rate figures only for seconds the galaxy was on screen and in front.
      const shown = samples.filter((s) => s.galaxy && !s.hidden);
      const heaps = samples.map((s) => s.heapMb).filter((h): h is number => h !== null);
      const worst = [...samples]
        .sort((a, b) => b.jankMaxMs - a.jankMaxMs)
        .slice(0, 5)
        .filter((s) => s.jankMaxMs > HITCH_MS);
      const moment = (s: PerfSample): string =>
        `t=${String(s.t)}s jank=${String(s.jankMaxMs)}ms fps=${String(s.fps)} calls=${String(s.calls)} `
        + `longTask=${String(s.longTaskMs)}ms `
        + Object.entries(s.ctx).map(([k, v]) => `${k}=${String(v)}`).join(' ');

      const summary: PerfSummary = {
        seconds: samples.length,
        fpsAvg: mean(shown.map((s) => s.fps)),
        fpsP5: percentile(shown.map((s) => s.fps), 5),
        fpsMin: min(shown.map((s) => s.fps)),
        hitches: samples.reduce((n, s) => n + s.jank50, 0),
        freezes: samples.reduce((n, s) => n + s.jank250, 0),
        jankMaxMs: max(samples.map((s) => s.jankMaxMs)),
        longTasks: samples.reduce((n, s) => n + s.longTasks, 0),
        longTaskMs: round(samples.reduce((n, s) => n + s.longTaskMs, 0)),
        renderAvgMs: mean(shown.filter((s) => s.fps > 0).map((s) => s.renderMs / s.fps)),
        renderMaxMs: max(shown.map((s) => s.renderMaxMs)),
        callsAvg: mean(shown.map((s) => s.calls)),
        callsMax: max(shown.map((s) => s.calls)),
        trianglesAvg: mean(shown.map((s) => s.triangles)),
        trianglesMax: max(shown.map((s) => s.triangles)),
        geometriesMax: max(samples.map((s) => s.geometries)),
        texturesMax: max(samples.map((s) => s.textures)),
        programsMax: max(samples.map((s) => s.programs)),
        heapStartMb: heaps[0] ?? null,
        heapEndMb: heaps.at(-1) ?? null,
        heapMaxMb: max(heaps),
        requests: samples.reduce((n, s) => n + s.requests, 0),
        kb: round(samples.reduce((n, s) => n + s.kb, 0)),
      };
      worst.forEach((s, i) => {
        summary[`worst${String(i + 1)}`] = moment(s);
      });
      return summary;
    },
  };
}
