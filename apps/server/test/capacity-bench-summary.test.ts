import { describe, expect, it } from 'vitest';
import { summarize } from '../src/cli/capacityBenchSummary.js';

describe('a route measured on the capacity dump', () => {
  it('reports latency percentiles, CPU, statements and size per request, and the status mix', () => {
    const samples = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((ms, index) => ({
      ms, statements: index < 5 ? 2 : 4, bytes: 2048, status: index === 9 ? 503 : 200,
    }));
    expect(summarize(samples, 250)).toEqual({
      requests: 10, p50Ms: 50, p95Ms: 100, maxMs: 100, cpuMsPerRequest: 25,
      statementsPerRequest: 3, kbPerRequest: 2, statuses: { 200: 9, 503: 1 },
    });
  });

  it('says nothing it did not measure', () => {
    expect(summarize([], 0)).toEqual({
      requests: 0, p50Ms: 0, p95Ms: 0, maxMs: 0, cpuMsPerRequest: 0, statementsPerRequest: 0, kbPerRequest: 0, statuses: {},
    });
  });
});
