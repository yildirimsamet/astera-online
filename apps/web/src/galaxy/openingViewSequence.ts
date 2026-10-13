import type { OpeningResult } from './openingPreparation.js';

/** Two actual draws after tracked work settles. The parent cover owns the deadline. */
export function createOpeningViews() {
  const stages = ['wide', 'middle', 'home'] as const;
  let stage = -1;
  let move = true;
  let result: OpeningResult | null = null;
  let revision = -1;
  let frames = 0;
  return {
    get result() { return result; },
    beforeFrame(covered: boolean, ready: boolean): 'wide' | 'middle' | 'home' | 'restore' | null {
      if (result !== null) return null;
      if (!covered || (stage >= 0 && !ready)) {
        result = covered ? 'context-lost' : 'timeout';
        return stage >= 0 ? 'restore' : null;
      }
      if (!ready || !move) return null;
      stage += 1;
      move = false;
      revision = -1;
      frames = 0;
      return stages[stage] ?? null;
    },
    afterFrame(pending: boolean, currentRevision: number): boolean {
      if (result !== null) return true;
      if (stage < 0 || move) return false;
      if (pending || currentRevision !== revision) frames = 0;
      revision = currentRevision;
      if (pending || ++frames < 2) return false;
      if (stage === stages.length - 1) result = 'ready';
      else move = true;
      return result !== null;
    },
  };
}
