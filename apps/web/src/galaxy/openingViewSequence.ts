/** Bounded, one-shot preparation. Two actual draws and a quiet interval per view.
 * Resource counters are a settling heuristic, not proof that all GPU work finished.
 * The deadline deliberately permits a slow asset to continue loading normally.
 */
export function createOpeningViews() {
  const stages = ['wide', 'middle', 'home'] as const;
  let stage = -1;
  let move = true;
  let done = false;
  let started = -1;
  let stableSince = -1;
  let signature = '';
  let frames = 0;
  return {
    beforeFrame(covered: boolean, ready: boolean): 'wide' | 'middle' | 'home' | 'restore' | null {
      if (done) return null;
      if (!covered || (stage >= 0 && !ready)) {
        done = true;
        return stage >= 0 ? 'restore' : null;
      }
      if (!ready || !move) return null;
      stage += 1;
      move = false;
      started = -1;
      stableSince = -1;
      frames = 0;
      return stages[stage] ?? null;
    },
    afterFrame(now: number, resources: string, pending: boolean): boolean {
      if (done) return true;
      if (stage < 0 || move) return false;
      if (started < 0) started = now;
      if (resources !== signature || pending || stableSince < 0) stableSince = now;
      signature = resources;
      frames += 1;
      if (frames < 2 || (now - started < 1200 && (pending || now - stableSince < 150))) return false;
      if (stage === stages.length - 1) done = true;
      else move = true;
      return done;
    },
  };
}
