export type PreparationResult = 'ready' | 'failed' | 'cancelled' | 'context-lost';
export type OpeningResult = PreparationResult | 'timeout';

export interface OpeningPreparation {
  readonly size: number;
  revision: number;
  covered: boolean;
  failed: boolean;
  result: OpeningResult | null;
  begin: () => (result?: PreparationResult) => void;
  finish: (result: OpeningResult) => void;
}

/** One canvas owns this barrier. Finishing releases waiting, not background work. */
export function createOpeningPreparation(covered = false): OpeningPreparation {
  const jobs = new Set<symbol>();
  const work: OpeningPreparation = {
    get size() { return jobs.size; },
    revision: 0,
    covered,
    failed: false,
    result: null,
    begin() {
      if (!work.covered || work.result !== null) return () => undefined;
      const id = Symbol();
      jobs.add(id);
      work.revision += 1;
      return (result = 'ready') => {
        if (!jobs.delete(id)) return;
        work.revision += 1;
        if (result === 'failed' || result === 'context-lost') work.failed = true;
      };
    },
    finish(result) {
      if (work.result !== null) return;
      work.result = result === 'ready' && work.failed ? 'failed' : result;
      work.covered = false;
      jobs.clear();
      work.revision += 1;
    },
  };
  return work;
}
