export interface BenchSample { ms: number; statements: number; bytes: number; status: number }

export interface BenchSummary {
  requests: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  cpuMsPerRequest: number;
  statementsPerRequest: number;
  kbPerRequest: number;
  statuses: Record<number, number>;
}

/** Nearest-rank percentile of an ascending list. */
const rank = (sorted: readonly number[], share: number): number =>
  sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.ceil(share * sorted.length) - 1)]!;

/**
 * One route's samples, with the process CPU spent while they ran shared out per request.
 * Under concurrency no single request owns a CPU slice, so CPU is a phase total divided.
 */
export function summarize(samples: readonly BenchSample[], cpuMs: number): BenchSummary {
  const sorted = samples.map((sample) => sample.ms).sort((a, b) => a - b);
  const count = samples.length;
  const mean = (pick: (sample: BenchSample) => number) =>
    count === 0 ? 0 : samples.reduce((sum, sample) => sum + pick(sample), 0) / count;
  const statuses: Record<number, number> = {};
  for (const sample of samples) statuses[sample.status] = (statuses[sample.status] ?? 0) + 1;
  return {
    requests: count,
    p50Ms: rank(sorted, 0.5),
    p95Ms: rank(sorted, 0.95),
    maxMs: sorted.at(-1) ?? 0,
    cpuMsPerRequest: count === 0 ? 0 : cpuMs / count,
    statementsPerRequest: mean((sample) => sample.statements),
    kbPerRequest: mean((sample) => sample.bytes) / 1024,
    statuses,
  };
}
